import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { storeCentrality, getCentrality, initCentralitySchema } from '../../../../src/providers/docstore/cache/centrality.js';

describe('centrality', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE nodes (
        id TEXT PRIMARY KEY
      );
    `);
    // Use initCentralitySchema to create the centrality table
    initCentralitySchema(db);
    db.pragma('foreign_keys = ON');
    // Insert a node to satisfy foreign key
    db.prepare('INSERT INTO nodes (id) VALUES (?)').run('test.md');
  });

  afterEach(() => {
    db.close();
  });

  describe('initCentralitySchema', () => {
    it('creates centrality table with correct columns', () => {
      const freshDb = new Database(':memory:');
      freshDb.exec('CREATE TABLE nodes (id TEXT PRIMARY KEY)');

      initCentralitySchema(freshDb);

      const tables = freshDb
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='centrality'")
        .all() as { name: string }[];
      expect(tables).toHaveLength(1);

      // Verify columns exist by inserting a row
      freshDb.prepare('INSERT INTO nodes (id) VALUES (?)').run('test.md');
      freshDb.pragma('foreign_keys = ON');
      freshDb.prepare(`
        INSERT INTO centrality (node_id, pagerank, in_degree, out_degree, computed_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('test.md', 0.5, 1, 2, 1000);

      const row = freshDb.prepare('SELECT * FROM centrality WHERE node_id = ?').get('test.md') as {
        node_id: string;
        pagerank: number;
        in_degree: number;
        out_degree: number;
        computed_at: number;
      };
      expect(row.node_id).toBe('test.md');
      expect(row.pagerank).toBe(0.5);

      freshDb.close();
    });

    it('is idempotent (can be called multiple times)', () => {
      const freshDb = new Database(':memory:');
      freshDb.exec('CREATE TABLE nodes (id TEXT PRIMARY KEY)');

      // Call twice - should not throw
      initCentralitySchema(freshDb);
      initCentralitySchema(freshDb);

      const tables = freshDb
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='centrality'")
        .all() as { name: string }[];
      expect(tables).toHaveLength(1);

      freshDb.close();
    });

    it('creates foreign key constraint to nodes table', () => {
      const freshDb = new Database(':memory:');
      freshDb.exec('CREATE TABLE nodes (id TEXT PRIMARY KEY)');
      initCentralitySchema(freshDb);
      freshDb.pragma('foreign_keys = ON');

      // Insert a node, then centrality, then delete node
      freshDb.prepare('INSERT INTO nodes (id) VALUES (?)').run('test.md');
      freshDb.prepare(`
        INSERT INTO centrality (node_id, pagerank, in_degree, out_degree, computed_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('test.md', 0.5, 1, 2, 1000);

      // Delete node should cascade to centrality
      freshDb.prepare('DELETE FROM nodes WHERE id = ?').run('test.md');

      const row = freshDb.prepare('SELECT * FROM centrality WHERE node_id = ?').get('test.md');
      expect(row).toBeUndefined();

      freshDb.close();
    });
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

  describe('SQL injection resistance', () => {
    it('handles malicious node ID with SQL injection attempt in storeCentrality', () => {
      const maliciousId = "'; DROP TABLE centrality; --";
      // Insert node to satisfy foreign key
      db.prepare('INSERT INTO nodes (id) VALUES (?)').run(maliciousId);

      storeCentrality(db, maliciousId, 0.5, 1, 2, 1000);

      // Table should still exist
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='centrality'")
        .all() as { name: string }[];
      expect(tables).toHaveLength(1);

      // Should be able to retrieve the record
      const result = getCentrality(db, maliciousId);
      expect(result).not.toBeNull();
      expect(result!.pagerank).toBe(0.5);
    });

    it('handles malicious node ID with SQL injection attempt in getCentrality', () => {
      // Store a legitimate entry
      storeCentrality(db, 'test.md', 0.75, 5, 3, 1000);

      // Try to inject via getCentrality
      const maliciousId = "test.md' OR '1'='1";
      const result = getCentrality(db, maliciousId);

      // Should return null, not the legitimate entry
      expect(result).toBeNull();
    });

    it('handles node ID with special SQL characters', () => {
      const specialId = "node'with\"quotes;and--comments/**/";
      db.prepare('INSERT INTO nodes (id) VALUES (?)').run(specialId);

      storeCentrality(db, specialId, 0.42, 7, 9, 2000);

      const result = getCentrality(db, specialId);
      expect(result).not.toBeNull();
      expect(result!.pagerank).toBe(0.42);
    });
  });

  describe('zero degree handling', () => {
    it('stores and retrieves zero in_degree for node with no incoming links', () => {
      const now = Date.now();
      storeCentrality(db, 'test.md', 0.15, 0, 5, now);

      const result = getCentrality(db, 'test.md');

      expect(result).not.toBeNull();
      expect(result!.inDegree).toBe(0);
      expect(result!.outDegree).toBe(5);
    });

    it('stores and retrieves zero out_degree for node with no outgoing links', () => {
      const now = Date.now();
      storeCentrality(db, 'test.md', 0.15, 3, 0, now);

      const result = getCentrality(db, 'test.md');

      expect(result).not.toBeNull();
      expect(result!.inDegree).toBe(3);
      expect(result!.outDegree).toBe(0);
    });

    it('handles isolated node with zero degrees in both directions', () => {
      const now = Date.now();
      storeCentrality(db, 'test.md', 0.0, 0, 0, now);

      const result = getCentrality(db, 'test.md');

      expect(result).not.toBeNull();
      expect(result!.pagerank).toBe(0.0);
      expect(result!.inDegree).toBe(0);
      expect(result!.outDegree).toBe(0);
    });

    it('handles zero pagerank with non-zero degrees', () => {
      const now = Date.now();
      storeCentrality(db, 'test.md', 0.0, 2, 3, now);

      const result = getCentrality(db, 'test.md');

      expect(result).not.toBeNull();
      expect(result!.pagerank).toBe(0.0);
      expect(result!.inDegree).toBe(2);
      expect(result!.outDegree).toBe(3);
    });
  });
});
