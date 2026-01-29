import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Node, NodeUpdates } from '../../../src/types/node.js';
import type {
  VectorIndex,
  VectorSearchResult,
  ResolveOptions,
} from '../../../src/types/provider.js';
import { StoreProvider } from '../../../src/providers/store/index.js';
import type { StoreProviderOptions } from '../../../src/providers/store/index.js';

// ── Test fixtures ───────────────────────────────────────────────

function makeNode(
  id: string,
  opts?: Partial<Node>,
): Node {
  return {
    id,
    title: opts?.title ?? id,
    content: opts?.content ?? '',
    tags: opts?.tags ?? [],
    outgoingLinks: opts?.outgoingLinks ?? [],
    properties: opts?.properties ?? {},
  };
}

function makeMockVectorIndex(): VectorIndex {
  return {
    store: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
    getModel: vi.fn().mockResolvedValue(null),
    hasEmbedding: vi.fn().mockReturnValue(false),
  };
}

// ── Concrete test subclass ──────────────────────────────────────

class TestStore extends StoreProvider {
  readonly nodes = new Map<string, Node>();
  closed = false;
  lastCentrality: Map<string, unknown> | null = null;

  // Abstract implementations

  protected async loadAllNodes(): Promise<Node[]> {
    return [...this.nodes.values()];
  }

  protected async getNodesByIds(ids: string[]): Promise<Node[]> {
    return ids.map(id => this.nodes.get(id)).filter((n): n is Node => n !== undefined);
  }

  async createNode(node: Node): Promise<void> {
    this.nodes.set(node.id, node);
  }

  async updateNode(id: string, updates: NodeUpdates): Promise<void> {
    const existing = this.nodes.get(id);
    if (!existing) return;
    this.nodes.set(id, { ...existing, ...updates, id });
  }

  async deleteNode(id: string): Promise<void> {
    this.nodes.delete(id);
  }

  async getNode(id: string): Promise<Node | null> {
    return this.nodes.get(id) ?? null;
  }

  async getNodes(ids: string[]): Promise<Node[]> {
    return this.getNodesByIds(ids);
  }

  close(): void {
    this.closed = true;
  }

  // Expose protected methods for testing

  async callSyncGraph(): Promise<void> {
    return this.syncGraph();
  }

  protected override onCentralityComputed(centrality: Map<string, unknown>): void {
    this.lastCentrality = centrality;
  }
}

// ── Tests ───────────────────────────────────────────────────────

describe('StoreProvider', () => {
  let store: TestStore;

  // Standard 5-node graph:
  //   a -> b -> c
  //   |    |
  //   v    v
  //   d -> e
  const graphNodes = [
    makeNode('a', { outgoingLinks: ['b', 'd'] }),
    makeNode('b', { outgoingLinks: ['c', 'e'] }),
    makeNode('c'),
    makeNode('d', { outgoingLinks: ['e'] }),
    makeNode('e'),
  ];

  beforeEach(() => {
    store = new TestStore();
    for (const n of graphNodes) {
      store.nodes.set(n.id, n);
    }
  });

  // ── Constructor ─────────────────────────────────────────────

  describe('constructor', () => {
    it('accepts no arguments', () => {
      const s = new TestStore();
      expect(s).toBeInstanceOf(StoreProvider);
    });

    it('accepts options with vectorIndex', () => {
      const vi = makeMockVectorIndex();
      const s = new TestStore({ vectorIndex: vi });
      expect(s).toBeInstanceOf(StoreProvider);
    });
  });

  // ── Graph operations ────────────────────────────────────────

  describe('graph operations', () => {
    describe('when graph is NOT built', () => {
      it('getNeighbors returns empty array', async () => {
        const result = await store.getNeighbors('a', { direction: 'out' });
        expect(result).toEqual([]);
      });

      it('findPath returns null', async () => {
        const result = await store.findPath('a', 'c');
        expect(result).toBeNull();
      });

      it('getHubs returns empty array', async () => {
        const result = await store.getHubs('in_degree', 5);
        expect(result).toEqual([]);
      });
    });

    describe('when graph IS built', () => {
      beforeEach(async () => {
        await store.callSyncGraph();
      });

      it('getNeighbors returns outgoing neighbor nodes', async () => {
        const result = await store.getNeighbors('a', { direction: 'out' });
        const ids = result.map(n => n.id).sort();
        expect(ids).toEqual(['b', 'd']);
      });

      it('getNeighbors returns incoming neighbor nodes', async () => {
        const result = await store.getNeighbors('e', { direction: 'in' });
        const ids = result.map(n => n.id).sort();
        expect(ids).toEqual(['b', 'd']);
      });

      it('getNeighbors returns both directions', async () => {
        const result = await store.getNeighbors('b', { direction: 'both' });
        const ids = result.map(n => n.id).sort();
        // in: a, out: c, e
        expect(ids).toEqual(['a', 'c', 'e']);
      });

      it('getNeighbors respects limit', async () => {
        const result = await store.getNeighbors('a', { direction: 'out', limit: 1 });
        expect(result).toHaveLength(1);
      });

      it('getNeighbors returns empty for unknown node', async () => {
        const result = await store.getNeighbors('nonexistent', { direction: 'out' });
        expect(result).toEqual([]);
      });

      it('findPath returns shortest path', async () => {
        const result = await store.findPath('a', 'c');
        expect(result).toEqual(['a', 'b', 'c']);
      });

      it('findPath returns null when no path exists', async () => {
        const result = await store.findPath('c', 'a');
        expect(result).toBeNull();
      });

      it('findPath returns single node for same source/target', async () => {
        const result = await store.findPath('a', 'a');
        expect(result).toEqual(['a']);
      });

      it('getHubs returns nodes sorted by in_degree', async () => {
        const result = await store.getHubs('in_degree', 3);
        expect(result[0]).toEqual(['e', 2]);
      });

      it('getHubs returns nodes sorted by out_degree', async () => {
        const result = await store.getHubs('out_degree', 2);
        expect(result[0]).toEqual(['a', 2]);
        expect(result[1]).toEqual(['b', 2]);
      });

      it('getHubs respects limit', async () => {
        const result = await store.getHubs('in_degree', 1);
        expect(result).toHaveLength(1);
      });
    });
  });

  // ── Vector operations ───────────────────────────────────────

  describe('vector operations', () => {
    describe('with VectorIndex configured', () => {
      let mockVI: VectorIndex;
      let vectorStore: TestStore;

      beforeEach(() => {
        mockVI = makeMockVectorIndex();
        vectorStore = new TestStore({ vectorIndex: mockVI });
      });

      it('storeEmbedding delegates to vectorIndex.store', async () => {
        await vectorStore.storeEmbedding('node-1', [0.1, 0.2], 'model-a');
        expect(mockVI.store).toHaveBeenCalledWith('node-1', [0.1, 0.2], 'model-a');
      });

      it('searchByVector delegates to vectorIndex.search', async () => {
        const expected: VectorSearchResult[] = [{ id: 'node-1', distance: 0.5 }];
        (mockVI.search as ReturnType<typeof vi.fn>).mockResolvedValue(expected);

        const result = await vectorStore.searchByVector([0.1, 0.2], 10);
        expect(mockVI.search).toHaveBeenCalledWith([0.1, 0.2], 10);
        expect(result).toEqual(expected);
      });
    });

    describe('without VectorIndex', () => {
      it('storeEmbedding throws', async () => {
        await expect(store.storeEmbedding('id', [1], 'm')).rejects.toThrow(
          'No VectorIndex configured',
        );
      });

      it('searchByVector throws', async () => {
        await expect(store.searchByVector([1], 5)).rejects.toThrow(
          'No VectorIndex configured',
        );
      });
    });
  });

  // ── Default implementations ─────────────────────────────────

  describe('searchByTags', () => {
    beforeEach(() => {
      store.nodes.clear();
      store.nodes.set('r1', makeNode('r1', { tags: ['recipe', 'korean'] }));
      store.nodes.set('r2', makeNode('r2', { tags: ['recipe', 'japanese'] }));
      store.nodes.set('n1', makeNode('n1', { tags: ['note'] }));
    });

    it('mode "any" matches nodes with at least one tag', async () => {
      const result = await store.searchByTags(['korean', 'japanese'], 'any');
      const ids = result.map(n => n.id).sort();
      expect(ids).toEqual(['r1', 'r2']);
    });

    it('mode "all" matches nodes with all tags', async () => {
      const result = await store.searchByTags(['recipe', 'korean'], 'all');
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('r1');
    });

    it('is case-insensitive', async () => {
      const result = await store.searchByTags(['RECIPE'], 'any');
      const ids = result.map(n => n.id).sort();
      expect(ids).toEqual(['r1', 'r2']);
    });

    it('returns empty when no match', async () => {
      const result = await store.searchByTags(['nonexistent'], 'any');
      expect(result).toEqual([]);
    });

    it('respects limit', async () => {
      const result = await store.searchByTags(['recipe'], 'any', 1);
      expect(result).toHaveLength(1);
    });
  });

  describe('listNodes', () => {
    beforeEach(() => {
      store.nodes.clear();
      store.nodes.set('recipes/a.md', makeNode('recipes/a.md', { title: 'A', tags: ['recipe'] }));
      store.nodes.set('recipes/b.md', makeNode('recipes/b.md', { title: 'B', tags: ['recipe'] }));
      store.nodes.set('notes/c.md', makeNode('notes/c.md', { title: 'C', tags: ['note'] }));
    });

    it('returns all nodes with empty filter', async () => {
      const result = await store.listNodes({});
      expect(result.total).toBe(3);
      expect(result.nodes).toHaveLength(3);
    });

    it('filters by tag', async () => {
      const result = await store.listNodes({ tag: 'recipe' });
      expect(result.total).toBe(2);
      expect(result.nodes.every(n => n.id.startsWith('recipes/'))).toBe(true);
    });

    it('tag filter is case-insensitive', async () => {
      const result = await store.listNodes({ tag: 'RECIPE' });
      expect(result.total).toBe(2);
    });

    it('filters by path prefix', async () => {
      const result = await store.listNodes({ path: 'notes/' });
      expect(result.total).toBe(1);
      expect(result.nodes[0]!.id).toBe('notes/c.md');
    });

    it('path filter is case-insensitive', async () => {
      const lower = await store.listNodes({ path: 'recipes/' });
      const upper = await store.listNodes({ path: 'Recipes/' });
      const mixed = await store.listNodes({ path: 'RECIPES/' });
      expect(lower.total).toBe(2);
      expect(upper.total).toBe(2);
      expect(mixed.total).toBe(2);
    });

    it('combines tag and path filters', async () => {
      const result = await store.listNodes({ tag: 'recipe', path: 'recipes/' });
      expect(result.total).toBe(2);
    });

    it('returns NodeSummary objects', async () => {
      const result = await store.listNodes({});
      for (const node of result.nodes) {
        expect(node).toHaveProperty('id');
        expect(node).toHaveProperty('title');
        expect(Object.keys(node).sort()).toEqual(['id', 'title']);
      }
    });

    it('applies offset', async () => {
      const result = await store.listNodes({}, { offset: 1 });
      expect(result.nodes).toHaveLength(2);
      expect(result.total).toBe(3);
    });

    it('applies limit', async () => {
      const result = await store.listNodes({}, { limit: 1 });
      expect(result.nodes).toHaveLength(1);
      expect(result.total).toBe(3);
    });

    it('applies offset + limit together', async () => {
      const result = await store.listNodes({}, { offset: 1, limit: 1 });
      expect(result.nodes).toHaveLength(1);
      expect(result.total).toBe(3);
    });

    it('clamps limit to max 1000', async () => {
      const result = await store.listNodes({}, { limit: 5000 });
      // Should not throw, just caps at 1000
      expect(result.total).toBe(3);
    });

    it('defaults limit to 100', async () => {
      // With only 3 nodes, default limit of 100 returns all
      const result = await store.listNodes({});
      expect(result.nodes).toHaveLength(3);
    });
  });

  describe('nodesExist', () => {
    it('returns true for existing nodes', async () => {
      const result = await store.nodesExist(['a', 'b']);
      expect(result.get('a')).toBe(true);
      expect(result.get('b')).toBe(true);
    });

    it('returns false for missing nodes', async () => {
      const result = await store.nodesExist(['a', 'missing']);
      expect(result.get('a')).toBe(true);
      expect(result.get('missing')).toBe(false);
    });

    it('returns empty map for empty input', async () => {
      const result = await store.nodesExist([]);
      expect(result.size).toBe(0);
    });

    it('returns Map with all queried ids as keys', async () => {
      const result = await store.nodesExist(['a', 'b', 'zzz']);
      expect(result.size).toBe(3);
      expect([...result.keys()].sort()).toEqual(['a', 'b', 'zzz']);
    });
  });

  describe('resolveTitles', () => {
    it('returns map of id to title', async () => {
      const result = await store.resolveTitles(['a', 'b']);
      expect(result.get('a')).toBe('a');
      expect(result.get('b')).toBe('b');
    });

    it('skips missing nodes', async () => {
      const result = await store.resolveTitles(['a', 'nope']);
      expect(result.size).toBe(1);
      expect(result.has('nope')).toBe(false);
    });

    it('returns empty map for empty input', async () => {
      const result = await store.resolveTitles([]);
      expect(result.size).toBe(0);
    });
  });

  describe('resolveNodes', () => {
    beforeEach(() => {
      store.nodes.clear();
      store.nodes.set('recipes/bulgogi.md', makeNode('recipes/bulgogi.md', {
        title: 'Bulgogi',
        tags: ['recipe'],
      }));
      store.nodes.set('recipes/bibimbap.md', makeNode('recipes/bibimbap.md', {
        title: 'Bibimbap',
        tags: ['recipe'],
      }));
      store.nodes.set('notes/cooking.md', makeNode('notes/cooking.md', {
        title: 'Cooking Notes',
        tags: ['note'],
      }));
    });

    it('exact strategy: matches exact title', async () => {
      const result = await store.resolveNodes(['Bulgogi'], { strategy: 'exact' });
      expect(result).toHaveLength(1);
      expect(result[0]!.query).toBe('Bulgogi');
      expect(result[0]!.match).toBe('recipes/bulgogi.md');
      expect(result[0]!.score).toBe(1);
    });

    it('exact strategy: case-insensitive', async () => {
      const result = await store.resolveNodes(['bulgogi'], { strategy: 'exact' });
      expect(result[0]!.match).toBe('recipes/bulgogi.md');
    });

    it('exact strategy: no match returns null', async () => {
      const result = await store.resolveNodes(['sushi'], { strategy: 'exact' });
      expect(result[0]!.match).toBeNull();
      expect(result[0]!.score).toBe(0);
    });

    it('fuzzy strategy: finds close matches', async () => {
      const result = await store.resolveNodes(['bulogi'], { strategy: 'fuzzy', threshold: 0.5 });
      expect(result[0]!.match).toBe('recipes/bulgogi.md');
      expect(result[0]!.score).toBeGreaterThan(0.5);
    });

    it('fuzzy strategy: is default', async () => {
      const result = await store.resolveNodes(['Bulgogi']);
      expect(result[0]!.match).toBe('recipes/bulgogi.md');
    });

    it('semantic strategy: returns no matches (not supported at base level)', async () => {
      const result = await store.resolveNodes(['Korean BBQ'], { strategy: 'semantic' });
      expect(result[0]!.match).toBeNull();
      expect(result[0]!.score).toBe(0);
    });

    it('filters by tag option', async () => {
      const result = await store.resolveNodes(['Cooking Notes'], {
        strategy: 'exact',
        tag: 'recipe',
      });
      // "Cooking Notes" exists but has tag "note", not "recipe"
      expect(result[0]!.match).toBeNull();
    });

    it('filters by path option', async () => {
      const result = await store.resolveNodes(['Cooking Notes'], {
        strategy: 'exact',
        path: 'recipes/',
      });
      expect(result[0]!.match).toBeNull();
    });

    it('resolves multiple names', async () => {
      const result = await store.resolveNodes(['Bulgogi', 'Bibimbap'], { strategy: 'exact' });
      expect(result).toHaveLength(2);
      expect(result[0]!.match).toBe('recipes/bulgogi.md');
      expect(result[1]!.match).toBe('recipes/bibimbap.md');
    });
  });

  // ── getRandomNode ───────────────────────────────────────────

  describe('getRandomNode', () => {
    it('returns a node from the store', async () => {
      const result = await store.getRandomNode();
      expect(result).not.toBeNull();
      expect(store.nodes.has(result!.id)).toBe(true);
    });

    it('returns null from empty store', async () => {
      store.nodes.clear();
      const result = await store.getRandomNode();
      expect(result).toBeNull();
    });

    it('filters by tags when provided', async () => {
      store.nodes.clear();
      store.nodes.set('r1', makeNode('r1', { tags: ['recipe'] }));
      store.nodes.set('n1', makeNode('n1', { tags: ['note'] }));

      // Run multiple times to increase confidence
      for (let i = 0; i < 20; i++) {
        const result = await store.getRandomNode(['recipe']);
        expect(result).not.toBeNull();
        expect(result!.id).toBe('r1');
      }
    });

    it('returns null when tag filter matches nothing', async () => {
      const result = await store.getRandomNode(['nonexistent-tag']);
      expect(result).toBeNull();
    });
  });

  // ── syncGraph + onCentralityComputed ────────────────────────

  describe('syncGraph', () => {
    it('builds the graph from loadAllNodes', async () => {
      // Before sync, graph ops degrade gracefully
      expect(await store.getNeighbors('a', { direction: 'out' })).toEqual([]);

      await store.callSyncGraph();

      // After sync, graph ops work
      const neighbors = await store.getNeighbors('a', { direction: 'out' });
      expect(neighbors.map(n => n.id).sort()).toEqual(['b', 'd']);
    });

    it('calls onCentralityComputed with centrality map', async () => {
      expect(store.lastCentrality).toBeNull();

      await store.callSyncGraph();

      expect(store.lastCentrality).toBeInstanceOf(Map);
      expect(store.lastCentrality!.size).toBe(5);
    });

    it('base onCentralityComputed is a no-op', async () => {
      // Use a subclass that does NOT override onCentralityComputed
      class BaseOnlyStore extends StoreProvider {
        readonly nodes = new Map<string, Node>();
        protected async loadAllNodes(): Promise<Node[]> { return [...this.nodes.values()]; }
        protected async getNodesByIds(ids: string[]): Promise<Node[]> { return ids.map(id => this.nodes.get(id)).filter((n): n is Node => n !== undefined); }
        async createNode(node: Node): Promise<void> { this.nodes.set(node.id, node); }
        async updateNode(): Promise<void> {}
        async deleteNode(): Promise<void> {}
        async getNode(id: string): Promise<Node | null> { return this.nodes.get(id) ?? null; }
        async getNodes(ids: string[]): Promise<Node[]> { return this.getNodesByIds(ids); }
        close(): void {}
        async callSyncGraph(): Promise<void> { return this.syncGraph(); }
      }

      const baseStore = new BaseOnlyStore({ vectorIndex: makeMockVectorIndex() });
      // Should not throw — the base no-op simply does nothing
      await expect(baseStore.callSyncGraph()).resolves.not.toThrow();
    });
  });

  // ── close (abstract, implemented by subclass) ───────────────

  describe('close', () => {
    it('is callable on the subclass', () => {
      store.close();
      expect(store.closed).toBe(true);
    });
  });

  // ── Abstract method enforcement ─────────────────────────────

  describe('abstract methods', () => {
    it('TestStore implements all abstract methods', () => {
      // Verify that all Store interface CRUD methods exist
      expect(typeof store.createNode).toBe('function');
      expect(typeof store.updateNode).toBe('function');
      expect(typeof store.deleteNode).toBe('function');
      expect(typeof store.getNode).toBe('function');
      expect(typeof store.getNodes).toBe('function');
      expect(typeof store.close).toBe('function');
    });
  });

  // ── CRUD through abstract methods ───────────────────────────

  describe('CRUD via abstract methods', () => {
    it('createNode adds a node', async () => {
      const node = makeNode('new', { title: 'New Node' });
      await store.createNode(node);
      expect(store.nodes.has('new')).toBe(true);
    });

    it('updateNode modifies a node', async () => {
      await store.updateNode('a', { title: 'Updated A' });
      expect(store.nodes.get('a')!.title).toBe('Updated A');
    });

    it('deleteNode removes a node', async () => {
      await store.deleteNode('a');
      expect(store.nodes.has('a')).toBe(false);
    });

    it('getNode returns existing node', async () => {
      const result = await store.getNode('a');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('a');
    });

    it('getNode returns null for missing', async () => {
      const result = await store.getNode('nonexistent');
      expect(result).toBeNull();
    });

    it('getNodes returns multiple nodes', async () => {
      const result = await store.getNodes(['a', 'b']);
      expect(result).toHaveLength(2);
    });
  });
});
