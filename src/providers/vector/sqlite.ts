import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { join } from 'node:path';
import type { VectorIndex, VectorSearchResult } from '../../types/provider.js';
import { MinHeap } from '../../utils/heap.js';
import { cosineDistance } from '../../utils/math.js';

export class SqliteVectorIndex implements VectorIndex {
  private db: DatabaseType;
  private ownsDb: boolean;
  private modelMismatchWarned = false;

  constructor(pathOrDb: string | DatabaseType) {
    if (typeof pathOrDb === 'string') {
      this.db = new Database(join(pathOrDb, 'vectors.db'));
      this.ownsDb = true;
    } else {
      this.db = pathOrDb;
      this.ownsDb = false;
    }
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vectors (
        id TEXT PRIMARY KEY,
        model TEXT NOT NULL,
        vector BLOB NOT NULL
      )
    `);
  }

  async store(id: string, vector: number[], model: string): Promise<void> {
    if (vector.length === 0) {
      throw new Error('Cannot store empty vector');
    }
    for (const v of vector) {
      if (!Number.isFinite(v)) {
        throw new Error(`Invalid vector value: ${v}`);
      }
    }

    // Validate dimension consistency (exclude self for overwrites)
    const existing = this.db
      .prepare('SELECT LENGTH(vector) / 4 as dim FROM vectors WHERE id != ? LIMIT 1')
      .get(id) as { dim: number } | undefined;

    if (existing && existing.dim !== vector.length) {
      throw new Error(
        `Dimension mismatch: cannot store ${vector.length}-dim vector, existing vectors have ${existing.dim} dimensions`
      );
    }

    const blob = Buffer.from(new Float32Array(vector).buffer);
    this.db
      .prepare(
        `INSERT OR REPLACE INTO vectors (id, model, vector) VALUES (?, ?, ?)`
      )
      .run(id, model, blob);
  }

  async search(vector: number[], limit: number): Promise<VectorSearchResult[]> {
    if (vector.length === 0) {
      throw new Error('Cannot search with empty vector');
    }
    for (const v of vector) {
      if (!Number.isFinite(v)) {
        throw new Error(`Invalid vector value: ${v}`);
      }
    }
    if (limit <= 0) {
      return [];
    }

    // Warn once if index contains mixed models
    if (!this.modelMismatchWarned) {
      const models = this.db
        .prepare('SELECT DISTINCT model FROM vectors')
        .all() as Array<{ model: string }>;
      if (models.length > 1) {
        console.warn(
          `Vector index contains embeddings from multiple models: ${models.map((m) => m.model).join(', ')}. ` +
            'Search results may be unreliable. Re-sync to re-embed all documents with current model.'
        );
        this.modelMismatchWarned = true;
      }
    }

    const queryVec = new Float32Array(vector);
    const stmt = this.db.prepare('SELECT id, vector FROM vectors');

    // Max-heap by distance: largest distance at root for efficient eviction
    const heap = new MinHeap<VectorSearchResult>(
      (a, b) => b.distance - a.distance
    );

    let dimensionChecked = false;

    for (const row of stmt.iterate() as IterableIterator<{
      id: string;
      vector: Buffer;
    }>) {
      // Check dimension mismatch against first stored vector
      if (!dimensionChecked) {
        const storedDim = row.vector.byteLength / 4;
        if (vector.length !== storedDim) {
          throw new Error(
            `Dimension mismatch: query has ${vector.length} dimensions, stored vectors have ${storedDim}`
          );
        }
        dimensionChecked = true;
      }

      const storedVec = new Float32Array(
        row.vector.buffer,
        row.vector.byteOffset,
        row.vector.byteLength / 4
      );
      const distance = cosineDistance(queryVec, storedVec);

      if (heap.size() < limit) {
        heap.push({ id: row.id, distance });
      } else if (distance < heap.peek()!.distance) {
        heap.pop();
        heap.push({ id: row.id, distance });
      }
    }

    // Extract and sort by distance ascending
    return heap.toArray().sort((a, b) => a.distance - b.distance);
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM vectors WHERE id = ?').run(id);
  }

  async getModel(id: string): Promise<string | null> {
    const row = this.db
      .prepare('SELECT model FROM vectors WHERE id = ?')
      .get(id) as { model: string } | undefined;
    return row?.model ?? null;
  }

  hasEmbedding(id: string): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM vectors WHERE id = ?')
      .get(id);
    return row !== undefined;
  }

  /** For testing: get table names */
  getTableNames(): string[] {
    const rows = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;
    return rows.map((r) => r.name);
  }

  /** For testing: get vector blob size */
  getVectorBlobSize(id: string): number | null {
    const row = this.db
      .prepare('SELECT LENGTH(vector) as size FROM vectors WHERE id = ?')
      .get(id) as { size: number } | undefined;
    return row?.size ?? null;
  }

  /** Get total number of stored embeddings */
  getEmbeddingCount(): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM vectors')
      .get() as { count: number };
    return row.count;
  }

  close(): void {
    if (this.ownsDb) {
      this.db.close();
    }
  }
}
