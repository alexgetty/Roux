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

    it('creates embeddings table', () => {
      const tables = cache.getTableNames();
      expect(tables).toContain('embeddings');
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

  describe('embedding storage', () => {
    it('stores and retrieves embedding', () => {
      cache.upsertNode(createNode({ id: 'a.md' }), 'file', '/a.md', 1);

      const vector = [0.1, 0.2, 0.3, 0.4, 0.5];
      cache.storeEmbedding('a.md', vector, 'test-model');

      const retrieved = cache.getEmbedding('a.md');
      expect(retrieved?.model).toBe('test-model');
      expect(retrieved?.vector).toEqual(vector);
    });

    it('returns null for node without embedding', () => {
      cache.upsertNode(createNode({ id: 'a.md' }), 'file', '/a.md', 1);
      const result = cache.getEmbedding('a.md');
      expect(result).toBeNull();
    });

    it('overwrites existing embedding', () => {
      cache.upsertNode(createNode({ id: 'a.md' }), 'file', '/a.md', 1);

      cache.storeEmbedding('a.md', [1, 2, 3], 'model-v1');
      cache.storeEmbedding('a.md', [4, 5, 6], 'model-v2');

      const retrieved = cache.getEmbedding('a.md');
      expect(retrieved?.model).toBe('model-v2');
      expect(retrieved?.vector).toEqual([4, 5, 6]);
    });

    it('deletes embedding when node is deleted', () => {
      cache.upsertNode(createNode({ id: 'a.md' }), 'file', '/a.md', 1);
      cache.storeEmbedding('a.md', [1, 2, 3], 'model');
      cache.deleteNode('a.md');

      const result = cache.getEmbedding('a.md');
      expect(result).toBeNull();
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

  describe('clear', () => {
    it('removes all nodes', () => {
      cache.upsertNode(createNode({ id: 'a.md' }), 'file', '/a.md', 1);
      cache.upsertNode(createNode({ id: 'b.md' }), 'file', '/b.md', 2);

      cache.clear();

      expect(cache.getAllNodes()).toEqual([]);
    });

    it('removes all embeddings', () => {
      cache.upsertNode(createNode({ id: 'a.md' }), 'file', '/a.md', 1);
      cache.storeEmbedding('a.md', [1, 2, 3], 'model');

      cache.clear();

      expect(cache.getEmbedding('a.md')).toBeNull();
    });

    it('removes all centrality data', () => {
      cache.upsertNode(createNode({ id: 'a.md' }), 'file', '/a.md', 1);
      cache.storeCentrality('a.md', 0.5, 1, 2, Date.now());

      cache.clear();

      expect(cache.getCentrality('a.md')).toBeNull();
    });
  });
});
