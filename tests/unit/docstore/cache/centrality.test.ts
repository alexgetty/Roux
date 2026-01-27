import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { storeCentrality, getCentrality } from '../../../../src/providers/docstore/cache/centrality.js';

describe('centrality', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE nodes (
        id TEXT PRIMARY KEY
      );
      CREATE TABLE centrality (
        node_id TEXT PRIMARY KEY,
        pagerank REAL,
        in_degree INTEGER,
        out_degree INTEGER,
        computed_at INTEGER,
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

  describe('storeCentrality', () => {
    it('stores all centrality metrics', () => {
      const now = Date.now();
      storeCentrality(db, 'test.md', 0.85, 5, 3, now);

      const row = db
        .prepare('SELECT * FROM centrality WHERE node_id = ?')
        .get('test.md') as {
          pagerank: number;
          in_degree: number;
          out_degree: number;
          computed_at: number;
        };

      expect(row.pagerank).toBe(0.85);
      expect(row.in_degree).toBe(5);
      expect(row.out_degree).toBe(3);
      expect(row.computed_at).toBe(now);
    });

    it('overwrites existing centrality on conflict', () => {
      storeCentrality(db, 'test.md', 0.5, 1, 2, 1000);
      storeCentrality(db, 'test.md', 0.9, 10, 20, 2000);

      const count = db
        .prepare('SELECT COUNT(*) as c FROM centrality WHERE node_id = ?')
        .get('test.md') as { c: number };

      expect(count.c).toBe(1);

      const row = db
        .prepare('SELECT pagerank, computed_at FROM centrality WHERE node_id = ?')
        .get('test.md') as { pagerank: number; computed_at: number };

      expect(row.pagerank).toBe(0.9);
      expect(row.computed_at).toBe(2000);
    });
  });

  describe('getCentrality', () => {
    it('returns null when no centrality exists', () => {
      const result = getCentrality(db, 'test.md');
      expect(result).toBeNull();
    });

    it('returns centrality record with all fields', () => {
      const now = Date.now();
      storeCentrality(db, 'test.md', 0.75, 8, 4, now);

      const result = getCentrality(db, 'test.md');

      expect(result).not.toBeNull();
      expect(result!.pagerank).toBe(0.75);
      expect(result!.inDegree).toBe(8);
      expect(result!.outDegree).toBe(4);
      expect(result!.computedAt).toBe(now);
    });

    it('returns null for non-existent node', () => {
      const result = getCentrality(db, 'nonexistent.md');
      expect(result).toBeNull();
    });
  });
});
