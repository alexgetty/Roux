import { describe, it, expect, beforeAll, afterEach, beforeEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GraphCoreImpl } from '../../../src/core/graphcore.js';
import { DocStore } from '../../../src/providers/docstore/index.js';
import { TransformersEmbedding } from '../../../src/providers/embedding/transformers.js';
import {
  handleSearch,
  handleGetNode,
  handleGetNeighbors,
  handleFindPath,
  handleGetHubs,
  handleSearchByTags,
  handleRandomNode,
  handleCreateNode,
  handleUpdateNode,
  handleDeleteNode,
  handleListNodes,
  handleNodesExist,
  type HandlerContext,
} from '../../../src/mcp/handlers.js';
import { McpError } from '../../../src/mcp/types.js';

describe('MCP Handlers Integration', () => {
  let tempDir: string;
  let sourceDir: string;
  let cacheDir: string;
  let store: DocStore;
  let embedding: TransformersEmbedding;
  let core: GraphCoreImpl;
  let ctx: HandlerContext;

  beforeAll(async () => {
    embedding = new TransformersEmbedding();
    // Warm up the model
    await embedding.embed('warmup');
  }, 60000);

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'roux-mcp-integration-'));
    sourceDir = join(tempDir, 'source');
    cacheDir = join(tempDir, 'cache');
    await mkdir(sourceDir, { recursive: true });

    store = new DocStore(sourceDir, cacheDir);
    core = new GraphCoreImpl();
    core.registerStore(store);
    core.registerEmbedding(embedding);

    ctx = {
      core,
      store,
      hasEmbedding: true,
    };
  });

  afterEach(async () => {
    store.close();
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  const writeMarkdownFile = async (
    relativePath: string,
    content: string
  ): Promise<void> => {
    const fullPath = join(sourceDir, relativePath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    if (dir !== sourceDir) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(fullPath, content, 'utf-8');
  };

  const embedAllNodes = async (): Promise<void> => {
    const allIds = await store.getAllNodeIds();
    for (const id of allIds) {
      const node = await store.getNode(id);
      if (node) {
        const vector = await embedding.embed(node.content);
        await store.storeEmbedding(id, vector, embedding.modelId());
      }
    }
  };

  describe('handleSearch', () => {
    it('returns search results with scores', async () => {
      await writeMarkdownFile(
        'typescript.md',
        '---\ntitle: TypeScript Guide\n---\nTypeScript adds static typing to JavaScript.'
      );
      await store.sync();
      await embedAllNodes();

      const results = await handleSearch(ctx, { query: 'static types', limit: 5 });

      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe('typescript.md');
      expect(results[0]!.score).toBeDefined();
      expect(results[0]!.score).toBeGreaterThan(0);
    });

    it('throws PROVIDER_ERROR when no embedding provider', async () => {
      const noEmbeddingCtx: HandlerContext = { ...ctx, hasEmbedding: false };

      await expect(
        handleSearch(noEmbeddingCtx, { query: 'test' })
      ).rejects.toThrow(McpError);
    });

    it('throws INVALID_PARAMS for empty query', async () => {
      await expect(handleSearch(ctx, { query: '' })).rejects.toThrow(McpError);
      await expect(handleSearch(ctx, { query: '   ' })).rejects.toThrow(McpError);
    });
  });

  describe('handleGetNode', () => {
    beforeEach(async () => {
      await writeMarkdownFile(
        'test-node.md',
        '---\ntitle: Test Node\ntags:\n  - testing\n---\nTest content here.'
      );
      await store.sync();
    });

    it('returns node with depth=0', async () => {
      const result = await handleGetNode(ctx, { id: 'test-node.md', depth: 0 });

      expect(result).not.toBeNull();
      expect(result!.id).toBe('test-node.md');
      expect(result!.title).toBe('Test Node');
      expect(result!.tags).toContain('testing');
    });

    it('returns node with context at depth=1', async () => {
      // Create linked nodes
      await writeMarkdownFile(
        'parent.md',
        '---\ntitle: Parent\n---\nLinks to [[test-node]].'
      );
      await store.sync();

      const result = await handleGetNode(ctx, { id: 'test-node.md', depth: 1 });

      expect(result).not.toBeNull();
      expect(result!.id).toBe('test-node.md');
      // Should have context fields
      expect('incomingNeighbors' in result!).toBe(true);
      expect('outgoingNeighbors' in result!).toBe(true);
    });

    it('returns null for non-existent node', async () => {
      const result = await handleGetNode(ctx, { id: 'nonexistent.md' });
      expect(result).toBeNull();
    });
  });

  describe('handleGetNeighbors', () => {
    beforeEach(async () => {
      await writeMarkdownFile(
        'center.md',
        '---\ntitle: Center\n---\nLinks to [[leaf-a]] and [[leaf-b]].'
      );
      await writeMarkdownFile('leaf-a.md', '---\ntitle: Leaf A\n---\nContent A.');
      await writeMarkdownFile('leaf-b.md', '---\ntitle: Leaf B\n---\nContent B.');
      await store.sync();
    });

    it('returns outgoing neighbors', async () => {
      const results = await handleGetNeighbors(ctx, {
        id: 'center.md',
        direction: 'out',
      });

      expect(results).toHaveLength(2);
      const ids = results.map((r) => r.id);
      expect(ids).toContain('leaf-a.md');
      expect(ids).toContain('leaf-b.md');
    });

    it('returns incoming neighbors', async () => {
      const results = await handleGetNeighbors(ctx, {
        id: 'leaf-a.md',
        direction: 'in',
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe('center.md');
    });

    it('returns empty array for node with no neighbors', async () => {
      const results = await handleGetNeighbors(ctx, {
        id: 'leaf-a.md',
        direction: 'out',
      });

      expect(results).toEqual([]);
    });
  });

  describe('handleFindPath', () => {
    beforeEach(async () => {
      await writeMarkdownFile(
        'start.md',
        '---\ntitle: Start\n---\nLinks to [[middle]].'
      );
      await writeMarkdownFile(
        'middle.md',
        '---\ntitle: Middle\n---\nLinks to [[end]].'
      );
      await writeMarkdownFile('end.md', '---\ntitle: End\n---\nNo links.');
      await store.sync();
    });

    it('finds path between connected nodes', async () => {
      const result = await handleFindPath(ctx, {
        source: 'start.md',
        target: 'end.md',
      });

      expect(result).not.toBeNull();
      expect(result!.path).toEqual(['start.md', 'middle.md', 'end.md']);
      expect(result!.length).toBe(2);
    });

    it('returns null when no path exists', async () => {
      const result = await handleFindPath(ctx, {
        source: 'end.md',
        target: 'start.md',
      });

      expect(result).toBeNull();
    });
  });

  describe('handleGetHubs', () => {
    beforeEach(async () => {
      // Hub: many incoming links
      await writeMarkdownFile('hub.md', '---\ntitle: Hub\n---\nPopular node.');
      await writeMarkdownFile(
        'linker-1.md',
        '---\ntitle: Linker 1\n---\nLinks to [[hub]].'
      );
      await writeMarkdownFile(
        'linker-2.md',
        '---\ntitle: Linker 2\n---\nLinks to [[hub]].'
      );
      await writeMarkdownFile(
        'linker-3.md',
        '---\ntitle: Linker 3\n---\nLinks to [[hub]].'
      );
      await store.sync();
    });

    it('returns nodes sorted by in_degree', async () => {
      const results = await handleGetHubs(ctx, { metric: 'in_degree', limit: 5 });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.id).toBe('hub.md');
      expect(results[0]!.score).toBe(3); // 3 incoming links
    });

    it('respects limit parameter', async () => {
      const results = await handleGetHubs(ctx, { metric: 'in_degree', limit: 1 });
      expect(results).toHaveLength(1);
    });
  });

  describe('handleSearchByTags', () => {
    beforeEach(async () => {
      await writeMarkdownFile(
        'tagged-a.md',
        '---\ntitle: Tagged A\ntags:\n  - alpha\n  - beta\n---\nContent A.'
      );
      await writeMarkdownFile(
        'tagged-b.md',
        '---\ntitle: Tagged B\ntags:\n  - beta\n---\nContent B.'
      );
      await store.sync();
    });

    it('finds nodes by tag with mode=any', async () => {
      const results = await handleSearchByTags(ctx, {
        tags: ['alpha'],
        mode: 'any',
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe('tagged-a.md');
    });

    it('finds nodes with mode=all requiring all tags', async () => {
      const results = await handleSearchByTags(ctx, {
        tags: ['alpha', 'beta'],
        mode: 'all',
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe('tagged-a.md');
    });
  });

  describe('handleRandomNode', () => {
    beforeEach(async () => {
      await writeMarkdownFile(
        'random-1.md',
        '---\ntitle: Random 1\ntags:\n  - random\n---\nContent 1.'
      );
      await writeMarkdownFile(
        'random-2.md',
        '---\ntitle: Random 2\ntags:\n  - random\n---\nContent 2.'
      );
      await store.sync();
    });

    it('returns a random node', async () => {
      const result = await handleRandomNode(ctx, {});

      expect(result).not.toBeNull();
      expect(['random-1.md', 'random-2.md']).toContain(result!.id);
    });

    it('returns null when no nodes exist', async () => {
      // Create fresh store with no files
      const emptySourceDir = join(tempDir, 'empty');
      const emptyCacheDir = join(tempDir, 'empty-cache');
      await mkdir(emptySourceDir, { recursive: true });
      const emptyStore = new DocStore(emptySourceDir, emptyCacheDir);
      await emptyStore.sync();

      const emptyCore = new GraphCoreImpl();
      emptyCore.registerStore(emptyStore);
      const emptyCtx: HandlerContext = {
        core: emptyCore,
        store: emptyStore,
        hasEmbedding: false,
      };

      const result = await handleRandomNode(emptyCtx, {});
      expect(result).toBeNull();

      emptyStore.close();
    });
  });

  describe('handleCreateNode', () => {
    beforeEach(async () => {
      await store.sync();
    });

    it('creates a new node', async () => {
      const result = await handleCreateNode(ctx, {
        id: 'New Note.md',
        content: 'This is new content.',
        tags: ['new', 'test'],
      });

      expect(result.id).toBe('new note.md');
      expect(result.title).toBe('New Note');
      expect(result.tags).toContain('new');

      // Verify it persisted
      const retrieved = await store.getNode('new note.md');
      expect(retrieved).not.toBeNull();
    });

    it('creates node in subdirectory', async () => {
      const result = await handleCreateNode(ctx, {
        id: 'subdir/Nested Note.md',
        content: 'Nested content.',
      });

      expect(result.id).toBe('subdir/nested note.md');
    });

    it('throws NODE_EXISTS for duplicate', async () => {
      await handleCreateNode(ctx, {
        id: 'Duplicate.md',
        content: 'First version.',
      });

      await expect(
        handleCreateNode(ctx, {
          id: 'Duplicate.md',
          content: 'Second version.',
        })
      ).rejects.toThrow(McpError);
    });

    it('nodes_exist returns true for created node using original ID input', async () => {
      await handleCreateNode(ctx, { id: 'Test/Sesame Oil.md', content: 'test' });

      // The exact ID input (mixed case) should resolve via normalization
      const result = await handleNodesExist(ctx, { ids: ['Test/Sesame Oil.md'] });
      expect(result['test/sesame oil.md']).toBe(true);

      // Also verify lowercase variant works
      const result2 = await handleNodesExist(ctx, { ids: ['test/sesame oil.md'] });
      expect(result2['test/sesame oil.md']).toBe(true);
    });
  });

  describe('handleUpdateNode', () => {
    beforeEach(async () => {
      await writeMarkdownFile(
        'to-update.md',
        '---\ntitle: Original Title\ntags:\n  - original\n---\nOriginal content.'
      );
      await store.sync();
    });

    it('updates node content', async () => {
      const result = await handleUpdateNode(ctx, {
        id: 'to-update.md',
        content: 'Updated content.',
      });

      expect(result.content).toBe('Updated content.');
    });

    it('updates node tags', async () => {
      const result = await handleUpdateNode(ctx, {
        id: 'to-update.md',
        tags: ['updated', 'modified'],
      });

      expect(result.tags).toContain('updated');
      expect(result.tags).not.toContain('original');
    });

    it('throws NODE_NOT_FOUND for missing node', async () => {
      await expect(
        handleUpdateNode(ctx, {
          id: 'nonexistent.md',
          content: 'New content.',
        })
      ).rejects.toThrow(McpError);
    });

    it('throws LINK_INTEGRITY when renaming node with incoming links', async () => {
      // Create a node that links to our target
      await writeMarkdownFile(
        'linker.md',
        '---\ntitle: Linker\n---\nLinks to [[to-update]].'
      );
      await store.sync();

      await expect(
        handleUpdateNode(ctx, {
          id: 'to-update.md',
          title: 'New Title',
        })
      ).rejects.toThrow(McpError);
    });
  });

  describe('handleDeleteNode', () => {
    beforeEach(async () => {
      await writeMarkdownFile(
        'to-delete.md',
        '---\ntitle: To Delete\n---\nContent to be deleted.'
      );
      await store.sync();
    });

    it('deletes existing node', async () => {
      const result = await handleDeleteNode(ctx, { id: 'to-delete.md' });

      expect(result.deleted).toBe(true);

      // Verify it's gone
      const retrieved = await store.getNode('to-delete.md');
      expect(retrieved).toBeNull();
    });

    it('returns deleted=false for non-existent node', async () => {
      const result = await handleDeleteNode(ctx, { id: 'nonexistent.md' });
      expect(result.deleted).toBe(false);
    });
  });

  describe('handleListNodes', () => {
    beforeEach(async () => {
      // Create 5 nodes
      for (let i = 1; i <= 5; i++) {
        await writeMarkdownFile(
          `list-node-${i}.md`,
          `---\ntitle: List Node ${i}\ntags:\n  - list-test\n---\nContent ${i}.`
        );
      }
      await store.sync();
    });

    it('returns total matching nodes, not just returned slice', async () => {
      // Request with limit=2, should return 2 nodes but total=5
      const result = await handleListNodes(ctx, { limit: 2 });

      expect(result.nodes).toHaveLength(2);
      expect(result.total).toBe(5);
      // total must NOT equal nodes.length when paginated
      expect(result.total).not.toBe(result.nodes.length);
    });

    it('returns correct total with tag filter', async () => {
      // Add nodes with different tags
      await writeMarkdownFile(
        'other-tag.md',
        '---\ntitle: Other Tag\ntags:\n  - different\n---\nOther content.'
      );
      await store.sync();

      const result = await handleListNodes(ctx, { tag: 'list-test', limit: 2 });

      expect(result.nodes).toHaveLength(2);
      expect(result.total).toBe(5); // Only 5 have list-test tag
    });

    it('returns correct total with path filter', async () => {
      await writeMarkdownFile(
        'subdir/nested.md',
        '---\ntitle: Nested\n---\nNested content.'
      );
      await store.sync();

      // All 5 list-node files are in root, nested is in subdir
      const result = await handleListNodes(ctx, { path: 'list-node', limit: 2 });

      expect(result.nodes).toHaveLength(2);
      expect(result.total).toBe(5); // 5 nodes match path prefix "list-node"
    });
  });
});
