import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteVectorIndex } from '../../../src/providers/vector/index.js';

describe('SqliteVectorIndex', () => {
  let tempDir: string;
  let provider: SqliteVectorIndex;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'roux-vector-test-'));
    provider = new SqliteVectorIndex(tempDir);
  });

  afterEach(async () => {
    provider.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('initialization', () => {
    it('creates vectors table', () => {
      const tables = provider.getTableNames();
      expect(tables).toContain('vectors');
    });

    it('creates database file in specified directory', async () => {
      const { stat } = await import('node:fs/promises');
      const dbPath = join(tempDir, 'vectors.db');
      const stats = await stat(dbPath);
      expect(stats.isFile()).toBe(true);
    });
  });

  describe('store', () => {
    it('stores a vector with model metadata', async () => {
      const vector = [0.1, 0.2, 0.3, 0.4, 0.5];
      await provider.store('doc1', vector, 'test-model');

      const model = await provider.getModel('doc1');
      expect(model).toBe('test-model');
    });

    it('stores vector as Float32Array (4 bytes per element)', async () => {
      const vector = [0.1, 0.2, 0.3, 0.4, 0.5];
      await provider.store('doc1', vector, 'test-model');

      // 5 floats * 4 bytes = 20 bytes for Float32
      const blobSize = provider.getVectorBlobSize('doc1');
      expect(blobSize).toBe(20);
    });

    it('getVectorBlobSize returns null for missing id', async () => {
      const blobSize = provider.getVectorBlobSize('nonexistent');
      expect(blobSize).toBeNull();
    });

    it('overwrites existing vector with same id', async () => {
      await provider.store('doc1', [1, 2, 3], 'model-v1');
      await provider.store('doc1', [4, 5, 6], 'model-v2');

      const model = await provider.getModel('doc1');
      expect(model).toBe('model-v2');
    });

    it('concurrent stores to same id are atomic (exactly one entry survives)', async () => {
      // Trigger near-simultaneous writes
      await Promise.all([
        provider.store('concurrent', [1, 0, 0], 'model-first'),
        provider.store('concurrent', [0, 1, 0], 'model-second'),
      ]);

      // Should have exactly one entry (atomicity)
      const model = await provider.getModel('concurrent');
      expect(model).toBeDefined();

      // Verify search returns consistent state (only one vector)
      const results = await provider.search([1, 0, 0], 10);
      const concurrentResults = results.filter((r) => r.id === 'concurrent');
      expect(concurrentResults).toHaveLength(1);

      // Verify model and vector are consistent (from the same write)
      // If model is 'model-first', vector should be [1,0,0] (distance ~0 from query)
      // If model is 'model-second', vector should be [0,1,0] (distance ~1 from query)
      const distance = concurrentResults[0]!.distance;
      if (model === 'model-first') {
        // Vector [1,0,0] vs query [1,0,0] = distance 0
        expect(distance).toBeCloseTo(0, 5);
      } else {
        // Vector [0,1,0] vs query [1,0,0] = distance 1 (orthogonal)
        expect(model).toBe('model-second');
        expect(distance).toBeCloseTo(1, 5);
      }
    });
  });

  describe('search', () => {
    it('returns results sorted by distance ascending', async () => {
      // Store vectors with known distances to query vector
      // Query will be [1, 0, 0] - unit vector along x-axis
      await provider.store('identical', [1, 0, 0], 'model'); // distance = 0
      await provider.store('similar', [0.9, 0.1, 0], 'model'); // small distance
      await provider.store('different', [0, 1, 0], 'model'); // distance = 1 (orthogonal)
      await provider.store('opposite', [-1, 0, 0], 'model'); // distance = 2

      const results = await provider.search([1, 0, 0], 10);

      expect(results).toHaveLength(4);
      expect(results[0]!.id).toBe('identical');
      expect(results[0]!.distance).toBeCloseTo(0, 5);
      expect(results[1]!.id).toBe('similar');
      expect(results[2]!.id).toBe('different');
      expect(results[2]!.distance).toBeCloseTo(1, 5);
      expect(results[3]!.id).toBe('opposite');
      expect(results[3]!.distance).toBeCloseTo(2, 5);
    });

    it('respects limit parameter', async () => {
      await provider.store('a', [1, 0, 0], 'model');
      await provider.store('b', [0.9, 0.1, 0], 'model');
      await provider.store('c', [0.8, 0.2, 0], 'model');
      await provider.store('d', [0.7, 0.3, 0], 'model');

      const results = await provider.search([1, 0, 0], 2);

      expect(results).toHaveLength(2);
    });

    it('returns empty array when no vectors stored', async () => {
      const results = await provider.search([1, 0, 0], 10);
      expect(results).toEqual([]);
    });

    it('handles high-dimensional vectors (384 dimensions)', async () => {
      // MiniLM typical dimension count
      const dim = 384;
      const v1 = new Array(dim).fill(0).map((_, i) => Math.sin(i));
      const v2 = new Array(dim).fill(0).map((_, i) => Math.cos(i));

      await provider.store('sin', v1, 'model');
      await provider.store('cos', v2, 'model');

      const results = await provider.search(v1, 10);

      expect(results).toHaveLength(2);
      expect(results[0]!.id).toBe('sin');
      expect(results[0]!.distance).toBeCloseTo(0, 5);
    });

    it('handles 768-dimensional vectors (BERT)', async () => {
      const dim = 768;
      const v1 = new Array(dim).fill(0).map((_, i) => Math.sin(i * 0.01));
      const v2 = new Array(dim).fill(0).map((_, i) => Math.cos(i * 0.01));

      await provider.store('bert1', v1, 'bert-model');
      await provider.store('bert2', v2, 'bert-model');

      const results = await provider.search(v1, 10);

      expect(results).toHaveLength(2);
      expect(results[0]!.id).toBe('bert1');
      expect(results[0]!.distance).toBeCloseTo(0, 5);
    });

    it('handles 1536-dimensional vectors (OpenAI)', async () => {
      const dim = 1536;
      const v1 = new Array(dim).fill(0).map((_, i) => Math.sin(i * 0.005));
      const v2 = new Array(dim).fill(0).map((_, i) => Math.cos(i * 0.005));

      await provider.store('openai1', v1, 'text-embedding-ada-002');
      await provider.store('openai2', v2, 'text-embedding-ada-002');

      const results = await provider.search(v1, 10);

      expect(results).toHaveLength(2);
      expect(results[0]!.id).toBe('openai1');
      expect(results[0]!.distance).toBeCloseTo(0, 5);
    });

    it('warns once when index contains mixed models', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await provider.store('doc1', [1, 0, 0], 'model-v1');
      await provider.store('doc2', [0.9, 0.1, 0], 'model-v2'); // Different model

      // First search should warn
      await provider.search([1, 0, 0], 10);
      expect(consoleSpy).toHaveBeenCalledOnce();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('multiple models')
      );

      // Second search should NOT warn again
      consoleSpy.mockClear();
      await provider.search([1, 0, 0], 10);
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('does not warn when all vectors use same model', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await provider.store('doc1', [1, 0, 0], 'model-v1');
      await provider.store('doc2', [0.9, 0.1, 0], 'model-v1'); // Same model

      await provider.search([1, 0, 0], 10);
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('delete', () => {
    it('removes vector by id', async () => {
      await provider.store('doc1', [1, 2, 3], 'model');
      await provider.delete('doc1');

      const model = await provider.getModel('doc1');
      expect(model).toBeNull();
    });

    it('does not throw for non-existent id', async () => {
      await expect(provider.delete('missing')).resolves.not.toThrow();
    });

    it('removes vector from search results', async () => {
      await provider.store('keep', [1, 0, 0], 'model');
      await provider.store('remove', [0.9, 0.1, 0], 'model');

      await provider.delete('remove');

      const results = await provider.search([1, 0, 0], 10);
      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe('keep');
    });
  });

  describe('getModel', () => {
    it('returns model string for stored vector', async () => {
      await provider.store('doc1', [1, 2, 3], 'sentence-transformers/all-MiniLM-L6-v2');

      const model = await provider.getModel('doc1');
      expect(model).toBe('sentence-transformers/all-MiniLM-L6-v2');
    });

    it('returns null for missing id', async () => {
      const model = await provider.getModel('nonexistent');
      expect(model).toBeNull();
    });
  });

  describe('validation', () => {
    describe('dimension mismatch', () => {
      it('throws on dimension mismatch in search', async () => {
        await provider.store('a', [0.1, 0.2, 0.3], 'model');
        await expect(provider.search([0.1, 0.2], 10)).rejects.toThrow(/dimension/i);
      });

      it('throws on dimension mismatch in store', async () => {
        await provider.store('a', [0.1, 0.2, 0.3], 'model');
        await expect(provider.store('b', [0.1, 0.2], 'model')).rejects.toThrow(/dimension/i);
      });

      it('allows overwriting same id with different dimensions', async () => {
        await provider.store('a', [0.1, 0.2, 0.3], 'model-v1');
        // Overwriting same ID is allowed - this is the migration path
        await provider.store('a', [0.1, 0.2, 0.3, 0.4], 'model-v2');

        const model = await provider.getModel('a');
        expect(model).toBe('model-v2');
      });

      it('search works after overwriting with different dimensions', async () => {
        // Store ID "a" with 3-dim, overwrite with 5-dim, store ID "b" with 5-dim
        await provider.store('a', [0.1, 0.2, 0.3], 'model-v1');
        await provider.store('a', [0.1, 0.2, 0.3, 0.4, 0.5], 'model-v2');
        await provider.store('b', [0.2, 0.3, 0.4, 0.5, 0.6], 'model-v2');

        // Search with 5-dim query should work
        const results = await provider.search([0.1, 0.2, 0.3, 0.4, 0.5], 10);

        expect(results).toHaveLength(2);
        expect(results[0]!.id).toBe('a');
        expect(results[0]!.distance).toBeCloseTo(0, 5);
      });

      it('throws dimension mismatch when searching with old dimensions after overwrite', async () => {
        // Store ID "a" with 3-dim, overwrite with 5-dim
        await provider.store('a', [0.1, 0.2, 0.3], 'model-v1');
        await provider.store('a', [0.1, 0.2, 0.3, 0.4, 0.5], 'model-v2');

        // Search with 3-dim query should throw - current dimension is 5
        await expect(provider.search([0.1, 0.2, 0.3], 10)).rejects.toThrow(/dimension/i);
      });

      it('allows storing after all vectors deleted', async () => {
        await provider.store('a', [0.1, 0.2, 0.3], 'model');
        await provider.delete('a');
        // After clearing, new dimension is allowed
        await provider.store('b', [0.1, 0.2, 0.3, 0.4], 'model');

        const model = await provider.getModel('b');
        expect(model).toBe('model');
      });
    });

    describe('empty vector', () => {
      it('store throws on empty vector', async () => {
        await expect(provider.store('a', [], 'model')).rejects.toThrow(/empty/i);
      });

      it('search throws on empty vector', async () => {
        await expect(provider.search([], 10)).rejects.toThrow(/empty/i);
      });
    });

    describe('limit validation', () => {
      it('search with limit 0 returns empty array', async () => {
        await provider.store('a', [0.1, 0.2, 0.3], 'model');
        const results = await provider.search([0.1, 0.2, 0.3], 0);
        expect(results).toEqual([]);
      });

      it('search with negative limit returns empty array', async () => {
        await provider.store('a', [0.1, 0.2, 0.3], 'model');
        const results = await provider.search([0.1, 0.2, 0.3], -5);
        expect(results).toEqual([]);
      });
    });

    describe('invalid vector values', () => {
      it('store throws on NaN in vector', async () => {
        await expect(provider.store('a', [0.1, NaN, 0.3], 'model')).rejects.toThrow(/invalid/i);
      });

      it('store throws on Infinity in vector', async () => {
        await expect(provider.store('a', [0.1, Infinity, 0.3], 'model')).rejects.toThrow(/invalid/i);
      });

      it('store throws on -Infinity in vector', async () => {
        await expect(provider.store('a', [0.1, -Infinity, 0.3], 'model')).rejects.toThrow(/invalid/i);
      });

      it('search throws on NaN in query vector', async () => {
        await provider.store('a', [0.1, 0.2, 0.3], 'model');
        await expect(provider.search([0.1, NaN, 0.3], 10)).rejects.toThrow(/invalid/i);
      });

      it('search throws on Infinity in query vector', async () => {
        await provider.store('a', [0.1, 0.2, 0.3], 'model');
        await expect(provider.search([0.1, Infinity, 0.3], 10)).rejects.toThrow(/invalid/i);
      });

      it('search throws on -Infinity in query vector', async () => {
        await provider.store('a', [0.1, 0.2, 0.3], 'model');
        await expect(provider.search([0.1, -Infinity, 0.3], 10)).rejects.toThrow(/invalid/i);
      });
    });
  });

  describe('cosine distance calculation', () => {
    it('returns 0 for identical vectors', async () => {
      await provider.store('a', [1, 2, 3], 'model');

      const results = await provider.search([1, 2, 3], 1);
      expect(results[0]!.distance).toBeCloseTo(0, 10);
    });

    it('returns 1 for orthogonal vectors', async () => {
      await provider.store('ortho', [0, 1, 0], 'model');

      const results = await provider.search([1, 0, 0], 1);
      expect(results[0]!.distance).toBeCloseTo(1, 10);
    });

    it('returns 2 for opposite vectors', async () => {
      await provider.store('opp', [-1, 0, 0], 'model');

      const results = await provider.search([1, 0, 0], 1);
      expect(results[0]!.distance).toBeCloseTo(2, 10);
    });

    it('handles unnormalized vectors', async () => {
      // [2, 0, 0] should be treated same as [1, 0, 0] after normalization
      await provider.store('scaled', [2, 0, 0], 'model');

      const results = await provider.search([100, 0, 0], 1);
      expect(results[0]!.distance).toBeCloseTo(0, 10);
    });

    it('returns distance 1 for zero vector', async () => {
      await provider.store('zero', [0, 0, 0], 'model');

      const results = await provider.search([1, 0, 0], 1);
      expect(results[0]!.distance).toBe(1);
    });

    it('returns distance 1 when query is zero vector', async () => {
      await provider.store('nonzero', [1, 2, 3], 'model');

      const results = await provider.search([0, 0, 0], 1);
      expect(results[0]!.distance).toBe(1);
    });
  });

  describe('constructor with Database instance', () => {
    it('accepts an existing better-sqlite3 Database', async () => {
      const Database = (await import('better-sqlite3')).default;
      const db = new Database(':memory:');

      const providerWithDb = new SqliteVectorIndex(db);

      await providerWithDb.store('test', [1, 2, 3], 'model');
      const model = await providerWithDb.getModel('test');
      expect(model).toBe('model');

      providerWithDb.close();
    });
  });

  describe('SQL injection resistance', () => {
    it('handles malicious ID with SQL injection attempt in store', async () => {
      const maliciousId = "'; DROP TABLE vectors; --";
      await provider.store(maliciousId, [1, 2, 3], 'model');

      // Table should still exist and function
      const tables = provider.getTableNames();
      expect(tables).toContain('vectors');

      // Should be able to retrieve the malicious ID
      const model = await provider.getModel(maliciousId);
      expect(model).toBe('model');
    });

    it('handles malicious ID with SQL injection attempt in search', async () => {
      const maliciousId = "'; DROP TABLE vectors; --";
      await provider.store(maliciousId, [1, 2, 3], 'model');

      const results = await provider.search([1, 2, 3], 10);
      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe(maliciousId);
    });

    it('handles malicious ID with SQL injection attempt in delete', async () => {
      await provider.store('keep-me', [1, 2, 3], 'model');
      const maliciousId = "'; DROP TABLE vectors; --";
      await provider.store(maliciousId, [4, 5, 6], 'model');

      await provider.delete(maliciousId);

      // Table should still exist
      const tables = provider.getTableNames();
      expect(tables).toContain('vectors');

      // The legitimate entry should still exist
      const model = await provider.getModel('keep-me');
      expect(model).toBe('model');
    });

    it('handles malicious ID with SQL injection attempt in getModel', async () => {
      await provider.store('legitimate', [1, 2, 3], 'model');

      // Try to inject via getModel query
      const maliciousId = "legitimate' OR '1'='1";
      const model = await provider.getModel(maliciousId);

      // Should return null, not the legitimate entry
      expect(model).toBeNull();
    });

    it('handles malicious ID with SQL injection attempt in hasEmbedding', async () => {
      await provider.store('legitimate', [1, 2, 3], 'model');

      const maliciousId = "legitimate' OR '1'='1";
      const exists = provider.hasEmbedding(maliciousId);

      // Should return false, not true (injection would make it always true)
      expect(exists).toBe(false);
    });
  });

  describe('hasEmbedding', () => {
    it('returns false for non-existent id', () => {
      expect(provider.hasEmbedding('nonexistent')).toBe(false);
    });

    it('returns true for stored embedding', async () => {
      await provider.store('doc1', [0.1, 0.2, 0.3], 'test-model');
      expect(provider.hasEmbedding('doc1')).toBe(true);
    });

    it('returns false after embedding is deleted', async () => {
      await provider.store('doc1', [0.1, 0.2, 0.3], 'test-model');
      await provider.delete('doc1');
      expect(provider.hasEmbedding('doc1')).toBe(false);
    });
  });
});
