import { describe, it, expect, beforeAll } from 'vitest';
import { TransformersEmbedding } from '../../../src/providers/embedding/index.js';
import type { Embedding } from '../../../src/types/provider.js';
import { isEmbeddingProvider } from '../../../src/types/provider.js';

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
    it('implements Embedding interface (compile-time)', () => {
      const _check: Embedding = provider;
      expect(_check).toBeDefined();
    });

    it('passes isEmbeddingProvider runtime check', () => {
      expect(isEmbeddingProvider(provider)).toBe(true);
    });
  });

  describe('modelId()', () => {
    it('returns default model identifier', () => {
      expect(provider.modelId()).toBe('Xenova/all-MiniLM-L6-v2');
    });

    it('returns custom model when specified', () => {
      const custom = new TransformersEmbedding({ model: 'Xenova/paraphrase-MiniLM-L3-v2', dimensions: 384 });
      expect(custom.modelId()).toBe('Xenova/paraphrase-MiniLM-L3-v2');
    });
  });

  describe('dimensions()', () => {
    it('returns 384 for default model', () => {
      expect(provider.dimensions()).toBe(384);
    });

    it('returns custom dimensions when specified', () => {
      const custom = new TransformersEmbedding({ model: 'Xenova/some-model', dimensions: 768 });
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

  describe('unicode input', () => {
    it('embeds CJK text without throwing', async () => {
      const embedding = await provider.embed('日本語ノート');
      expect(embedding).toHaveLength(384);
      expect(embedding.every((v) => Number.isFinite(v))).toBe(true);
    }, 60000);

    it('embeds emoji text', async () => {
      const embedding = await provider.embed('🚀 Launch Day ☕');
      expect(embedding).toHaveLength(384);
      expect(embedding.every((v) => Number.isFinite(v))).toBe(true);
    }, 60000);

    it('embeds mixed scripts', async () => {
      const embedding = await provider.embed('Hello世界 Café');
      expect(embedding).toHaveLength(384);
      expect(embedding.every((v) => Number.isFinite(v))).toBe(true);
    }, 60000);

    it('embeds combining characters', async () => {
      // e + combining acute accent
      const embedding = await provider.embed('Caf\u0065\u0301');
      expect(embedding).toHaveLength(384);
      expect(embedding.every((v) => Number.isFinite(v))).toBe(true);
    }, 60000);

    it('returns normalized vector for unicode input', async () => {
      const embedding = await provider.embed('日本語ノート');
      const magnitude = Math.sqrt(
        embedding.reduce((sum, val) => sum + val * val, 0)
      );
      expect(magnitude).toBeCloseTo(1, 2);
    }, 60000);
  });

  describe('pipeline caching', () => {
    it('reuses pipeline across multiple calls', async () => {
      // Access private pipeline via instance for spying
      // We verify caching by checking that pipeline() is only called once
      const p = new TransformersEmbedding();

      // First embed call - initializes pipeline
      await p.embed('first call');

      // The pipe property is now set - verify it exists and reuse works
      // by checking that subsequent calls don't change the cached reference
      const pipeRef = (p as unknown as { pipe: unknown }).pipe;
      expect(pipeRef).not.toBeNull();

      // Second call should reuse the same pipeline instance
      await p.embed('second call');
      const pipeRefAfter = (p as unknown as { pipe: unknown }).pipe;

      // Same reference means pipeline was reused, not recreated
      expect(pipeRefAfter).toBe(pipeRef);
    }, 60000);
  });

  describe('pipeline initialization errors', () => {
    it('propagates error when model cannot be loaded', async () => {
      // Use a model name that definitely doesn't exist
      const invalidProvider = new TransformersEmbedding({
        model: 'Xenova/nonexistent-model-that-will-fail-12345',
        dimensions: 384,
      });

      // First embed() call triggers pipeline initialization
      await expect(invalidProvider.embed('test')).rejects.toThrow();
    }, 60000);

    it('propagates error in embedBatch when model cannot be loaded', async () => {
      const invalidProvider = new TransformersEmbedding({
        model: 'Xenova/another-fake-model-xyz',
        dimensions: 384,
      });

      await expect(invalidProvider.embedBatch(['test'])).rejects.toThrow();
    }, 60000);

    it('subsequent calls also fail after initialization error', async () => {
      const invalidProvider = new TransformersEmbedding({
        model: 'Xenova/broken-model-abc',
        dimensions: 384,
      });

      // First call fails
      await expect(invalidProvider.embed('first')).rejects.toThrow();

      // Second call should also fail (not hang or crash)
      await expect(invalidProvider.embed('second')).rejects.toThrow();
    }, 60000);
  });
});
