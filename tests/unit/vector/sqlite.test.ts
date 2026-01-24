import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteVectorProvider } from '../../../src/providers/vector/index.js';

describe('SqliteVectorProvider', () => {
  let tempDir: string;
  let provider: SqliteVectorProvider;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'roux-vector-test-'));
    provider = new SqliteVectorProvider(tempDir);
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

      const providerWithDb = new SqliteVectorProvider(db);

      await providerWithDb.store('test', [1, 2, 3], 'model');
      const model = await providerWithDb.getModel('test');
      expect(model).toBe('model');

      providerWithDb.close();
    });
  });
});
