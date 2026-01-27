import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { storeEmbedding, getEmbedding } from '../../../../src/providers/docstore/cache/embeddings.js';

describe('embeddings', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE nodes (
        id TEXT PRIMARY KEY
      );
      CREATE TABLE embeddings (
        node_id TEXT PRIMARY KEY,
        model TEXT,
        vector BLOB,
        FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
      );
    `);
    db.pragma('foreign_keys = ON');
    // Insert a node to satisfy foreign key
    db.prepare('INSERT INTO nodes (id) VALUES (?)').run('test.md');
  });

  afterEach(() => {
    db.close();
  });

  describe('storeEmbedding', () => {
    it('stores embedding as Float32Array buffer', () => {
      const vector = [0.1, 0.2, 0.3, 0.4, 0.5];
      storeEmbedding(db, 'test.md', vector, 'test-model');

      const row = db
        .prepare('SELECT vector FROM embeddings WHERE node_id = ?')
        .get('test.md') as { vector: Buffer };

      // 5 floats * 4 bytes = 20 bytes for Float32
      expect(row.vector.length).toBe(20);
    });

    it('stores model name', () => {
      storeEmbedding(db, 'test.md', [1, 2, 3], 'my-model');

      const row = db
        .prepare('SELECT model FROM embeddings WHERE node_id = ?')
        .get('test.md') as { model: string };

      expect(row.model).toBe('my-model');
    });

    it('overwrites existing embedding on conflict', () => {
      storeEmbedding(db, 'test.md', [1, 2, 3], 'v1');
      storeEmbedding(db, 'test.md', [4, 5, 6], 'v2');

      const count = db
        .prepare('SELECT COUNT(*) as c FROM embeddings WHERE node_id = ?')
        .get('test.md') as { c: number };

      expect(count.c).toBe(1);

      const row = db
        .prepare('SELECT model FROM embeddings WHERE node_id = ?')
        .get('test.md') as { model: string };

      expect(row.model).toBe('v2');
    });
  });

  describe('getEmbedding', () => {
    it('returns null when no embedding exists', () => {
      const result = getEmbedding(db, 'test.md');
      expect(result).toBeNull();
    });

    it('returns embedding record with model and vector', () => {
      storeEmbedding(db, 'test.md', [0.1, 0.2, 0.3], 'test-model');

      const result = getEmbedding(db, 'test.md');

      expect(result).not.toBeNull();
      expect(result!.model).toBe('test-model');
      expect(result!.vector).toHaveLength(3);
    });

    it('converts Float32 buffer back to number array', () => {
      const original = [0.1, 0.2, 0.3, 0.4, 0.5];
      storeEmbedding(db, 'test.md', original, 'model');

      const result = getEmbedding(db, 'test.md');

      // Float32 has less precision than Float64
      result!.vector.forEach((v, i) => {
        expect(v).toBeCloseTo(original[i]!, 5);
      });
    });

    it('returns null for non-existent node', () => {
      const result = getEmbedding(db, 'nonexistent.md');
      expect(result).toBeNull();
    });
  });
});
