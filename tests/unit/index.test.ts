import { describe, it, expect } from 'vitest';
import { VERSION } from '../../src/index.js';

describe('roux', () => {
  it('exports VERSION as semver string', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('naming convention exports', () => {
  it('exports StoreProvider abstract class', async () => {
    const mod = await import('../../src/index.js');
    expect(mod).toHaveProperty('StoreProvider');
    expect(typeof mod.StoreProvider).toBe('function');
  });

  it('exports Embedding interface (renamed from EmbeddingProvider)', async () => {
    const mod = await import('../../src/index.js');
    expect(mod).not.toHaveProperty('EmbeddingProvider');
  });

  it('exports VectorIndex interface (renamed from VectorProvider)', async () => {
    const mod = await import('../../src/index.js');
    expect(mod).not.toHaveProperty('VectorProvider');
  });

  it('exports isVectorIndex type guard (renamed from isVectorProvider)', async () => {
    const mod = await import('../../src/index.js');
    expect(mod).toHaveProperty('isVectorIndex');
    expect(typeof mod.isVectorIndex).toBe('function');
    expect(mod).not.toHaveProperty('isVectorProvider');
  });

  it('exports TransformersEmbedding class (renamed from TransformersEmbeddingProvider)', async () => {
    const mod = await import('../../src/index.js');
    expect(mod).toHaveProperty('TransformersEmbedding');
    expect(mod).not.toHaveProperty('TransformersEmbeddingProvider');
  });

  it('exports SqliteVectorIndex class (renamed from SqliteVectorProvider)', async () => {
    const mod = await import('../../src/index.js');
    expect(mod).toHaveProperty('SqliteVectorIndex');
    expect(mod).not.toHaveProperty('SqliteVectorProvider');
  });
});
