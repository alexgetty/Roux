import { describe, it, expect } from 'vitest';
import {
  isVectorIndex,
  type VectorIndex,
  type VectorSearchResult,
} from '../../../src/types/provider.js';

describe('isVectorIndex', () => {
  const validProvider: VectorIndex = {
    store: async (_id: string, _vector: number[], _model: string) => {},
    search: async (_vector: number[], _limit: number): Promise<VectorSearchResult[]> => [],
    delete: async (_id: string) => {},
    getModel: async (_id: string): Promise<string | null> => null,
    hasEmbedding: (_id: string): boolean => false,
  };

  it('returns true for valid provider with all methods', () => {
    expect(isVectorIndex(validProvider)).toBe(true);
  });

  it('returns true when methods return expected types', async () => {
    const provider: VectorIndex = {
      store: async () => {},
      search: async () => [{ id: 'node-1', distance: 0.5 }],
      delete: async () => {},
      getModel: async () => 'text-embedding-3-small',
      hasEmbedding: () => true,
    };
    expect(isVectorIndex(provider)).toBe(true);

    // Verify return types work correctly
    const results = await provider.search([], 10);
    expect(results[0].id).toBe('node-1');
    expect(results[0].distance).toBe(0.5);

    const model = await provider.getModel('test');
    expect(model).toBe('text-embedding-3-small');
  });

  it('returns false for null', () => {
    expect(isVectorIndex(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isVectorIndex(undefined)).toBe(false);
  });

  it('returns false for primitive values', () => {
    expect(isVectorIndex('string')).toBe(false);
    expect(isVectorIndex(42)).toBe(false);
    expect(isVectorIndex(true)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(isVectorIndex({})).toBe(false);
  });

  it('returns false when store is missing', () => {
    const { store: _, ...noStore } = validProvider;
    expect(isVectorIndex(noStore)).toBe(false);
  });

  it('returns false when store is not a function', () => {
    expect(isVectorIndex({ ...validProvider, store: 'not-a-function' })).toBe(false);
  });

  it('returns false when search is missing', () => {
    const { search: _, ...noSearch } = validProvider;
    expect(isVectorIndex(noSearch)).toBe(false);
  });

  it('returns false when search is not a function', () => {
    expect(isVectorIndex({ ...validProvider, search: null })).toBe(false);
  });

  it('returns false when delete is missing', () => {
    const { delete: _, ...noDelete } = validProvider;
    expect(isVectorIndex(noDelete)).toBe(false);
  });

  it('returns false when delete is not a function', () => {
    expect(isVectorIndex({ ...validProvider, delete: 123 })).toBe(false);
  });

  it('returns false when getModel is missing', () => {
    const { getModel: _, ...noGetModel } = validProvider;
    expect(isVectorIndex(noGetModel)).toBe(false);
  });

  it('returns false when getModel is not a function', () => {
    expect(isVectorIndex({ ...validProvider, getModel: {} })).toBe(false);
  });

  it('returns false when hasEmbedding is missing', () => {
    const { hasEmbedding: _, ...noHasEmbedding } = validProvider;
    expect(isVectorIndex(noHasEmbedding)).toBe(false);
  });

  it('returns false when hasEmbedding is not a function', () => {
    expect(isVectorIndex({ ...validProvider, hasEmbedding: 'nope' })).toBe(false);
  });
});
