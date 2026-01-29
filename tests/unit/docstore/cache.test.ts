import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Cache } from '../../../src/providers/docstore/cache.js';
import type { Node } from '../../../src/types/node.js';

describe('Cache', () => {
  let tempDir: string;
  let cache: Cache;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'roux-cache-test-'));
    cache = new Cache(tempDir);
  });

  afterEach(async () => {
    cache.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  const createNode = (overrides: Partial<Node> = {}): Node => ({
    id: 'test/note.md',
    title: 'Test Note',
    content: 'Some content',
    tags: ['test'],
    outgoingLinks: [],
    properties: {},
    ...overrides,
  });

  describe('initialization', () => {
    it('creates database file in specified directory', async () => {
      const { stat } = await import('node:fs/promises');
      const dbPath = join(tempDir, 'cache.db');
      const stats = await stat(dbPath);
      expect(stats.isFile()).toBe(true);
    });

    it('creates nodes table', () => {
      const tables = cache.getTableNames();
      expect(tables).toContain('nodes');
    });

    it('creates centrality table', () => {
      const tables = cache.getTableNames();
      expect(tables).toContain('centrality');
    });
  });

  describe('node operations', () => {
    describe('upsertNode', () => {
      it('inserts a new node', () => {
        const node = createNode();
        cache.upsertNode(node, 'file', '/path/to/note.md', Date.now());

        const retrieved = cache.getNode('test/note.md');
        expect(retrieved).not.toBeNull();
        expect(retrieved?.id).toBe('test/note.md');
        expect(retrieved?.title).toBe('Test Note');
      });

      it('updates an existing node', () => {
        const node = createNode();
        cache.upsertNode(node, 'file', '/path/to/note.md', Date.now());

        const updated = createNode({ title: 'Updated Title' });
        cache.upsertNode(updated, 'file', '/path/to/note.md', Date.now());

        const retrieved = cache.getNode('test/note.md');
        expect(retrieved?.title).toBe('Updated Title');
      });

      it('stores tags as JSON array', () => {
        const node = createNode({ tags: ['a', 'b', 'c'] });
        cache.upsertNode(node, 'file', '/path.md', Date.now());

        const retrieved = cache.getNode('test/note.md');
        expect(retrieved?.tags).toEqual(['a', 'b', 'c']);
      });

      it('stores outgoingLinks as JSON array', () => {
        const node = createNode({
          outgoingLinks: ['other/note.md', 'another.md'],
        });
        cache.upsertNode(node, 'file', '/path.md', Date.now());

        const retrieved = cache.getNode('test/note.md');
        expect(retrieved?.outgoingLinks).toEqual([
          'other/note.md',
          'another.md',
        ]);
      });

      it('stores properties as JSON object', () => {
        const node = createNode({
          properties: { custom: 'value', nested: { key: 1 } },
        });
        cache.upsertNode(node, 'file', '/path.md', Date.now());

        const retrieved = cache.getNode('test/note.md');
        expect(retrieved?.properties).toEqual({
          custom: 'value',
          nested: { key: 1 },
        });
      });

      it('stores source metadata', () => {
        const node = createNode();
        const modified = Date.now();
        cache.upsertNode(node, 'file', '/path/to/note.md', modified);

        const retrieved = cache.getNode('test/note.md');
        expect(retrieved?.sourceRef?.type).toBe('file');
        expect(retrieved?.sourceRef?.path).toBe('/path/to/note.md');
        expect(retrieved?.sourceRef?.lastModified?.getTime()).toBe(modified);
      });
    });

    describe('getNode', () => {
      it('returns null for non-existent node', () => {
        const result = cache.getNode('does-not-exist.md');
        expect(result).toBeNull();
      });

      it('returns complete node structure', () => {
        const node = createNode({
          id: 'complete.md',
          title: 'Complete',
          content: 'Full content here',
          tags: ['tag1', 'tag2'],
          outgoingLinks: ['link1.md', 'link2.md'],
          properties: { prop: 'value' },
        });
        cache.upsertNode(node, 'file', '/complete.md', Date.now());

        const retrieved = cache.getNode('complete.md');
        expect(retrieved).toMatchObject({
          id: 'complete.md',
          title: 'Complete',
          content: 'Full content here',
          tags: ['tag1', 'tag2'],
          outgoingLinks: ['link1.md', 'link2.md'],
          properties: { prop: 'value' },
        });
      });
    });

    describe('getNodes', () => {
      it('returns empty array for empty ids list', () => {
        const result = cache.getNodes([]);
        expect(result).toEqual([]);
      });

      it('returns multiple nodes in order', () => {
        const node1 = createNode({ id: 'a.md', title: 'A' });
        const node2 = createNode({ id: 'b.md', title: 'B' });
        const node3 = createNode({ id: 'c.md', title: 'C' });

        cache.upsertNode(node1, 'file', '/a.md', Date.now());
        cache.upsertNode(node2, 'file', '/b.md', Date.now());
        cache.upsertNode(node3, 'file', '/c.md', Date.now());

        const result = cache.getNodes(['b.md', 'a.md', 'c.md']);
        expect(result.map((n) => n.id)).toEqual(['b.md', 'a.md', 'c.md']);
      });

      it('skips non-existent nodes', () => {
        const node = createNode({ id: 'exists.md' });
        cache.upsertNode(node, 'file', '/exists.md', Date.now());

        const result = cache.getNodes(['exists.md', 'missing.md']);
        expect(result).toHaveLength(1);
        expect(result[0]?.id).toBe('exists.md');
      });
    });

    describe('deleteNode', () => {
      it('removes existing node', () => {
        const node = createNode();
        cache.upsertNode(node, 'file', '/path.md', Date.now());

        cache.deleteNode('test/note.md');

        expect(cache.getNode('test/note.md')).toBeNull();
      });

      it('does not throw for non-existent node', () => {
        expect(() => cache.deleteNode('missing.md')).not.toThrow();
      });
    });

    describe('getAllNodes', () => {
      it('returns empty array when no nodes', () => {
        const result = cache.getAllNodes();
        expect(result).toEqual([]);
      });

      it('returns all stored nodes', () => {
        cache.upsertNode(
          createNode({ id: 'a.md' }),
          'file',
          '/a.md',
          Date.now()
        );
        cache.upsertNode(
          createNode({ id: 'b.md' }),
          'file',
          '/b.md',
          Date.now()
        );

        const result = cache.getAllNodes();
        expect(result).toHaveLength(2);
        expect(result.map((n) => n.id).sort()).toEqual(['a.md', 'b.md']);
      });
    });
  });

  describe('tag search', () => {
    beforeEach(() => {
      cache.upsertNode(
        createNode({ id: 'a.md', tags: ['alpha', 'beta'] }),
        'file',
        '/a.md',
        Date.now()
      );
      cache.upsertNode(
        createNode({ id: 'b.md', tags: ['beta', 'gamma'] }),
        'file',
        '/b.md',
        Date.now()
      );
      cache.upsertNode(
        createNode({ id: 'c.md', tags: ['gamma', 'delta'] }),
        'file',
        '/c.md',
        Date.now()
      );
    });

    it('returns empty array when tags array is empty', () => {
      const result = cache.searchByTags([], 'any');
      expect(result).toEqual([]);
    });

    describe('searchByTags with mode "any"', () => {
      it('returns nodes matching any tag', () => {
        const result = cache.searchByTags(['alpha', 'delta'], 'any');
        expect(result.map((n) => n.id).sort()).toEqual(['a.md', 'c.md']);
      });

      it('returns empty array when no matches', () => {
        const result = cache.searchByTags(['nonexistent'], 'any');
        expect(result).toEqual([]);
      });

      it('is case-insensitive', () => {
        const result = cache.searchByTags(['ALPHA', 'Beta'], 'any');
        expect(result.map((n) => n.id).sort()).toEqual(['a.md', 'b.md']);
      });
    });

    describe('searchByTags with limit', () => {
      it('respects limit parameter at SQL level', () => {
        // With 3 nodes tagged 'beta' or 'gamma', limit=2 should return 2
        const result = cache.searchByTags(['beta', 'gamma'], 'any', 2);
        expect(result).toHaveLength(2);
      });

      it('returns all matches when limit not specified', () => {
        const result = cache.searchByTags(['beta', 'gamma'], 'any');
        // a.md has beta, b.md has beta+gamma, c.md has gamma = 3 matches
        expect(result).toHaveLength(3);
      });

      it('returns all matches when limit exceeds match count', () => {
        const result = cache.searchByTags(['alpha'], 'any', 100);
        // Only a.md has alpha
        expect(result).toHaveLength(1);
      });
    });

    describe('searchByTags with mode "all"', () => {
      it('returns only nodes matching all tags', () => {
        const result = cache.searchByTags(['beta', 'gamma'], 'all');
        expect(result.map((n) => n.id)).toEqual(['b.md']);
      });

      it('returns empty array when no node has all tags', () => {
        const result = cache.searchByTags(['alpha', 'gamma'], 'all');
        expect(result).toEqual([]);
      });

      it('is case-insensitive', () => {
        const result = cache.searchByTags(['BETA', 'GAMMA'], 'all');
        expect(result.map((n) => n.id)).toEqual(['b.md']);
      });
    });
  });

  describe('source tracking', () => {
    describe('getModifiedTime', () => {
      it('returns modification time for tracked path', () => {
        const node = createNode();
        const modified = Date.now();
        cache.upsertNode(node, 'file', '/path/to/note.md', modified);

        const result = cache.getModifiedTime('/path/to/note.md');
        expect(result).toBe(modified);
      });

      it('returns null for untracked path', () => {
        const result = cache.getModifiedTime('/unknown/path.md');
        expect(result).toBeNull();
      });
    });

    describe('getNodeByPath', () => {
      it('returns node for tracked path', () => {
        const node = createNode();
        cache.upsertNode(node, 'file', '/path/to/note.md', Date.now());

        const result = cache.getNodeByPath('/path/to/note.md');
        expect(result?.id).toBe('test/note.md');
      });

      it('returns null for untracked path', () => {
        const result = cache.getNodeByPath('/unknown/path.md');
        expect(result).toBeNull();
      });
    });

    describe('getAllTrackedPaths', () => {
      it('returns empty set when no nodes', () => {
        const result = cache.getAllTrackedPaths();
        expect(result.size).toBe(0);
      });

      it('returns all source paths', () => {
        cache.upsertNode(createNode({ id: 'a.md' }), 'file', '/a.md', 1);
        cache.upsertNode(createNode({ id: 'b.md' }), 'file', '/b.md', 2);

        const result = cache.getAllTrackedPaths();
        expect(result).toEqual(new Set(['/a.md', '/b.md']));
      });
    });
  });

  describe('title resolution', () => {
    it('returns map of id to title', () => {
      cache.upsertNode(
        createNode({ id: 'a.md', title: 'Title A' }),
        'file',
        '/a.md',
        1
      );
      cache.upsertNode(
        createNode({ id: 'b.md', title: 'Title B' }),
        'file',
        '/b.md',
        2
      );

      const result = cache.resolveTitles(['a.md', 'b.md']);
      expect(result.get('a.md')).toBe('Title A');
      expect(result.get('b.md')).toBe('Title B');
    });

    it('omits missing nodes from map', () => {
      cache.upsertNode(
        createNode({ id: 'exists.md', title: 'Exists' }),
        'file',
        '/e.md',
        1
      );

      const result = cache.resolveTitles(['exists.md', 'missing.md']);
      expect(result.has('exists.md')).toBe(true);
      expect(result.has('missing.md')).toBe(false);
    });

    it('returns empty map for empty input', () => {
      const result = cache.resolveTitles([]);
      expect(result.size).toBe(0);
    });
  });

  describe('centrality storage', () => {
    it('stores and retrieves centrality metrics', () => {
      cache.upsertNode(createNode({ id: 'a.md' }), 'file', '/a.md', 1);

      const now = Date.now();
      cache.storeCentrality('a.md', 0.85, 5, 3, now);

      const retrieved = cache.getCentrality('a.md');
      expect(retrieved?.pagerank).toBe(0.85);
      expect(retrieved?.inDegree).toBe(5);
      expect(retrieved?.outDegree).toBe(3);
      expect(retrieved?.computedAt).toBe(now);
    });

    it('returns null for node without centrality', () => {
      cache.upsertNode(createNode({ id: 'a.md' }), 'file', '/a.md', 1);
      const result = cache.getCentrality('a.md');
      expect(result).toBeNull();
    });

    it('deletes centrality when node is deleted', () => {
      cache.upsertNode(createNode({ id: 'a.md' }), 'file', '/a.md', 1);
      cache.storeCentrality('a.md', 0.5, 1, 2, Date.now());
      cache.deleteNode('a.md');

      const result = cache.getCentrality('a.md');
      expect(result).toBeNull();
    });
  });

  describe('listNodes', () => {
    beforeEach(() => {
      // Set up test data with various tags and paths
      cache.upsertNode(
        createNode({ id: 'recipes/pasta.md', title: 'Pasta', tags: ['recipe', 'italian'] }),
        'file', '/recipes/pasta.md', Date.now()
      );
      cache.upsertNode(
        createNode({ id: 'recipes/pizza.md', title: 'Pizza', tags: ['recipe', 'italian'] }),
        'file', '/recipes/pizza.md', Date.now()
      );
      cache.upsertNode(
        createNode({ id: 'ingredients/tomato.md', title: 'Tomato', tags: ['ingredient', 'vegetable'] }),
        'file', '/ingredients/tomato.md', Date.now()
      );
      cache.upsertNode(
        createNode({ id: 'notes/shopping.md', title: 'Shopping List', tags: ['note'] }),
        'file', '/notes/shopping.md', Date.now()
      );
    });

    it('returns all nodes with empty filter', () => {
      const result = cache.listNodes({});
      expect(result.nodes).toHaveLength(4);
      expect(result.total).toBe(4);
    });

    it('returns NodeSummary objects with id and title only', () => {
      const result = cache.listNodes({});
      expect(result.nodes[0]).toHaveProperty('id');
      expect(result.nodes[0]).toHaveProperty('title');
      expect(result.nodes[0]).not.toHaveProperty('content');
      expect(result.nodes[0]).not.toHaveProperty('tags');
    });

    it('applies default limit of 100 but returns full total', () => {
      // Add 150 nodes
      for (let i = 0; i < 150; i++) {
        cache.upsertNode(
          createNode({ id: `bulk/node${i}.md`, title: `Node ${i}` }),
          'file', `/bulk/node${i}.md`, Date.now()
        );
      }
      const result = cache.listNodes({});
      expect(result.nodes).toHaveLength(100);
      expect(result.total).toBe(154); // 150 + 4 original nodes
    });

    it('respects custom limit but returns full total', () => {
      const result = cache.listNodes({}, { limit: 2 });
      expect(result.nodes).toHaveLength(2);
      expect(result.total).toBe(4);
    });

    it('enforces max limit of 1000', () => {
      const result = cache.listNodes({}, { limit: 5000 });
      // With only 4 nodes, we get 4, but limit is clamped
      expect(result.nodes.length).toBeLessThanOrEqual(1000);
      expect(result.total).toBe(4);
    });

    it('filters by tag (case-insensitive)', () => {
      const result = cache.listNodes({ tag: 'RECIPE' });
      expect(result.nodes).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.nodes.map(n => n.id).sort()).toEqual(['recipes/pasta.md', 'recipes/pizza.md']);
    });

    it('filters by path prefix', () => {
      const result = cache.listNodes({ path: 'recipes/' });
      expect(result.nodes).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.nodes.every(n => n.id.startsWith('recipes/'))).toBe(true);
    });

    it('filters by path prefix case-insensitively', () => {
      // IDs are lowercase: recipes/pasta.md, recipes/pizza.md
      // Query with uppercase should still match
      const result = cache.listNodes({ path: 'Recipes/' });
      expect(result.nodes).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.nodes.every(n => n.id.startsWith('recipes/'))).toBe(true);
    });

    it('matches uppercase IDs with lowercase path filter', () => {
      cache.upsertNode(
        createNode({ id: 'Guides/Setup.md', title: 'Setup Guide', tags: ['guide'] }),
        'file', '/Guides/Setup.md', Date.now()
      );

      // Enable case_sensitive_like to prove the SQL uses explicit LOWER(),
      // not SQLite's default ASCII case-folding in LIKE
      // @ts-expect-error accessing private db for testing
      cache.db.pragma('case_sensitive_like = ON');

      const result = cache.listNodes({ path: 'guides/' });
      expect(result.nodes).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.nodes[0]!.id).toBe('Guides/Setup.md');
    });

    it('combines tag and path filters with AND', () => {
      // Add an ingredient in recipes folder for testing
      cache.upsertNode(
        createNode({ id: 'recipes/sauce.md', title: 'Sauce', tags: ['ingredient'] }),
        'file', '/recipes/sauce.md', Date.now()
      );

      const result = cache.listNodes({ tag: 'ingredient', path: 'recipes/' });
      expect(result.nodes).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.nodes[0]!.id).toBe('recipes/sauce.md');
    });

    it('applies offset for pagination with unchanged total', () => {
      const all = cache.listNodes({});
      const offset2 = cache.listNodes({}, { offset: 2 });
      expect(offset2.nodes).toHaveLength(2);
      expect(offset2.nodes[0]!.id).toBe(all.nodes[2]!.id);
      expect(offset2.total).toBe(all.total); // Total unchanged
    });

    it('returns empty nodes array when offset exceeds results', () => {
      const result = cache.listNodes({}, { offset: 100 });
      expect(result.nodes).toEqual([]);
      expect(result.total).toBe(4); // Total still reflects all matching
    });

    it('combines limit and offset for pagination', () => {
      const result = cache.listNodes({}, { limit: 1, offset: 1 });
      expect(result.nodes).toHaveLength(1);
      expect(result.total).toBe(4);
    });
  });

  describe('resolveNodes', () => {
    beforeEach(() => {
      cache.upsertNode(
        createNode({ id: 'ingredients/ground beef.md', title: 'Ground Beef', tags: ['ingredient'] }),
        'file', '/ingredients/ground beef.md', Date.now()
      );
      cache.upsertNode(
        createNode({ id: 'ingredients/cheddar cheese.md', title: 'Cheddar Cheese', tags: ['ingredient'] }),
        'file', '/ingredients/cheddar cheese.md', Date.now()
      );
      cache.upsertNode(
        createNode({ id: 'recipes/beef tacos.md', title: 'Beef Tacos', tags: ['recipe'] }),
        'file', '/recipes/beef tacos.md', Date.now()
      );
    });

    describe('empty input', () => {
      it('returns empty array for empty names', () => {
        const result = cache.resolveNodes([]);
        expect(result).toEqual([]);
      });
    });

    describe('exact strategy', () => {
      it('matches case-insensitively on title', () => {
        const result = cache.resolveNodes(['ground beef'], { strategy: 'exact' });
        expect(result).toHaveLength(1);
        expect(result[0]!.query).toBe('ground beef');
        expect(result[0]!.match).toBe('ingredients/ground beef.md');
        expect(result[0]!.score).toBe(1);
      });

      it('returns null match with score 0 when not found', () => {
        const result = cache.resolveNodes(['unknown item'], { strategy: 'exact' });
        expect(result).toHaveLength(1);
        expect(result[0]!.query).toBe('unknown item');
        expect(result[0]!.match).toBeNull();
        expect(result[0]!.score).toBe(0);
      });

      it('ignores threshold for exact strategy', () => {
        const result = cache.resolveNodes(['ground beef'], { strategy: 'exact', threshold: 0.99 });
        expect(result[0]!.match).toBe('ingredients/ground beef.md');
        expect(result[0]!.score).toBe(1);
      });
    });

    describe('fuzzy strategy', () => {
      it('finds best fuzzy match', () => {
        const result = cache.resolveNodes(['ground bef'], { strategy: 'fuzzy' });
        expect(result[0]!.match).toBe('ingredients/ground beef.md');
        expect(result[0]!.score).toBeGreaterThan(0.7);
      });

      it('applies threshold to fuzzy matches', () => {
        const result = cache.resolveNodes(['xyz'], { strategy: 'fuzzy', threshold: 0.9 });
        expect(result[0]!.match).toBeNull();
        expect(result[0]!.score).toBe(0);
      });

      it('uses default threshold of 0.7', () => {
        // "ground beeef" (slight typo) should match "Ground Beef" above 0.7 threshold
        const result = cache.resolveNodes(['ground beeef']);
        expect(result[0]!.match).not.toBeNull();
      });
    });

    describe('filtering', () => {
      it('filters candidates by tag', () => {
        const result = cache.resolveNodes(['ground beef'], { tag: 'ingredient', strategy: 'fuzzy' });
        // Should match Ground Beef (ingredient), not Beef Tacos (recipe)
        expect(result[0]!.match).toBe('ingredients/ground beef.md');
      });

      it('filters candidates by path', () => {
        const result = cache.resolveNodes(['beef tacos'], { path: 'recipes/', strategy: 'fuzzy' });
        // Should only match Beef Tacos in recipes/
        expect(result[0]!.match).toBe('recipes/beef tacos.md');
      });
    });

    describe('batch behavior', () => {
      it('preserves order of input queries', () => {
        const result = cache.resolveNodes(['cheddar cheese', 'ground beef'], { strategy: 'exact' });
        expect(result[0]!.query).toBe('cheddar cheese');
        expect(result[1]!.query).toBe('ground beef');
      });

      it('handles mixed matches and non-matches', () => {
        const result = cache.resolveNodes(['ground beef', 'unknown', 'cheddar cheese'], { strategy: 'exact' });
        expect(result).toHaveLength(3);
        expect(result[0]!.match).not.toBeNull();
        expect(result[1]!.match).toBeNull();
        expect(result[2]!.match).not.toBeNull();
      });
    });

    describe('edge cases', () => {
      it('returns no match for all queries when no candidates exist', () => {
        const emptyCache = new Cache(':memory:');
        const result = emptyCache.resolveNodes(['anything', 'something'], { strategy: 'fuzzy' });
        expect(result).toHaveLength(2);
        expect(result[0]!.match).toBeNull();
        expect(result[1]!.match).toBeNull();
        emptyCache.close();
      });

      it('returns no match for semantic strategy (not supported at cache level)', () => {
        const result = cache.resolveNodes(['ground beef'], { strategy: 'semantic' });
        expect(result[0]!.match).toBeNull();
        expect(result[0]!.score).toBe(0);
      });
    });
  });

  describe('nodesExist', () => {
    it('returns empty Map for empty input', () => {
      const result = cache.nodesExist([]);
      expect(result.size).toBe(0);
    });

    it('returns true for existing nodes', () => {
      cache.upsertNode(createNode({ id: 'a.md' }), 'file', '/a.md', Date.now());
      cache.upsertNode(createNode({ id: 'b.md' }), 'file', '/b.md', Date.now());

      const result = cache.nodesExist(['a.md', 'b.md']);
      expect(result.get('a.md')).toBe(true);
      expect(result.get('b.md')).toBe(true);
    });

    it('returns false for non-existing nodes', () => {
      const result = cache.nodesExist(['missing.md']);
      expect(result.get('missing.md')).toBe(false);
    });

    it('handles mixed existing and non-existing nodes', () => {
      cache.upsertNode(createNode({ id: 'exists.md' }), 'file', '/e.md', Date.now());

      const result = cache.nodesExist(['exists.md', 'missing.md']);
      expect(result.get('exists.md')).toBe(true);
      expect(result.get('missing.md')).toBe(false);
    });
  });

  describe('clear', () => {
    it('removes all nodes', () => {
      cache.upsertNode(createNode({ id: 'a.md' }), 'file', '/a.md', 1);
      cache.upsertNode(createNode({ id: 'b.md' }), 'file', '/b.md', 2);

      cache.clear();

      expect(cache.getAllNodes()).toEqual([]);
    });

    it('removes all centrality data', () => {
      cache.upsertNode(createNode({ id: 'a.md' }), 'file', '/a.md', 1);
      cache.storeCentrality('a.md', 0.5, 1, 2, Date.now());

      cache.clear();

      expect(cache.getCentrality('a.md')).toBeNull();
    });
  });

  describe('corrupted data handling', () => {
    it('throws on corrupted tags JSON when reading node', () => {
      // Insert valid node first
      cache.upsertNode(createNode({ id: 'corrupted.md' }), 'file', '/corrupted.md', Date.now());

      // Corrupt the tags field directly in SQLite
      // @ts-expect-error accessing private db for testing
      cache.db.prepare('UPDATE nodes SET tags = ? WHERE id = ?').run('not valid json {', 'corrupted.md');

      // getNode should throw when parsing corrupted JSON
      expect(() => cache.getNode('corrupted.md')).toThrow();
    });

    it('throws on corrupted outgoing_links JSON when reading node', () => {
      cache.upsertNode(createNode({ id: 'corrupted.md' }), 'file', '/corrupted.md', Date.now());

      // @ts-expect-error accessing private db for testing
      cache.db.prepare('UPDATE nodes SET outgoing_links = ? WHERE id = ?').run('[broken', 'corrupted.md');

      expect(() => cache.getNode('corrupted.md')).toThrow();
    });

    it('throws on corrupted properties JSON when reading node', () => {
      cache.upsertNode(createNode({ id: 'corrupted.md' }), 'file', '/corrupted.md', Date.now());

      // @ts-expect-error accessing private db for testing
      cache.db.prepare('UPDATE nodes SET properties = ? WHERE id = ?').run('{bad json', 'corrupted.md');

      expect(() => cache.getNode('corrupted.md')).toThrow();
    });

    it('throws on corrupted JSON in getAllNodes', () => {
      cache.upsertNode(createNode({ id: 'good.md' }), 'file', '/good.md', Date.now());
      cache.upsertNode(createNode({ id: 'bad.md' }), 'file', '/bad.md', Date.now());

      // Corrupt one node
      // @ts-expect-error accessing private db for testing
      cache.db.prepare('UPDATE nodes SET tags = ? WHERE id = ?').run('invalid', 'bad.md');

      // getAllNodes should throw when encountering corrupted data
      expect(() => cache.getAllNodes()).toThrow();
    });

    it('throws on corrupted JSON in getNodes batch', () => {
      cache.upsertNode(createNode({ id: 'a.md' }), 'file', '/a.md', Date.now());
      cache.upsertNode(createNode({ id: 'b.md' }), 'file', '/b.md', Date.now());

      // Corrupt the second node
      // @ts-expect-error accessing private db for testing
      cache.db.prepare('UPDATE nodes SET tags = ? WHERE id = ?').run('[[broken', 'b.md');

      expect(() => cache.getNodes(['a.md', 'b.md'])).toThrow();
    });

    it('throws on corrupted JSON in searchByTags', () => {
      cache.upsertNode(createNode({ id: 'tagged.md', tags: ['test'] }), 'file', '/tagged.md', Date.now());

      // @ts-expect-error accessing private db for testing
      cache.db.prepare('UPDATE nodes SET outgoing_links = ? WHERE id = ?').run('corrupt', 'tagged.md');

      expect(() => cache.searchByTags(['test'], 'any')).toThrow();
    });
  });
});
