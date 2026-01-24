import Database from 'better-sqlite3';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import type { Node, SourceRef } from '../../types/node.js';
import type { TagMode } from '../../types/provider.js';

export interface EmbeddingRecord {
  model: string;
  vector: number[];
}

export interface CentralityRecord {
  pagerank: number;
  inDegree: number;
  outDegree: number;
  computedAt: number;
}

interface NodeRow {
  id: string;
  title: string;
  content: string;
  tags: string;
  outgoing_links: string;
  properties: string;
  source_type: string;
  source_path: string;
  source_modified: number;
}

interface EmbeddingRow {
  node_id: string;
  model: string;
  vector: Buffer;
}

interface CentralityRow {
  node_id: string;
  pagerank: number;
  in_degree: number;
  out_degree: number;
  computed_at: number;
}

export class Cache {
  private db: Database.Database;

  constructor(cacheDir: string) {
    mkdirSync(cacheDir, { recursive: true });
    const dbPath = join(cacheDir, 'cache.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        title TEXT,
        content TEXT,
        tags TEXT,
        outgoing_links TEXT,
        properties TEXT,
        source_type TEXT,
        source_path TEXT,
        source_modified INTEGER
      );

      CREATE TABLE IF NOT EXISTS embeddings (
        node_id TEXT PRIMARY KEY,
        model TEXT,
        vector BLOB,
        FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS centrality (
        node_id TEXT PRIMARY KEY,
        pagerank REAL,
        in_degree INTEGER,
        out_degree INTEGER,
        computed_at INTEGER,
        FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_nodes_source_path ON nodes(source_path);
    `);
    // Enable foreign key enforcement for cascade deletes
    this.db.pragma('foreign_keys = ON');
  }

  getTableNames(): string[] {
    const rows = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;
    return rows.map((r) => r.name);
  }

  upsertNode(
    node: Node,
    sourceType: string,
    sourcePath: string,
    sourceModified: number
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO nodes (id, title, content, tags, outgoing_links, properties, source_type, source_path, source_modified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        content = excluded.content,
        tags = excluded.tags,
        outgoing_links = excluded.outgoing_links,
        properties = excluded.properties,
        source_type = excluded.source_type,
        source_path = excluded.source_path,
        source_modified = excluded.source_modified
    `);

    stmt.run(
      node.id,
      node.title,
      node.content,
      JSON.stringify(node.tags),
      JSON.stringify(node.outgoingLinks),
      JSON.stringify(node.properties),
      sourceType,
      sourcePath,
      sourceModified
    );
  }

  getNode(id: string): Node | null {
    const row = this.db
      .prepare('SELECT * FROM nodes WHERE id = ?')
      .get(id) as NodeRow | undefined;

    if (!row) return null;
    return this.rowToNode(row);
  }

  getNodes(ids: string[]): Node[] {
    if (ids.length === 0) return [];

    // Fetch all nodes then order by input ids
    const placeholders = ids.map(() => '?').join(',');
    const rows = this.db
      .prepare(`SELECT * FROM nodes WHERE id IN (${placeholders})`)
      .all(...ids) as NodeRow[];

    const nodeMap = new Map<string, Node>();
    for (const row of rows) {
      nodeMap.set(row.id, this.rowToNode(row));
    }

    // Return in requested order
    const result: Node[] = [];
    for (const id of ids) {
      const node = nodeMap.get(id);
      if (node) result.push(node);
    }
    return result;
  }

  deleteNode(id: string): void {
    this.db.prepare('DELETE FROM nodes WHERE id = ?').run(id);
  }

  getAllNodes(): Node[] {
    const rows = this.db.prepare('SELECT * FROM nodes').all() as NodeRow[];
    return rows.map((row) => this.rowToNode(row));
  }

  searchByTags(tags: string[], mode: TagMode): Node[] {
    if (tags.length === 0) return [];

    const allNodes = this.getAllNodes();
    const lowerTags = tags.map((t) => t.toLowerCase());

    return allNodes.filter((node) => {
      const nodeTags = node.tags.map((t) => t.toLowerCase());
      if (mode === 'any') {
        return lowerTags.some((t) => nodeTags.includes(t));
      } else {
        return lowerTags.every((t) => nodeTags.includes(t));
      }
    });
  }

  getModifiedTime(sourcePath: string): number | null {
    const row = this.db
      .prepare('SELECT source_modified FROM nodes WHERE source_path = ?')
      .get(sourcePath) as { source_modified: number } | undefined;

    return row?.source_modified ?? null;
  }

  getNodeByPath(sourcePath: string): Node | null {
    const row = this.db
      .prepare('SELECT * FROM nodes WHERE source_path = ?')
      .get(sourcePath) as NodeRow | undefined;

    if (!row) return null;
    return this.rowToNode(row);
  }

  getAllTrackedPaths(): Set<string> {
    const rows = this.db
      .prepare('SELECT source_path FROM nodes')
      .all() as Array<{ source_path: string }>;

    return new Set(rows.map((r) => r.source_path));
  }

  resolveTitles(ids: string[]): Map<string, string> {
    if (ids.length === 0) return new Map();

    const placeholders = ids.map(() => '?').join(',');
    const rows = this.db
      .prepare(`SELECT id, title FROM nodes WHERE id IN (${placeholders})`)
      .all(...ids) as Array<{ id: string; title: string }>;

    const result = new Map<string, string>();
    for (const row of rows) {
      result.set(row.id, row.title);
    }
    return result;
  }

  storeEmbedding(nodeId: string, vector: number[], model: string): void {
    const buffer = Buffer.from(new Float32Array(vector).buffer);
    this.db
      .prepare(
        `
      INSERT INTO embeddings (node_id, model, vector)
      VALUES (?, ?, ?)
      ON CONFLICT(node_id) DO UPDATE SET
        model = excluded.model,
        vector = excluded.vector
    `
      )
      .run(nodeId, model, buffer);
  }

  getEmbedding(nodeId: string): EmbeddingRecord | null {
    const row = this.db
      .prepare('SELECT model, vector FROM embeddings WHERE node_id = ?')
      .get(nodeId) as EmbeddingRow | undefined;

    if (!row) return null;

    const float32 = new Float32Array(
      row.vector.buffer,
      row.vector.byteOffset,
      row.vector.length / 4
    );
    return {
      model: row.model,
      vector: Array.from(float32),
    };
  }

  storeCentrality(
    nodeId: string,
    pagerank: number,
    inDegree: number,
    outDegree: number,
    computedAt: number
  ): void {
    this.db
      .prepare(
        `
      INSERT INTO centrality (node_id, pagerank, in_degree, out_degree, computed_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(node_id) DO UPDATE SET
        pagerank = excluded.pagerank,
        in_degree = excluded.in_degree,
        out_degree = excluded.out_degree,
        computed_at = excluded.computed_at
    `
      )
      .run(nodeId, pagerank, inDegree, outDegree, computedAt);
  }

  getCentrality(nodeId: string): CentralityRecord | null {
    const row = this.db
      .prepare('SELECT * FROM centrality WHERE node_id = ?')
      .get(nodeId) as CentralityRow | undefined;

    if (!row) return null;

    return {
      pagerank: row.pagerank,
      inDegree: row.in_degree,
      outDegree: row.out_degree,
      computedAt: row.computed_at,
    };
  }

  getStats(): { nodeCount: number; embeddingCount: number; edgeCount: number } {
    const nodeCount = this.db
      .prepare('SELECT COUNT(*) as count FROM nodes')
      .get() as { count: number };

    const embeddingCount = this.db
      .prepare('SELECT COUNT(*) as count FROM embeddings')
      .get() as { count: number };

    // Sum all in_degree values to get edge count
    const edgeSum = this.db
      .prepare('SELECT SUM(in_degree) as total FROM centrality')
      .get() as { total: number | null };

    return {
      nodeCount: nodeCount.count,
      embeddingCount: embeddingCount.count,
      edgeCount: edgeSum.total ?? 0,
    };
  }

  clear(): void {
    this.db.exec('DELETE FROM centrality');
    this.db.exec('DELETE FROM embeddings');
    this.db.exec('DELETE FROM nodes');
  }

  close(): void {
    this.db.close();
  }

  private rowToNode(row: NodeRow): Node {
    const sourceRef: SourceRef = {
      type: row.source_type as SourceRef['type'],
      path: row.source_path,
      lastModified: new Date(row.source_modified),
    };

    return {
      id: row.id,
      title: row.title,
      content: row.content,
      tags: JSON.parse(row.tags) as string[],
      outgoingLinks: JSON.parse(row.outgoing_links) as string[],
      properties: JSON.parse(row.properties) as Record<string, unknown>,
      sourceRef,
    };
  }
}
