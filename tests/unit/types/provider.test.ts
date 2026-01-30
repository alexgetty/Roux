import { describe, it, expect } from 'vitest';
import {
  isVectorIndex,
  isStoreProvider,
  isEmbeddingProvider,
  type VectorIndex,
  type VectorSearchResult,
  type Store,
  type Embedding,
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

describe('isStoreProvider', () => {
  // Note: Type guards use duck typing - extra properties are allowed.
  // This matches TypeScript's structural type system.
  const validStore = {
    id: 'test-store',
    createNode: async () => {},
    updateNode: async () => {},
    deleteNode: async () => {},
    getNode: async () => null,
    getNodes: async () => [],
    getNeighbors: async () => [],
    findPath: async () => null,
    getHubs: async () => [],
    storeEmbedding: async () => {},
    searchByVector: async () => [],
    searchByTags: async () => [],
    getRandomNode: async () => null,
    resolveTitles: async () => new Map(),
    listNodes: async () => ({ nodes: [], total: 0 }),
    resolveNodes: async () => [],
    nodesExist: async () => new Map(),
  };

  it('returns true for valid store provider', () => {
    expect(isStoreProvider(validStore)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isStoreProvider(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isStoreProvider(undefined)).toBe(false);
  });

  it('returns false for primitive values', () => {
    expect(isStoreProvider('string')).toBe(false);
    expect(isStoreProvider(42)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(isStoreProvider({})).toBe(false);
  });

  // Exhaustive test for all 16 Store methods
  const storeMethods = [
    'createNode',
    'updateNode',
    'deleteNode',
    'getNode',
    'getNodes',
    'getNeighbors',
    'findPath',
    'getHubs',
    'storeEmbedding',
    'searchByVector',
    'searchByTags',
    'getRandomNode',
    'resolveTitles',
    'listNodes',
    'resolveNodes',
    'nodesExist',
  ] as const;

  it.each(storeMethods)('returns false when %s is missing', (method) => {
    const { [method]: _, ...partial } = validStore;
    expect(isStoreProvider(partial)).toBe(false);
  });

  it.each(storeMethods)('returns false when %s is not a function', (method) => {
    expect(isStoreProvider({ ...validStore, [method]: 'not-a-function' })).toBe(
      false
    );
  });

  // ID validation tests (Phase 1 of plugin architecture prep)
  describe('id validation', () => {
    // Create a store with all methods for id tests
    const storeWithAllMethods = {
      createNode: async () => {},
      updateNode: async () => {},
      deleteNode: async () => {},
      getNode: async () => null,
      getNodes: async () => [],
      getNeighbors: async () => [],
      findPath: async () => null,
      getHubs: async () => [],
      storeEmbedding: async () => {},
      searchByVector: async () => [],
      searchByTags: async () => [],
      getRandomNode: async () => null,
      resolveTitles: async () => new Map(),
      listNodes: async () => ({ nodes: [], total: 0 }),
      resolveNodes: async () => [],
      nodesExist: async () => new Map(),
    };

    it('returns false when id is missing', () => {
      expect(isStoreProvider(storeWithAllMethods)).toBe(false);
    });

    it('returns false when id is empty string', () => {
      expect(isStoreProvider({ ...storeWithAllMethods, id: '' })).toBe(false);
    });

    it('returns false when id is not a string', () => {
      expect(isStoreProvider({ ...storeWithAllMethods, id: 123 })).toBe(false);
      expect(isStoreProvider({ ...storeWithAllMethods, id: null })).toBe(false);
      expect(isStoreProvider({ ...storeWithAllMethods, id: undefined })).toBe(false);
    });

    it('returns false when id is whitespace only', () => {
      expect(isStoreProvider({ ...storeWithAllMethods, id: '   ' })).toBe(false);
      expect(isStoreProvider({ ...storeWithAllMethods, id: '\t\n' })).toBe(false);
    });

    it('returns true when id is a non-empty string', () => {
      expect(isStoreProvider({ ...storeWithAllMethods, id: 'my-store' })).toBe(true);
    });
  });
});

describe('isEmbeddingProvider', () => {
  // Note: Type guards use duck typing - extra properties are allowed.
  // This matches TypeScript's structural type system.
  const validEmbedding = {
    id: 'test-embedding',
    embed: async () => [],
    embedBatch: async () => [],
    dimensions: () => 384,
    modelId: () => 'test-model',
  };

  it('returns true for valid embedding provider', () => {
    expect(isEmbeddingProvider(validEmbedding)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isEmbeddingProvider(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isEmbeddingProvider(undefined)).toBe(false);
  });

  it('returns false for primitive values', () => {
    expect(isEmbeddingProvider('string')).toBe(false);
    expect(isEmbeddingProvider(42)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(isEmbeddingProvider({})).toBe(false);
  });

  // Exhaustive test for all 4 Embedding methods
  const embeddingMethods = ['embed', 'embedBatch', 'dimensions', 'modelId'] as const;

  it.each(embeddingMethods)('returns false when %s is missing', (method) => {
    const { [method]: _, ...partial } = validEmbedding;
    expect(isEmbeddingProvider(partial)).toBe(false);
  });

  it.each(embeddingMethods)('returns false when %s is not a function', (method) => {
    expect(
      isEmbeddingProvider({ ...validEmbedding, [method]: 'not-a-function' })
    ).toBe(false);
  });

  // ID validation tests (Phase 1 of plugin architecture prep)
  describe('id validation', () => {
    const embeddingWithAllMethods = {
      embed: async () => [],
      embedBatch: async () => [],
      dimensions: () => 384,
      modelId: () => 'test-model',
    };

    it('returns false when id is missing', () => {
      expect(isEmbeddingProvider(embeddingWithAllMethods)).toBe(false);
    });

    it('returns false when id is empty string', () => {
      expect(isEmbeddingProvider({ ...embeddingWithAllMethods, id: '' })).toBe(false);
    });

    it('returns false when id is not a string', () => {
      expect(isEmbeddingProvider({ ...embeddingWithAllMethods, id: 123 })).toBe(false);
      expect(isEmbeddingProvider({ ...embeddingWithAllMethods, id: null })).toBe(false);
      expect(isEmbeddingProvider({ ...embeddingWithAllMethods, id: undefined })).toBe(false);
    });

    it('returns false when id is whitespace only', () => {
      expect(isEmbeddingProvider({ ...embeddingWithAllMethods, id: '   ' })).toBe(false);
      expect(isEmbeddingProvider({ ...embeddingWithAllMethods, id: '\t\n' })).toBe(false);
    });

    it('returns true when id is a non-empty string', () => {
      expect(isEmbeddingProvider({ ...embeddingWithAllMethods, id: 'my-embedding' })).toBe(true);
    });
  });
});
