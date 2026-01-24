import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DocStore } from '../../../src/providers/docstore/index.js';
import type { Node } from '../../../src/types/node.js';
import type { VectorProvider, VectorSearchResult } from '../../../src/types/provider.js';

describe('DocStore', () => {
  let tempDir: string;
  let sourceDir: string;
  let cacheDir: string;
  let store: DocStore;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'roux-docstore-test-'));
    sourceDir = join(tempDir, 'source');
    cacheDir = join(tempDir, 'cache');
    await mkdir(sourceDir, { recursive: true });
    store = new DocStore(sourceDir, cacheDir);
  });

  afterEach(async () => {
    store.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  const writeMarkdownFile = async (
    relativePath: string,
    content: string
  ): Promise<string> => {
    const fullPath = join(sourceDir, relativePath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    if (dir !== sourceDir) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(fullPath, content, 'utf-8');
    return fullPath;
  };

  describe('file to node transformation', () => {
    it('parses markdown file into node', async () => {
      await writeMarkdownFile(
        'test-note.md',
        `---
title: Test Note
tags:
  - test
  - example
custom: value
---
# Heading

Body content with [[Other Note]] link.`
      );

      await store.sync();
      const node = await store.getNode('test-note.md');

      expect(node).not.toBeNull();
      expect(node?.id).toBe('test-note.md');
      expect(node?.title).toBe('Test Note');
      expect(node?.tags).toEqual(['test', 'example']);
      expect(node?.properties['custom']).toBe('value');
      expect(node?.content).toContain('Body content');
      expect(node?.outgoingLinks).toContain('other note.md');
    });

    it('derives title from path when frontmatter lacks title', async () => {
      await writeMarkdownFile(
        'my-derived-title.md',
        `---
tags: [test]
---
Content only`
      );

      await store.sync();
      const node = await store.getNode('my-derived-title.md');

      expect(node?.title).toBe('My Derived Title');
    });

    it('normalizes wiki-link targets to IDs', async () => {
      await writeMarkdownFile(
        'linker.md',
        `Links: [[Target Note]] and [[folder/Deep Note]]`
      );

      await store.sync();
      const node = await store.getNode('linker.md');

      // Wiki links normalized: spaces become hyphens, lowercased, .md added
      expect(node?.outgoingLinks).toContain('target note.md');
      expect(node?.outgoingLinks).toContain('folder/deep note.md');
    });

    it('adds .md to links with dots in filename (not extensions)', async () => {
      await writeMarkdownFile(
        'dated.md',
        `Links: [[archive.2024]] and [[meeting.notes.draft]]`
      );

      await store.sync();
      const node = await store.getNode('dated.md');

      // Dots in middle of filename should not be treated as extension
      expect(node?.outgoingLinks).toContain('archive.2024.md');
      expect(node?.outgoingLinks).toContain('meeting.notes.draft.md');
    });

    it('does not add .md to links that already have file extension', async () => {
      await writeMarkdownFile(
        'explicit.md',
        `Links: [[file.md]] and [[doc.txt]] and [[image.png]]`
      );

      await store.sync();
      const node = await store.getNode('explicit.md');

      expect(node?.outgoingLinks).toContain('file.md');
      expect(node?.outgoingLinks).toContain('doc.txt');
      expect(node?.outgoingLinks).toContain('image.png');
      // Should NOT have double extensions
      expect(node?.outgoingLinks).not.toContain('file.md.md');
    });

    it('handles files without frontmatter', async () => {
      await writeMarkdownFile('plain.md', '# Just Markdown\n\nNo frontmatter.');

      await store.sync();
      const node = await store.getNode('plain.md');

      expect(node?.title).toBe('Plain');
      expect(node?.tags).toEqual([]);
      expect(node?.content).toContain('Just Markdown');
    });

    it('handles nested directory structure', async () => {
      await writeMarkdownFile(
        'folder/subfolder/deep.md',
        `---
title: Deep Note
---
Content`
      );

      await store.sync();
      const node = await store.getNode('folder/subfolder/deep.md');

      expect(node).not.toBeNull();
      expect(node?.id).toBe('folder/subfolder/deep.md');
    });
  });

  describe('sync', () => {
    it('syncs all markdown files in source directory', async () => {
      await writeMarkdownFile('a.md', '# A');
      await writeMarkdownFile('b.md', '# B');
      await writeMarkdownFile('sub/c.md', '# C');

      await store.sync();

      expect(await store.getNode('a.md')).not.toBeNull();
      expect(await store.getNode('b.md')).not.toBeNull();
      expect(await store.getNode('sub/c.md')).not.toBeNull();
    });

    it('ignores non-markdown files', async () => {
      await writeMarkdownFile('note.md', '# Note');
      await writeFile(join(sourceDir, 'image.png'), Buffer.from('fake'));
      await writeFile(join(sourceDir, 'data.json'), '{}');

      await store.sync();
      const nodes = await store.getAllNodeIds();

      expect(nodes).toHaveLength(1);
      expect(nodes).toContain('note.md');
    });

    it('detects modified files on re-sync', async () => {
      const path = await writeMarkdownFile(
        'mutable.md',
        `---
title: Original
---
Content`
      );

      await store.sync();
      let node = await store.getNode('mutable.md');
      expect(node?.title).toBe('Original');

      // Modify file (need small delay for mtime change)
      await new Promise((r) => setTimeout(r, 50));
      await writeFile(
        path,
        `---
title: Updated
---
Content`
      );

      await store.sync();
      node = await store.getNode('mutable.md');
      expect(node?.title).toBe('Updated');
    });

    it('removes deleted files from cache on sync', async () => {
      const path = await writeMarkdownFile('ephemeral.md', '# Will be deleted');

      await store.sync();
      expect(await store.getNode('ephemeral.md')).not.toBeNull();

      await rm(path);
      await store.sync();

      expect(await store.getNode('ephemeral.md')).toBeNull();
    });
  });

  describe('CRUD operations', () => {
    describe('createNode', () => {
      it('creates new markdown file', async () => {
        const node: Node = {
          id: 'new-note.md',
          title: 'New Note',
          content: '# Created\n\nThis is new.',
          tags: ['created'],
          outgoingLinks: [],
          properties: { custom: 'prop' },
        };

        await store.createNode(node);

        const filePath = join(sourceDir, 'new-note.md');
        const content = await readFile(filePath, 'utf-8');
        expect(content).toContain('title: New Note');
        expect(content).toContain('# Created');
      });

      it('updates cache after creation', async () => {
        const node: Node = {
          id: 'cached.md',
          title: 'Cached',
          content: 'Content',
          tags: [],
          outgoingLinks: [],
          properties: {},
        };

        await store.createNode(node);
        const retrieved = await store.getNode('cached.md');

        expect(retrieved?.title).toBe('Cached');
      });

      it('creates nested directories as needed', async () => {
        const node: Node = {
          id: 'deep/nested/note.md',
          title: 'Deep',
          content: 'Content',
          tags: [],
          outgoingLinks: [],
          properties: {},
        };

        await store.createNode(node);

        const filePath = join(sourceDir, 'deep/nested/note.md');
        const content = await readFile(filePath, 'utf-8');
        expect(content).toContain('title: Deep');
      });

      it('throws if node already exists', async () => {
        await writeMarkdownFile('existing.md', '# Exists');
        await store.sync();

        const node: Node = {
          id: 'existing.md',
          title: 'Duplicate',
          content: '',
          tags: [],
          outgoingLinks: [],
          properties: {},
        };

        await expect(store.createNode(node)).rejects.toThrow(/exists/i);
      });
    });

    describe('updateNode', () => {
      beforeEach(async () => {
        await writeMarkdownFile(
          'target.md',
          `---
title: Original Title
tags: [original]
---
Original content`
        );
        await store.sync();
      });

      it('updates title', async () => {
        await store.updateNode('target.md', { title: 'Updated Title' });

        const node = await store.getNode('target.md');
        expect(node?.title).toBe('Updated Title');

        const content = await readFile(join(sourceDir, 'target.md'), 'utf-8');
        expect(content).toContain('title: Updated Title');
      });

      it('updates tags', async () => {
        await store.updateNode('target.md', { tags: ['new', 'tags'] });

        const node = await store.getNode('target.md');
        expect(node?.tags).toEqual(['new', 'tags']);
      });

      it('updates content', async () => {
        await store.updateNode('target.md', { content: '# New Content\n\nBody' });

        const node = await store.getNode('target.md');
        expect(node?.content).toContain('New Content');
      });

      it('updates properties', async () => {
        await store.updateNode('target.md', {
          properties: { updated: true, count: 42 },
        });

        const node = await store.getNode('target.md');
        expect(node?.properties['updated']).toBe(true);
        expect(node?.properties['count']).toBe(42);
      });

      it('throws for non-existent node', async () => {
        await expect(
          store.updateNode('missing.md', { title: 'New' })
        ).rejects.toThrow(/not found/i);
      });

      it('updates outgoingLinks and rebuilds graph', async () => {
        await writeMarkdownFile('linked.md', '---\ntitle: Linked\n---\nContent');
        await store.sync();

        await store.updateNode('target.md', {
          outgoingLinks: ['linked.md'],
        });

        // Graph should be rebuilt - target should now have linked as neighbor
        const neighbors = await store.getNeighbors('target.md', {
          direction: 'out',
        });
        expect(neighbors.map((n) => n.id)).toContain('linked.md');
      });
    });

    describe('deleteNode', () => {
      it('deletes file and removes from cache', async () => {
        await writeMarkdownFile('doomed.md', '# Goodbye');
        await store.sync();

        await store.deleteNode('doomed.md');

        expect(await store.getNode('doomed.md')).toBeNull();
        await expect(
          readFile(join(sourceDir, 'doomed.md'), 'utf-8')
        ).rejects.toThrow();
      });

      it('throws for non-existent node', async () => {
        await expect(store.deleteNode('ghost.md')).rejects.toThrow(
          /not found/i
        );
      });

      it('delegates to VectorProvider.delete', async () => {
        const mockVector: VectorProvider = {
          store: vi.fn().mockResolvedValue(undefined),
          search: vi.fn().mockResolvedValue([]),
          delete: vi.fn().mockResolvedValue(undefined),
          getModel: vi.fn().mockResolvedValue(null),
        };

        const customStore = new DocStore(sourceDir, cacheDir, mockVector);
        await writeMarkdownFile('to-delete.md', '# Will be deleted');
        await customStore.sync();

        await customStore.deleteNode('to-delete.md');

        expect(mockVector.delete).toHaveBeenCalledWith('to-delete.md');
        customStore.close();
      });

      it('deleteNode removes file from disk AND embedding from vector store', async () => {
        // Uses real SqliteVectorProvider (default), not mock
        const node: Node = {
          id: 'to-delete.md',
          title: 'To Delete',
          content: 'This will be deleted',
          tags: [],
          outgoingLinks: [],
          properties: {},
        };

        await store.createNode(node);

        // Store embedding
        const vector = [0.1, 0.2, 0.3, 0.4, 0.5];
        await store.storeEmbedding('to-delete.md', vector, 'test-model');

        // Verify file exists
        const filePath = join(sourceDir, 'to-delete.md');
        await expect(readFile(filePath, 'utf-8')).resolves.toBeDefined();

        // Verify embedding exists (search should find it)
        const beforeResults = await store.searchByVector(vector, 10);
        expect(beforeResults.some((r) => r.id === 'to-delete.md')).toBe(true);

        // Delete
        await store.deleteNode('to-delete.md');

        // Verify file gone
        await expect(readFile(filePath, 'utf-8')).rejects.toThrow();

        // Verify embedding gone
        const afterResults = await store.searchByVector(vector, 10);
        expect(afterResults.some((r) => r.id === 'to-delete.md')).toBe(false);
      });
    });

    describe('getNode', () => {
      it('returns null for non-existent node', async () => {
        const result = await store.getNode('missing.md');
        expect(result).toBeNull();
      });

      it('performs case-insensitive lookup', async () => {
        await writeMarkdownFile('CamelCase.md', '# Camel');
        await store.sync();

        const node = await store.getNode('camelcase.md');
        expect(node).not.toBeNull();
      });
    });

    describe('getNodes', () => {
      beforeEach(async () => {
        await writeMarkdownFile('a.md', '---\ntitle: A\n---\nContent A');
        await writeMarkdownFile('b.md', '---\ntitle: B\n---\nContent B');
        await writeMarkdownFile('c.md', '---\ntitle: C\n---\nContent C');
        await store.sync();
      });

      it('returns multiple nodes', async () => {
        const nodes = await store.getNodes(['a.md', 'c.md']);
        expect(nodes).toHaveLength(2);
        expect(nodes.map((n) => n.title).sort()).toEqual(['A', 'C']);
      });

      it('skips missing nodes', async () => {
        const nodes = await store.getNodes(['a.md', 'missing.md', 'b.md']);
        expect(nodes).toHaveLength(2);
      });

      it('returns empty array for empty input', async () => {
        const nodes = await store.getNodes([]);
        expect(nodes).toEqual([]);
      });
    });
  });

  describe('tag search', () => {
    beforeEach(async () => {
      await writeMarkdownFile('alpha.md', '---\ntags: [a, b]\n---\nA');
      await writeMarkdownFile('beta.md', '---\ntags: [b, c]\n---\nB');
      await writeMarkdownFile('gamma.md', '---\ntags: [c, d]\n---\nC');
      await store.sync();
    });

    it('searchByTags mode any returns union', async () => {
      const results = await store.searchByTags(['a', 'd'], 'any');
      expect(results.map((n) => n.id).sort()).toEqual([
        'alpha.md',
        'gamma.md',
      ]);
    });

    it('searchByTags mode all returns intersection', async () => {
      const results = await store.searchByTags(['b', 'c'], 'all');
      expect(results.map((n) => n.id)).toEqual(['beta.md']);
    });

    it('is case-insensitive', async () => {
      const results = await store.searchByTags(['A', 'B'], 'all');
      expect(results.map((n) => n.id)).toEqual(['alpha.md']);
    });
  });

  describe('resolveTitles', () => {
    it('returns map of id to title', async () => {
      await writeMarkdownFile('x.md', '---\ntitle: Title X\n---\nContent');
      await writeMarkdownFile('y.md', '---\ntitle: Title Y\n---\nContent');
      await store.sync();

      const titles = await store.resolveTitles(['x.md', 'y.md']);

      expect(titles.get('x.md')).toBe('Title X');
      expect(titles.get('y.md')).toBe('Title Y');
    });

    it('omits missing nodes', async () => {
      await writeMarkdownFile('exists.md', '---\ntitle: Exists\n---\nContent');
      await store.sync();

      const titles = await store.resolveTitles(['exists.md', 'missing.md']);

      expect(titles.has('exists.md')).toBe(true);
      expect(titles.has('missing.md')).toBe(false);
    });
  });

  describe('graph operations', () => {
    /**
     * Test graph:
     *   a -> b -> c
     *   a -> d
     *   d -> c
     */
    beforeEach(async () => {
      await writeMarkdownFile('a.md', '---\ntitle: A\n---\n[[b]] and [[d]]');
      await writeMarkdownFile('b.md', '---\ntitle: B\n---\n[[c]]');
      await writeMarkdownFile('c.md', '---\ntitle: C\n---\nNo links');
      await writeMarkdownFile('d.md', '---\ntitle: D\n---\n[[c]]');
      await store.sync();
    });

    describe('getNeighbors', () => {
      it('builds graph lazily if not synced', async () => {
        // Create a fresh store without calling sync
        const lazyStore = new DocStore(sourceDir, join(tempDir, 'lazy-cache'));
        // Should not throw - builds graph on demand (empty graph)
        const neighbors = await lazyStore.getNeighbors('missing.md', {
          direction: 'out',
        });
        expect(neighbors).toEqual([]);
        lazyStore.close();
      });

      it('returns outgoing neighbors', async () => {
        const neighbors = await store.getNeighbors('a.md', { direction: 'out' });
        expect(neighbors.map((n) => n.id).sort()).toEqual(['b.md', 'd.md']);
      });

      it('returns incoming neighbors', async () => {
        const neighbors = await store.getNeighbors('c.md', { direction: 'in' });
        expect(neighbors.map((n) => n.id).sort()).toEqual(['b.md', 'd.md']);
      });

      it('returns both directions', async () => {
        const neighbors = await store.getNeighbors('b.md', {
          direction: 'both',
        });
        expect(neighbors.map((n) => n.id).sort()).toEqual(['a.md', 'c.md']);
      });

      it('respects limit', async () => {
        const neighbors = await store.getNeighbors('a.md', {
          direction: 'out',
          limit: 1,
        });
        expect(neighbors).toHaveLength(1);
      });

      it('returns empty array for node with no neighbors', async () => {
        const neighbors = await store.getNeighbors('c.md', { direction: 'out' });
        expect(neighbors).toEqual([]);
      });

      it('returns empty array for non-existent node', async () => {
        const neighbors = await store.getNeighbors('missing.md', {
          direction: 'out',
        });
        expect(neighbors).toEqual([]);
      });
    });

    describe('findPath', () => {
      it('returns path between connected nodes', async () => {
        const path = await store.findPath('a.md', 'c.md');
        expect(path).not.toBeNull();
        expect(path?.[0]).toBe('a.md');
        expect(path?.[path.length - 1]).toBe('c.md');
      });

      it('returns shortest path', async () => {
        // a -> b -> c (length 3) or a -> d -> c (length 3)
        const path = await store.findPath('a.md', 'c.md');
        expect(path).toHaveLength(3);
      });

      it('returns null when no path exists', async () => {
        const path = await store.findPath('c.md', 'a.md');
        expect(path).toBeNull();
      });

      it('returns single node for same source and target', async () => {
        const path = await store.findPath('a.md', 'a.md');
        expect(path).toEqual(['a.md']);
      });

      it('returns null for non-existent source', async () => {
        const path = await store.findPath('missing.md', 'a.md');
        expect(path).toBeNull();
      });

      it('returns null for non-existent target', async () => {
        const path = await store.findPath('a.md', 'missing.md');
        expect(path).toBeNull();
      });
    });

    describe('getHubs', () => {
      it('returns top nodes by in_degree', async () => {
        const hubs = await store.getHubs('in_degree', 2);
        expect(hubs[0]).toEqual(['c.md', 2]);
      });

      it('returns top nodes by out_degree', async () => {
        const hubs = await store.getHubs('out_degree', 1);
        expect(hubs[0]).toEqual(['a.md', 2]);
      });

      it('respects limit', async () => {
        const hubs = await store.getHubs('in_degree', 2);
        expect(hubs).toHaveLength(2);
      });

      it('returns empty for empty store', async () => {
        const emptyStore = new DocStore(
          join(tempDir, 'empty-source'),
          join(tempDir, 'empty-cache')
        );
        await mkdir(join(tempDir, 'empty-source'), { recursive: true });
        await emptyStore.sync();

        const hubs = await emptyStore.getHubs('in_degree', 10);
        expect(hubs).toEqual([]);

        emptyStore.close();
      });

      it('handles non-existent source directory gracefully', async () => {
        const missingStore = new DocStore(
          join(tempDir, 'does-not-exist'),
          join(tempDir, 'missing-cache')
        );
        // sync() should not throw when source directory doesn't exist
        await missingStore.sync();

        const hubs = await missingStore.getHubs('in_degree', 10);
        expect(hubs).toEqual([]);

        missingStore.close();
      });
    });

    describe('centrality caching', () => {
      it('stores centrality after sync', async () => {
        // Centrality should have been computed during sync
        // Access cache to verify (via internal method or check via getHubs consistency)
        const hubs = await store.getHubs('in_degree', 10);

        // c has in_degree 2, b has 1, d has 1, a has 0
        expect(hubs.find((h) => h[0] === 'c.md')?.[1]).toBe(2);
        expect(hubs.find((h) => h[0] === 'a.md')?.[1]).toBe(0);
      });
    });
  });

  describe('VectorProvider delegation', () => {
    it('creates default SqliteVectorProvider if none injected', async () => {
      // Default store uses SqliteVectorProvider internally
      // Verify by performing vector operations without error
      await store.storeEmbedding('test.md', [0.1, 0.2, 0.3], 'test-model');
      const results = await store.searchByVector([0.1, 0.2, 0.3], 10);
      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe('test.md');
    });

    it('accepts injected VectorProvider', async () => {
      const mockVectorProvider: VectorProvider = {
        store: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(undefined),
        getModel: vi.fn().mockResolvedValue(null),
      };

      const customStore = new DocStore(sourceDir, cacheDir, mockVectorProvider);

      await customStore.storeEmbedding('doc.md', [1, 2, 3], 'custom-model');
      expect(mockVectorProvider.store).toHaveBeenCalledWith(
        'doc.md',
        [1, 2, 3],
        'custom-model'
      );

      customStore.close();
    });

    it('storeEmbedding delegates to VectorProvider.store', async () => {
      const mockVectorProvider: VectorProvider = {
        store: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(undefined),
        getModel: vi.fn().mockResolvedValue(null),
      };

      const customStore = new DocStore(sourceDir, cacheDir, mockVectorProvider);

      await customStore.storeEmbedding('node-id', [0.5, 0.6, 0.7], 'embedding-model');

      expect(mockVectorProvider.store).toHaveBeenCalledTimes(1);
      expect(mockVectorProvider.store).toHaveBeenCalledWith(
        'node-id',
        [0.5, 0.6, 0.7],
        'embedding-model'
      );

      customStore.close();
    });

    it('searchByVector delegates to VectorProvider.search', async () => {
      const mockResults: VectorSearchResult[] = [
        { id: 'a.md', distance: 0.1 },
        { id: 'b.md', distance: 0.2 },
      ];

      const mockVectorProvider: VectorProvider = {
        store: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue(mockResults),
        delete: vi.fn().mockResolvedValue(undefined),
        getModel: vi.fn().mockResolvedValue(null),
      };

      const customStore = new DocStore(sourceDir, cacheDir, mockVectorProvider);

      const results = await customStore.searchByVector([0.1, 0.2], 5);

      expect(mockVectorProvider.search).toHaveBeenCalledTimes(1);
      expect(mockVectorProvider.search).toHaveBeenCalledWith([0.1, 0.2], 5);
      expect(results).toEqual(mockResults);

      customStore.close();
    });
  });

  describe('security', () => {
    it('rejects path traversal in createNode', async () => {
      const maliciousNode: Node = {
        id: '../../../etc/passwd.md',
        title: 'Malicious',
        content: 'evil content',
        tags: [],
        outgoingLinks: [],
        properties: {},
      };

      await expect(store.createNode(maliciousNode)).rejects.toThrow(
        /outside.*source/i
      );
    });

    it('rejects path traversal with encoded sequences', async () => {
      const node: Node = {
        id: 'folder/../../escape.md',
        title: 'Escape',
        content: '',
        tags: [],
        outgoingLinks: [],
        properties: {},
      };

      await expect(store.createNode(node)).rejects.toThrow(/outside.*source/i);
    });
  });

  describe('case sensitivity consistency', () => {
    beforeEach(async () => {
      await writeMarkdownFile(
        'CamelCase.md',
        `---
title: Original
---
Content`
      );
      await store.sync();
    });

    it('updateNode works with different case than stored', async () => {
      await store.updateNode('camelcase.md', { title: 'Updated' });
      const node = await store.getNode('camelcase.md');
      expect(node?.title).toBe('Updated');
    });

    it('updateNode works with original case', async () => {
      await store.updateNode('CamelCase.md', { title: 'Updated' });
      const node = await store.getNode('camelcase.md');
      expect(node?.title).toBe('Updated');
    });

    it('deleteNode works with different case than stored', async () => {
      await store.deleteNode('CAMELCASE.md');
      const node = await store.getNode('camelcase.md');
      expect(node).toBeNull();
    });
  });

  describe('content link reparsing', () => {
    beforeEach(async () => {
      await writeMarkdownFile(
        'source.md',
        `---
title: Source
---
No links yet`
      );
      await writeMarkdownFile('target.md', '---\ntitle: Target\n---\nContent');
      await store.sync();
    });

    it('updates outgoingLinks when content changes', async () => {
      const before = await store.getNode('source.md');
      expect(before?.outgoingLinks).toEqual([]);

      await store.updateNode('source.md', {
        content: 'Now has [[target]] link',
      });

      const after = await store.getNode('source.md');
      expect(after?.outgoingLinks).toContain('target.md');
    });

    it('rebuilds graph when content adds new links', async () => {
      await store.updateNode('source.md', {
        content: 'Link to [[target]]',
      });

      const neighbors = await store.getNeighbors('source.md', {
        direction: 'out',
      });
      expect(neighbors.map((n) => n.id)).toContain('target.md');
    });
  });

  describe('exclude directories', () => {
    it('excludes .roux directory from sync', async () => {
      await writeMarkdownFile('visible.md', '# Visible');
      await writeMarkdownFile('.roux/hidden.md', '# Hidden');
      await writeMarkdownFile('.roux/cache/deep.md', '# Deep Hidden');

      await store.sync();
      const ids = await store.getAllNodeIds();

      expect(ids).toContain('visible.md');
      expect(ids).not.toContain('.roux/hidden.md');
      expect(ids).not.toContain('.roux/cache/deep.md');
    });
  });

  describe('concurrent operations', () => {
    it('handles concurrent sync calls without corruption', async () => {
      await writeMarkdownFile('a.md', '# A');
      await writeMarkdownFile('b.md', '# B');
      await writeMarkdownFile('c.md', '# C');

      // Call sync twice simultaneously
      await Promise.all([store.sync(), store.sync()]);

      const ids = await store.getAllNodeIds();
      expect(ids.sort()).toEqual(['a.md', 'b.md', 'c.md']);
    });
  });

  describe('unicode filenames', () => {
    it('indexes files with unicode names', async () => {
      await writeMarkdownFile('日本語.md', '# Japanese');
      await writeMarkdownFile('émoji-🎉.md', '# Emoji');

      await store.sync();

      const japanese = await store.getNode('日本語.md');
      const emoji = await store.getNode('émoji-🎉.md');

      expect(japanese).not.toBeNull();
      expect(emoji).not.toBeNull();
    });

    it('normalizes unicode filenames consistently', async () => {
      await writeMarkdownFile('Über.md', '# Umlaut');
      await store.sync();

      // Should be lowercased
      const node = await store.getNode('über.md');
      expect(node).not.toBeNull();
    });
  });
});
