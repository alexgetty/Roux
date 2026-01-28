import { describe, it, expect, beforeAll } from 'vitest';
import { TransformersEmbedding } from '../../../src/providers/embedding/index.js';
import type { Embedding } from '../../../src/types/provider.js';

/**
 * These tests require model download on first run (~90MB).
 * Cached in ~/.cache/transformers/ after first download.
 */
describe('TransformersEmbedding', () => {
  let provider: TransformersEmbedding;

  beforeAll(() => {
    provider = new TransformersEmbedding();
  });

  describe('interface compliance', () => {
    it('implements Embedding interface', () => {
      const _check: Embedding = provider;
      expect(_check).toBeDefined();
    });
  });

  describe('modelId()', () => {
    it('returns default model identifier', () => {
      expect(provider.modelId()).toBe('Xenova/all-MiniLM-L6-v2');
    });

    it('returns custom model when specified', () => {
      const custom = new TransformersEmbedding('Xenova/paraphrase-MiniLM-L3-v2', 384);
      expect(custom.modelId()).toBe('Xenova/paraphrase-MiniLM-L3-v2');
    });
  });

  describe('dimensions()', () => {
    it('returns 384 for default model', () => {
      expect(provider.dimensions()).toBe(384);
    });

    it('returns custom dimensions when specified', () => {
      const custom = new TransformersEmbedding('Xenova/some-model', 768);
      expect(custom.dimensions()).toBe(768);
    });
  });

  describe('embed()', () => {
    it('returns array of correct length', async () => {
      const embedding = await provider.embed('test text');
      expect(embedding).toHaveLength(384);
    }, 60000);

    it('handles empty string input', async () => {
      const embedding = await provider.embed('');
      expect(embedding).toHaveLength(384);
      expect(embedding.every((v) => Number.isFinite(v))).toBe(true);
    }, 60000);

    it('handles very long input without throwing', async () => {
      const longText = 'a'.repeat(10000);
      const embedding = await provider.embed(longText);
      expect(embedding).toHaveLength(384);
      // Verify normalized (magnitude ~1)
      const magnitude = Math.sqrt(
        embedding.reduce((sum, val) => sum + val * val, 0)
      );
      expect(magnitude).toBeCloseTo(1, 1);
    }, 60000);

    it('returns normalized vector (magnitude approximately 1)', async () => {
      const embedding = await provider.embed('hello world');
      const magnitude = Math.sqrt(
        embedding.reduce((sum, val) => sum + val * val, 0)
      );
      expect(magnitude).toBeCloseTo(1, 2);
    }, 60000);

    it('returns number[] not Float32Array', async () => {
      const embedding = await provider.embed('array type check');
      expect(Array.isArray(embedding)).toBe(true);
      expect(typeof embedding[0]).toBe('number');
    }, 60000);
  });

  describe('embedBatch()', () => {
    it('returns correct number of vectors', async () => {
      const texts = ['first text', 'second text', 'third text'];
      const embeddings = await provider.embedBatch(texts);
      expect(embeddings).toHaveLength(3);
    }, 60000);

    it('each vector has correct dimensions', async () => {
      const texts = ['alpha', 'beta'];
      const embeddings = await provider.embedBatch(texts);
      for (const embedding of embeddings) {
        expect(embedding).toHaveLength(384);
      }
    }, 60000);

    it('returns empty array for empty input', async () => {
      const embeddings = await provider.embedBatch([]);
      expect(embeddings).toEqual([]);
    }, 60000);
  });

  describe('semantic similarity', () => {
    const cosineSimilarity = (a: number[], b: number[]): number => {
      let dot = 0;
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
      }
      return dot;
    };

    it('similar texts have high similarity (> 0.5)', async () => {
      const [embedding1, embedding2] = await provider.embedBatch([
        'The cat sat on the mat',
        'A cat was sitting on a rug',
      ]);
      const similarity = cosineSimilarity(embedding1, embedding2);
      expect(similarity).toBeGreaterThan(0.5);
    }, 60000);

    it('dissimilar texts have lower similarity', async () => {
      const [embedding1, embedding2] = await provider.embedBatch([
        'The quick brown fox jumps over the lazy dog',
        'Quantum mechanics describes subatomic particles',
      ]);
      const similarity = cosineSimilarity(embedding1, embedding2);
      expect(similarity).toBeLessThan(0.5);
    }, 60000);
  });

  describe('pipeline caching', () => {
    it('reuses pipeline across multiple calls', async () => {
      const p = new TransformersEmbedding();
      await p.embed('first call');
      const start = performance.now();
      await p.embed('second call');
      const elapsed = performance.now() - start;
      // Second call should be fast (no model loading)
      expect(elapsed).toBeLessThan(5000);
    }, 60000);
  });
});
