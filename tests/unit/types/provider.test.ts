import { describe, it, expect } from 'vitest';
import {
  isVectorProvider,
  type VectorProvider,
  type VectorSearchResult,
} from '../../../src/types/provider.js';

describe('isVectorProvider', () => {
  const validProvider: VectorProvider = {
    store: async (_id: string, _vector: number[], _model: string) => {},
    search: async (_vector: number[], _limit: number): Promise<VectorSearchResult[]> => [],
    delete: async (_id: string) => {},
    getModel: async (_id: string): Promise<string | null> => null,
    hasEmbedding: (_id: string): boolean => false,
  };

  it('returns true for valid provider with all methods', () => {
    expect(isVectorProvider(validProvider)).toBe(true);
  });

  it('returns true when methods return expected types', async () => {
    const provider: VectorProvider = {
      store: async () => {},
      search: async () => [{ id: 'node-1', distance: 0.5 }],
      delete: async () => {},
      getModel: async () => 'text-embedding-3-small',
      hasEmbedding: () => true,
    };
    expect(isVectorProvider(provider)).toBe(true);

    // Verify return types work correctly
    const results = await provider.search([], 10);
    expect(results[0].id).toBe('node-1');
    expect(results[0].distance).toBe(0.5);

    const model = await provider.getModel('test');
    expect(model).toBe('text-embedding-3-small');
  });

  it('returns false for null', () => {
    expect(isVectorProvider(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isVectorProvider(undefined)).toBe(false);
  });

  it('returns false for primitive values', () => {
    expect(isVectorProvider('string')).toBe(false);
    expect(isVectorProvider(42)).toBe(false);
    expect(isVectorProvider(true)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(isVectorProvider({})).toBe(false);
  });

  it('returns false when store is missing', () => {
    const { store: _, ...noStore } = validProvider;
    expect(isVectorProvider(noStore)).toBe(false);
  });

  it('returns false when store is not a function', () => {
    expect(isVectorProvider({ ...validProvider, store: 'not-a-function' })).toBe(false);
  });

  it('returns false when search is missing', () => {
    const { search: _, ...noSearch } = validProvider;
    expect(isVectorProvider(noSearch)).toBe(false);
  });

  it('returns false when search is not a function', () => {
    expect(isVectorProvider({ ...validProvider, search: null })).toBe(false);
  });

  it('returns false when delete is missing', () => {
    const { delete: _, ...noDelete } = validProvider;
    expect(isVectorProvider(noDelete)).toBe(false);
  });

  it('returns false when delete is not a function', () => {
    expect(isVectorProvider({ ...validProvider, delete: 123 })).toBe(false);
  });

  it('returns false when getModel is missing', () => {
    const { getModel: _, ...noGetModel } = validProvider;
    expect(isVectorProvider(noGetModel)).toBe(false);
  });

  it('returns false when getModel is not a function', () => {
    expect(isVectorProvider({ ...validProvider, getModel: {} })).toBe(false);
  });

  it('returns false when hasEmbedding is missing', () => {
    const { hasEmbedding: _, ...noHasEmbedding } = validProvider;
    expect(isVectorProvider(noHasEmbedding)).toBe(false);
  });

  it('returns false when hasEmbedding is not a function', () => {
    expect(isVectorProvider({ ...validProvider, hasEmbedding: 'nope' })).toBe(false);
  });
});
