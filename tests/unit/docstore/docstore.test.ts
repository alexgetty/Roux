import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DocStore } from '../../../src/providers/docstore/index.js';
import * as fileOps from '../../../src/providers/docstore/file-operations.js';
import type { Node } from '../../../src/types/node.js';
import type { VectorIndex, VectorSearchResult } from '../../../src/types/provider.js';

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
    store = new DocStore({ sourceRoot: sourceDir, cacheDir });
  });

  afterEach(async () => {
    store.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('id configuration', () => {
    it('defaults id to "docstore" when not provided', async () => {
      const idCacheDir = join(tempDir, 'id-default-cache');
      const defaultStore = new DocStore({ sourceRoot: sourceDir, cacheDir: idCacheDir });
      expect(defaultStore.id).toBe('docstore');
      defaultStore.close();
    });

    it('uses provided id when specified', async () => {
      const idCacheDir = join(tempDir, 'id-custom-cache');
      const customStore = new DocStore({ sourceRoot: sourceDir, cacheDir: idCacheDir, id: 'custom-store' });
      expect(customStore.id).toBe('custom-store');
      customStore.close();
    });
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

      it('extracts wikilinks from content and resolves to graph edges', async () => {
        // Set up a target node in a subdirectory
        await writeMarkdownFile(
          'recipes/soup.md',
          '---\ntitle: Soup\n---\nA warm bowl.'
        );
        await store.sync();

        // Create a new node with wikilink to the target
        const node: Node = {
          id: 'notes/meal-plan.md',
          title: 'Meal Plan',
          content: 'Tonight: [[soup]]',
          tags: [],
          outgoingLinks: [],
          properties: {},
        };

        await store.createNode(node);

        // The created node should have resolved outgoing links
        const created = await store.getNode('notes/meal-plan.md');
        expect(created?.outgoingLinks).toContain('recipes/soup.md');

        // The graph should have the edge
        const neighbors = await store.getNeighbors('notes/meal-plan.md', {
          direction: 'out',
        });
        expect(neighbors.map((n) => n.id)).toContain('recipes/soup.md');
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

      it('derives outgoingLinks from content and rebuilds graph', async () => {
        await writeMarkdownFile('linked.md', '---\ntitle: Linked\n---\nContent');
        await store.sync();

        await store.updateNode('target.md', {
          content: 'Now links to [[linked]]',
        });

        // Graph should be rebuilt - target should now have linked as neighbor
        const neighbors = await store.getNeighbors('target.md', {
          direction: 'out',
        });
        expect(neighbors.map((n) => n.id)).toContain('linked.md');
      });

      it('resolves wikilinks in updated content to full paths', async () => {
        // Add a node in a subdirectory
        await writeMarkdownFile(
          'recipes/pasta.md',
          '---\ntitle: Pasta\n---\nBoil water.'
        );
        await store.sync();

        // Update target's content with a bare wikilink
        await store.updateNode('target.md', {
          content: 'Make some [[pasta]] tonight.',
        });

        // The link should resolve from "pasta.md" to "recipes/pasta.md"
        const node = await store.getNode('target.md');
        expect(node?.outgoingLinks).toContain('recipes/pasta.md');

        // Graph should reflect the resolved edge
        const neighbors = await store.getNeighbors('target.md', {
          direction: 'out',
        });
        expect(neighbors.map((n) => n.id)).toContain('recipes/pasta.md');
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

      it('delegates to VectorIndex.delete', async () => {
        const mockVector: VectorIndex = {
          store: vi.fn().mockResolvedValue(undefined),
          search: vi.fn().mockResolvedValue([]),
          delete: vi.fn().mockResolvedValue(undefined),
          getModel: vi.fn().mockResolvedValue(null),
        };

        const customStore = new DocStore({ sourceRoot: sourceDir, cacheDir, vectorIndex: mockVector });
        await writeMarkdownFile('to-delete.md', '# Will be deleted');
        await customStore.sync();

        await customStore.deleteNode('to-delete.md');

        expect(mockVector.delete).toHaveBeenCalledWith('to-delete.md');
        customStore.close();
      });

      it('deleteNode removes file from disk AND embedding from vector store', async () => {
        // Uses real SqliteVectorIndex (default), not mock
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
      it('returns empty array when graph not ready (graceful degradation)', async () => {
        // Create new store without syncing
        const unsyncedStore = new DocStore({ sourceRoot: sourceDir, cacheDir: join(tempDir, 'unsynced-cache') });
        const neighbors = await unsyncedStore.getNeighbors('any.md', { direction: 'out' });
        expect(neighbors).toEqual([]);
        unsyncedStore.close();
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
      it('returns null when graph not ready (graceful degradation)', async () => {
        const unsyncedStore = new DocStore({ sourceRoot: sourceDir, cacheDir: join(tempDir, 'unsynced-cache-path') });
        const path = await unsyncedStore.findPath('a.md', 'b.md');
        expect(path).toBeNull();
        unsyncedStore.close();
      });

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
      it('returns empty array when graph not ready (graceful degradation)', async () => {
        const unsyncedStore = new DocStore({ sourceRoot: sourceDir, cacheDir: join(tempDir, 'unsynced-cache-hubs') });
        const hubs = await unsyncedStore.getHubs('in_degree', 10);
        expect(hubs).toEqual([]);
        unsyncedStore.close();
      });

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
        const emptyStore = new DocStore({
          sourceRoot: join(tempDir, 'empty-source'),
          cacheDir: join(tempDir, 'empty-cache'),
        });
        await mkdir(join(tempDir, 'empty-source'), { recursive: true });
        await emptyStore.sync();

        const hubs = await emptyStore.getHubs('in_degree', 10);
        expect(hubs).toEqual([]);

        emptyStore.close();
      });

      it('handles non-existent source directory gracefully', async () => {
        const missingStore = new DocStore({
          sourceRoot: join(tempDir, 'does-not-exist'),
          cacheDir: join(tempDir, 'missing-cache'),
        });
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

  describe('VectorIndex delegation', () => {
    it('creates default SqliteVectorIndex if none injected', async () => {
      // Default store uses SqliteVectorIndex internally
      // Verify by performing vector operations without error
      await store.storeEmbedding('test.md', [0.1, 0.2, 0.3], 'test-model');
      const results = await store.searchByVector([0.1, 0.2, 0.3], 10);
      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe('test.md');
    });

    it('accepts injected VectorIndex', async () => {
      const mockVectorIndex: VectorIndex = {
        store: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(undefined),
        getModel: vi.fn().mockResolvedValue(null),
      };

      const customStore = new DocStore({ sourceRoot: sourceDir, cacheDir, vectorIndex: mockVectorIndex });

      await customStore.storeEmbedding('doc.md', [1, 2, 3], 'custom-model');
      expect(mockVectorIndex.store).toHaveBeenCalledWith(
        'doc.md',
        [1, 2, 3],
        'custom-model'
      );

      customStore.close();
    });

    it('storeEmbedding delegates to VectorIndex.store', async () => {
      const mockVectorIndex: VectorIndex = {
        store: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(undefined),
        getModel: vi.fn().mockResolvedValue(null),
      };

      const customStore = new DocStore({ sourceRoot: sourceDir, cacheDir, vectorIndex: mockVectorIndex });

      await customStore.storeEmbedding('node-id', [0.5, 0.6, 0.7], 'embedding-model');

      expect(mockVectorIndex.store).toHaveBeenCalledTimes(1);
      expect(mockVectorIndex.store).toHaveBeenCalledWith(
        'node-id',
        [0.5, 0.6, 0.7],
        'embedding-model'
      );

      customStore.close();
    });

    it('searchByVector delegates to VectorIndex.search', async () => {
      const mockResults: VectorSearchResult[] = [
        { id: 'a.md', distance: 0.1 },
        { id: 'b.md', distance: 0.2 },
      ];

      const mockVectorIndex: VectorIndex = {
        store: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue(mockResults),
        delete: vi.fn().mockResolvedValue(undefined),
        getModel: vi.fn().mockResolvedValue(null),
      };

      const customStore = new DocStore({ sourceRoot: sourceDir, cacheDir, vectorIndex: mockVectorIndex });

      const results = await customStore.searchByVector([0.1, 0.2], 5);

      expect(mockVectorIndex.search).toHaveBeenCalledTimes(1);
      expect(mockVectorIndex.search).toHaveBeenCalledWith([0.1, 0.2], 5);
      expect(results).toEqual(mockResults);

      customStore.close();
    });

    it('hasEmbedding delegates to VectorIndex', async () => {
      const mockVectorIndex: VectorIndex = {
        store: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(undefined),
        getModel: vi.fn().mockResolvedValue(null),
        hasEmbedding: vi.fn().mockReturnValue(true),
      };

      const customStore = new DocStore({ sourceRoot: sourceDir, cacheDir, vectorIndex: mockVectorIndex });
      expect(customStore.hasEmbedding('doc.md')).toBe(true);
      expect(mockVectorIndex.hasEmbedding).toHaveBeenCalledWith('doc.md');
      customStore.close();
    });

    it('hasEmbedding returns false when vectorIndex is null', async () => {
      const customStore = new DocStore({ sourceRoot: sourceDir, cacheDir });
      // Force vectorIndex to null to cover the guard branch
      Object.defineProperty(customStore, 'vectorIndex', { value: null });
      expect(customStore.hasEmbedding('doc.md')).toBe(false);
    });

    it('close() does NOT close injected VectorIndex (caller owns lifecycle)', async () => {
      const closeMock = vi.fn();
      const mockVectorIndex: VectorIndex & { close: () => void } = {
        store: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(undefined),
        getModel: vi.fn().mockResolvedValue(null),
        close: closeMock,
      };

      const customStore = new DocStore({ sourceRoot: sourceDir, cacheDir, vectorIndex: mockVectorIndex });
      customStore.close();

      expect(closeMock).not.toHaveBeenCalled();
    });

    it('close() closes owned VectorIndex when DocStore created it', async () => {
      // Create a new store with a separate cache dir to get fresh VectorIndex
      const ownedCacheDir = join(tempDir, 'owned-vector-cache');
      const ownedStore = new DocStore({ sourceRoot: sourceDir, cacheDir: ownedCacheDir });

      // Store something to ensure vector DB is created
      await ownedStore.storeEmbedding('test.md', [0.1, 0.2, 0.3], 'model');

      // close() should close the owned VectorIndex without error
      // If there's a resource leak, subsequent operations might fail or DB stays open
      ownedStore.close();

      // Verify the VectorIndex was closed by trying to create a new one
      // at the same path - if old one wasn't closed, this might fail on some systems
      const newStore = new DocStore({ sourceRoot: sourceDir, cacheDir: ownedCacheDir });
      await newStore.storeEmbedding('test2.md', [0.4, 0.5, 0.6], 'model');
      newStore.close();
    });

    it('close() is idempotent - safe to call multiple times', () => {
      const idempotentCacheDir = join(tempDir, 'idempotent-cache');
      const idempotentStore = new DocStore({ sourceRoot: sourceDir, cacheDir: idempotentCacheDir });

      // First close
      idempotentStore.close();

      // Second close should not throw
      expect(() => idempotentStore.close()).not.toThrow();

      // Third close should also not throw
      expect(() => idempotentStore.close()).not.toThrow();
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

    it('handles file deleted during sync gracefully (ENOENT)', async () => {
      // This test verifies the ENOENT handling in sync() still works.
      // We test by creating files, syncing once, deleting a file,
      // and re-syncing to verify the deleted file is removed from cache.
      await writeMarkdownFile('a.md', '# A');
      await writeMarkdownFile('b.md', '# B');
      await writeMarkdownFile('vanish.md', '# Will vanish');

      await store.sync();

      // Verify all files are synced
      let ids = await store.getAllNodeIds();
      expect(ids.sort()).toEqual(['a.md', 'b.md', 'vanish.md']);

      // Delete file on disk
      await rm(join(sourceDir, 'vanish.md'));

      // Re-sync should not throw and should remove deleted file
      await expect(store.sync()).resolves.not.toThrow();

      ids = await store.getAllNodeIds();
      expect(ids.sort()).toEqual(['a.md', 'b.md']);
    });

    it('skips ENOENT during first sync (file deleted between collectFiles and getFileMtime)', async () => {
      // Create files
      await writeMarkdownFile('a.md', '# A');
      await writeMarkdownFile('b.md', '# B');
      await writeMarkdownFile('vanish.md', '# Will vanish');

      // Mock getFileMtime to throw ENOENT for vanish.md (simulating race condition)
      const originalGetFileMtime = fileOps.getFileMtime;
      const mockGetFileMtime = vi.spyOn(fileOps, 'getFileMtime').mockImplementation(
        async (filePath: string) => {
          if (filePath.includes('vanish.md')) {
            const error = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
            error.code = 'ENOENT';
            throw error;
          }
          return originalGetFileMtime(filePath);
        }
      );

      // Use a fresh store
      const racyStore = new DocStore({ sourceRoot: sourceDir, cacheDir: join(tempDir, 'racy-cache') });

      try {
        // Sync should not throw - ENOENT should be caught and file skipped
        await expect(racyStore.sync()).resolves.not.toThrow();

        const ids = await racyStore.getAllNodeIds();
        expect(ids.sort()).toEqual(['a.md', 'b.md']);
      } finally {
        mockGetFileMtime.mockRestore();
        racyStore.close();
      }
    });

    it('logs non-ENOENT errors and continues sync (graceful degradation)', async () => {
      await writeMarkdownFile('a.md', '# A');
      await writeMarkdownFile('b.md', '# B');

      // Mock getFileMtime to throw non-ENOENT error for a.md
      const mockGetFileMtime = vi.spyOn(fileOps, 'getFileMtime').mockImplementation(
        async (filePath: string) => {
          if (filePath.includes('a.md')) {
            const error = new Error('EACCES: permission denied') as NodeJS.ErrnoException;
            error.code = 'EACCES';
            throw error;
          }
          // Return real mtime for other files
          const { stat } = await import('node:fs/promises');
          return (await stat(filePath)).mtimeMs;
        }
      );

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorStore = new DocStore({ sourceRoot: sourceDir, cacheDir: join(tempDir, 'error-cache') });

      try {
        // Sync should NOT throw - graceful degradation
        await expect(errorStore.sync()).resolves.not.toThrow();

        // Warning should be logged for the failing file
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('a.md'),
          expect.any(Error)
        );

        // Other files should still be synced
        const ids = await errorStore.getAllNodeIds();
        expect(ids).toContain('b.md');
        expect(ids).not.toContain('a.md');
      } finally {
        mockGetFileMtime.mockRestore();
        consoleSpy.mockRestore();
        errorStore.close();
      }
    });

    it('sync passes mtime to parseFile, avoiding redundant getFileMtime call', async () => {
      await writeMarkdownFile('test.md', '---\ntitle: Test\n---\nContent');

      const originalGetFileMtime = fileOps.getFileMtime;
      const mtimeCalls: string[] = [];
      const mockGetFileMtime = vi.spyOn(fileOps, 'getFileMtime').mockImplementation(
        async (filePath: string) => {
          mtimeCalls.push(filePath);
          return originalGetFileMtime(filePath);
        }
      );

      const syncStore = new DocStore({ sourceRoot: sourceDir, cacheDir: join(tempDir, 'mtime-opt-cache') });

      try {
        await syncStore.sync();

        // getFileMtime should only be called ONCE per file during sync
        // (for cache comparison), not twice (once for comparison, once in parseFile)
        const testMdCalls = mtimeCalls.filter(p => p.includes('test.md'));
        expect(testMdCalls).toHaveLength(1);
      } finally {
        mockGetFileMtime.mockRestore();
        syncStore.close();
      }
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

  describe('wiki-link resolution', () => {
    it('resolves bare filename to full path', async () => {
      await writeMarkdownFile('folder/target.md', '---\ntitle: Target\n---\nContent');
      await writeMarkdownFile('source.md', 'Link to [[target]]');

      await store.sync();
      const node = await store.getNode('source.md');

      expect(node?.outgoingLinks).toContain('folder/target.md');
    });

    it('handles case-insensitive matching', async () => {
      await writeMarkdownFile('Items/Lemon.md', '---\ntitle: Lemon\n---\nCitrus fruit');
      await writeMarkdownFile('recipe.md', 'Uses [[LEMON]] for flavor');

      await store.sync();
      const node = await store.getNode('recipe.md');

      expect(node?.outgoingLinks).toContain('items/lemon.md');
    });

    it('resolves aliased links', async () => {
      await writeMarkdownFile('people/john.md', '---\ntitle: John\n---\nA person');
      await writeMarkdownFile('note.md', 'Written by [[john|John Smith]]');

      await store.sync();
      const node = await store.getNode('note.md');

      expect(node?.outgoingLinks).toContain('people/john.md');
    });

    it('leaves unresolvable links as-is', async () => {
      await writeMarkdownFile('source.md', 'Link to [[nonexistent]]');

      await store.sync();
      const node = await store.getNode('source.md');

      expect(node?.outgoingLinks).toContain('nonexistent.md');
    });

    it('picks alphabetically first match for ambiguous filenames', async () => {
      await writeMarkdownFile('a/item.md', '---\ntitle: Item A\n---\nA');
      await writeMarkdownFile('b/item.md', '---\ntitle: Item B\n---\nB');
      await writeMarkdownFile('ref.md', 'See [[item]]');

      await store.sync();
      const node = await store.getNode('ref.md');

      expect(node?.outgoingLinks).toContain('a/item.md');
      expect(node?.outgoingLinks).not.toContain('b/item.md');
    });

    it('treats partial path links literally (no suffix matching)', async () => {
      await writeMarkdownFile('deep/folder/target.md', '---\ntitle: Target\n---\nContent');
      await writeMarkdownFile('source.md', 'Link to [[folder/target]]');

      await store.sync();
      const node = await store.getNode('source.md');

      // Should NOT resolve to deep/folder/target.md — partial paths stay literal
      expect(node?.outgoingLinks).toContain('folder/target.md');
      expect(node?.outgoingLinks).not.toContain('deep/folder/target.md');
    });

    it('resolves self-links', async () => {
      await writeMarkdownFile('note.md', 'Reference to [[note]] itself');

      await store.sync();
      const node = await store.getNode('note.md');

      expect(node?.outgoingLinks).toContain('note.md');
    });

    it('leaves already-resolved links unchanged', async () => {
      await writeMarkdownFile('folder/target.md', '---\ntitle: Target\n---\nContent');
      await writeMarkdownFile('source.md', 'Link to [[folder/target]]');

      await store.sync();
      const node = await store.getNode('source.md');

      expect(node?.outgoingLinks).toContain('folder/target.md');
    });

    it('resolves multiple links independently', async () => {
      await writeMarkdownFile('docs/a.md', '---\ntitle: A\n---\nA');
      await writeMarkdownFile('notes/b.md', '---\ntitle: B\n---\nB');
      await writeMarkdownFile('source.md', 'Links: [[a]] and [[b]]');

      await store.sync();
      const node = await store.getNode('source.md');

      expect(node?.outgoingLinks).toContain('docs/a.md');
      expect(node?.outgoingLinks).toContain('notes/b.md');
    });

    it('forms graph edges after resolution', async () => {
      await writeMarkdownFile('graph/ingredients/lemon.md', '---\ntitle: Lemon\n---\nCitrus');
      await writeMarkdownFile('recipes/lemonade.md', 'Needs [[lemon]]');

      await store.sync();

      const neighbors = await store.getNeighbors('recipes/lemonade.md', {
        direction: 'out',
      });
      expect(neighbors.map((n) => n.id)).toContain('graph/ingredients/lemon.md');
    });

    it('resolves spaced wiki-link to dashed filename', async () => {
      await writeMarkdownFile('ingredients/sesame-oil.md', '---\ntitle: Sesame Oil\n---\nFragrant oil');
      await writeMarkdownFile('recipe.md', 'Add [[Sesame Oil]]');

      await store.sync();
      const node = await store.getNode('recipe.md');

      expect(node?.outgoingLinks).toContain('ingredients/sesame-oil.md');
    });

    it('resolves dashed wiki-link to spaced filename', async () => {
      await writeMarkdownFile('ingredients/sesame oil.md', '---\ntitle: Sesame Oil\n---\nFragrant oil');
      await writeMarkdownFile('recipe.md', 'Add [[sesame-oil]]');

      await store.sync();
      const node = await store.getNode('recipe.md');

      expect(node?.outgoingLinks).toContain('ingredients/sesame oil.md');
    });
  });

  describe('batch operations', () => {
    describe('listNodes', () => {
      beforeEach(async () => {
        await writeMarkdownFile('recipes/pasta.md', '---\ntitle: Pasta\ntags: [recipe, italian]\n---\nContent');
        await writeMarkdownFile('recipes/pizza.md', '---\ntitle: Pizza\ntags: [recipe, italian]\n---\nContent');
        await writeMarkdownFile('ingredients/tomato.md', '---\ntitle: Tomato\ntags: [ingredient]\n---\nContent');
        await store.sync();
      });

      it('returns ListNodesResult with nodes and total', async () => {
        const result = await store.listNodes({});
        expect(result.nodes.length).toBeGreaterThan(0);
        expect(result.nodes[0]).toHaveProperty('id');
        expect(result.nodes[0]).toHaveProperty('title');
        expect(result.nodes[0]).not.toHaveProperty('content');
        expect(result.total).toBe(result.nodes.length);
      });

      it('filters by tag', async () => {
        const result = await store.listNodes({ tag: 'recipe' });
        expect(result.nodes).toHaveLength(2);
        expect(result.total).toBe(2);
        expect(result.nodes.every(n => n.id.startsWith('recipes/'))).toBe(true);
      });

      it('filters by path prefix', async () => {
        const result = await store.listNodes({ path: 'ingredients/' });
        expect(result.nodes).toHaveLength(1);
        expect(result.total).toBe(1);
        expect(result.nodes[0]!.id).toBe('ingredients/tomato.md');
      });

      it('combines filters with AND', async () => {
        const result = await store.listNodes({ tag: 'italian', path: 'recipes/' });
        expect(result.nodes).toHaveLength(2);
        expect(result.total).toBe(2);
      });

      it('respects limit option but returns full total', async () => {
        const result = await store.listNodes({}, { limit: 1 });
        expect(result.nodes).toHaveLength(1);
        expect(result.total).toBe(3); // total matching, not slice length
      });

      it('respects offset option', async () => {
        const all = await store.listNodes({});
        const offset = await store.listNodes({}, { offset: 1 });
        expect(offset.nodes).toHaveLength(all.nodes.length - 1);
        expect(offset.total).toBe(all.total); // total unchanged with offset
      });
    });

    describe('resolveNodes', () => {
      beforeEach(async () => {
        await writeMarkdownFile('ingredients/ground beef.md', '---\ntitle: Ground Beef\ntags: [ingredient]\n---\nContent');
        await writeMarkdownFile('ingredients/cheddar cheese.md', '---\ntitle: Cheddar Cheese\ntags: [ingredient]\n---\nContent');
        await writeMarkdownFile('recipes/beef tacos.md', '---\ntitle: Beef Tacos\ntags: [recipe]\n---\nContent');
        await store.sync();
      });

      it('returns empty array for empty names', async () => {
        const result = await store.resolveNodes([]);
        expect(result).toEqual([]);
      });

      it('resolves with exact strategy (case-insensitive)', async () => {
        const result = await store.resolveNodes(['ground beef'], { strategy: 'exact' });
        expect(result).toHaveLength(1);
        expect(result[0]!.query).toBe('ground beef');
        expect(result[0]!.match).toBe('ingredients/ground beef.md');
        expect(result[0]!.score).toBe(1);
      });

      it('resolves with fuzzy strategy', async () => {
        const result = await store.resolveNodes(['ground bef'], { strategy: 'fuzzy' });
        expect(result[0]!.match).toBe('ingredients/ground beef.md');
        expect(result[0]!.score).toBeGreaterThan(0.7);
      });

      it('filters candidates by tag', async () => {
        const result = await store.resolveNodes(['beef'], { tag: 'recipe', strategy: 'fuzzy', threshold: 0.3 });
        // Should match Beef Tacos (recipe), not Ground Beef (ingredient)
        expect(result[0]!.match).toBe('recipes/beef tacos.md');
      });

      it('preserves batch order', async () => {
        const result = await store.resolveNodes(['cheddar cheese', 'ground beef'], { strategy: 'exact' });
        expect(result[0]!.query).toBe('cheddar cheese');
        expect(result[1]!.query).toBe('ground beef');
      });

      it('returns null match for no matches', async () => {
        const result = await store.resolveNodes(['xyz unknown'], { strategy: 'exact' });
        expect(result[0]!.match).toBeNull();
        expect(result[0]!.score).toBe(0);
      });

      it('returns unmatched for semantic strategy (not supported at DocStore level)', async () => {
        const result = await store.resolveNodes(['ground beef'], { strategy: 'semantic' });
        expect(result[0]!.match).toBeNull();
      });

      describe('threshold boundaries', () => {
        it('handles threshold of 0 (accepts any match)', async () => {
          // With threshold 0, even poor matches are accepted
          const result = await store.resolveNodes(['xyz'], { strategy: 'fuzzy', threshold: 0 });
          // Score 0 match should still be returned when threshold is 0
          expect(result[0]!.match).not.toBeNull();
        });

        it('handles threshold of 1 (exact matches only)', async () => {
          // Exact title match works
          const exactResult = await store.resolveNodes(['ground beef'], { strategy: 'fuzzy', threshold: 1 });
          expect(exactResult[0]!.match).toBe('ingredients/ground beef.md');

          // Near match rejected
          const nearResult = await store.resolveNodes(['ground bef'], { strategy: 'fuzzy', threshold: 1 });
          expect(nearResult[0]!.match).toBeNull();
        });

        it('includes match when score exactly equals threshold', async () => {
          // First, find the actual score for a known match
          const probeResult = await store.resolveNodes(['ground bef'], { strategy: 'fuzzy', threshold: 0 });
          const exactScore = probeResult[0]!.score;

          // With threshold set to exactly that score, should still match (>= semantics)
          const result = await store.resolveNodes(['ground bef'], { strategy: 'fuzzy', threshold: exactScore });
          expect(result[0]!.match).toBe('ingredients/ground beef.md');
          expect(result[0]!.score).toBe(exactScore);
        });
      });
    });

    describe('nodesExist', () => {
      beforeEach(async () => {
        await writeMarkdownFile('exists.md', '---\ntitle: Exists\n---\nContent');
        await writeMarkdownFile('also-exists.md', '---\ntitle: Also Exists\n---\nContent');
        await store.sync();
      });

      it('returns empty Map for empty input', async () => {
        const result = await store.nodesExist([]);
        expect(result.size).toBe(0);
      });

      it('returns true for existing nodes', async () => {
        const result = await store.nodesExist(['exists.md', 'also-exists.md']);
        expect(result.get('exists.md')).toBe(true);
        expect(result.get('also-exists.md')).toBe(true);
      });

      it('returns false for non-existing nodes', async () => {
        const result = await store.nodesExist(['missing.md']);
        expect(result.get('missing.md')).toBe(false);
      });

      it('normalizes IDs for case-insensitive lookup', async () => {
        const result = await store.nodesExist(['EXISTS.MD', 'ALSO-EXISTS.md']);
        expect(result.get('exists.md')).toBe(true);
        expect(result.get('also-exists.md')).toBe(true);
      });

      it('handles mixed existing and non-existing', async () => {
        const result = await store.nodesExist(['exists.md', 'missing.md']);
        expect(result.get('exists.md')).toBe(true);
        expect(result.get('missing.md')).toBe(false);
      });
    });
  });

  describe('getRandomNode', () => {
    it('returns null for empty store', async () => {
      const result = await store.getRandomNode();
      expect(result).toBeNull();
    });

    it('returns a node when store has nodes', async () => {
      await writeMarkdownFile('a.md', '---\ntitle: A\n---\nContent');
      await writeMarkdownFile('b.md', '---\ntitle: B\n---\nContent');
      await store.sync();

      const result = await store.getRandomNode();
      expect(result).not.toBeNull();
      expect(['a.md', 'b.md']).toContain(result?.id);
    });

    it('returns the only node when store has one', async () => {
      await writeMarkdownFile('only.md', '---\ntitle: Only\n---\nContent');
      await store.sync();

      const result = await store.getRandomNode();
      expect(result?.id).toBe('only.md');
    });

    it('filters by tags when provided', async () => {
      await writeMarkdownFile('tagged.md', '---\ntags: [special]\n---\nA');
      await writeMarkdownFile('untagged.md', '---\ntags: [other]\n---\nB');
      await store.sync();

      const result = await store.getRandomNode(['special']);
      expect(result?.id).toBe('tagged.md');
    });

    it('returns null when no nodes match tags', async () => {
      await writeMarkdownFile('a.md', '---\ntags: [one]\n---\nA');
      await writeMarkdownFile('b.md', '---\ntags: [two]\n---\nB');
      await store.sync();

      const result = await store.getRandomNode(['nonexistent']);
      expect(result).toBeNull();
    });

    it('returns any matching node with tags (any mode)', async () => {
      await writeMarkdownFile('first.md', '---\ntags: [match]\n---\nA');
      await writeMarkdownFile('second.md', '---\ntags: [match]\n---\nB');
      await writeMarkdownFile('third.md', '---\ntags: [nomatch]\n---\nC');
      await store.sync();

      const result = await store.getRandomNode(['match']);
      expect(result).not.toBeNull();
      expect(['first.md', 'second.md']).toContain(result?.id);
    });
  });

  describe('FormatReader integration', () => {
    describe('backward compatibility', () => {
      it('syncs .md files identically with default registry', async () => {
        await writeMarkdownFile(
          'note.md',
          `---
title: Test Note
tags:
  - tag1
custom: value
---
Content with [[Link]]`
        );

        await store.sync();
        const node = await store.getNode('note.md');

        expect(node).not.toBeNull();
        expect(node?.title).toBe('Test Note');
        expect(node?.tags).toEqual(['tag1']);
        expect(node?.properties['custom']).toBe('value');
        expect(node?.outgoingLinks).toContain('link.md');
      });
    });

    describe('multi-format filtering', () => {
      it('syncs only files with registered reader extensions', async () => {
        await writeMarkdownFile('note.md', '# Note');
        await writeFile(join(sourceDir, 'data.json'), '{}');
        await writeFile(join(sourceDir, 'README'), 'text');

        await store.sync();

        const ids = await store.getAllNodeIds();
        expect(ids).toEqual(['note.md']);
      });

      it('handles files with multiple dots in name', async () => {
        await writeMarkdownFile('report.2024.01.md', '# Report');

        await store.sync();
        const node = await store.getNode('report.2024.01.md');

        expect(node).not.toBeNull();
        expect(node?.id).toBe('report.2024.01.md');
      });
    });

    describe('graceful degradation', () => {
      it('continues sync when reader throws for a single file', async () => {
        // Create a custom registry with a throwing reader
        const { ReaderRegistry } = await import(
          '../../../src/providers/docstore/reader-registry.js'
        );
        const { MarkdownReader } = await import(
          '../../../src/providers/docstore/readers/markdown.js'
        );

        const realReader = new MarkdownReader();
        const throwingReader = {
          extensions: ['.md'],
          parse: (content: string, context: { relativePath: string }) => {
            if (context.relativePath.includes('broken')) {
              throw new Error('Simulated parse failure');
            }
            // Delegate to real reader for other files
            return realReader.parse(content, context as Parameters<typeof MarkdownReader.prototype.parse>[1]);
          },
        };

        const customRegistry = new ReaderRegistry();
        customRegistry.register(throwingReader);

        // Create store with custom registry
        const customStore = new DocStore({
          sourceRoot: sourceDir,
          cacheDir: join(tempDir, 'graceful-cache'),
          registry: customRegistry,
        });

        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        try {
          await writeMarkdownFile('valid.md', '# Valid');
          await writeMarkdownFile('broken.md', '# This will fail to parse');
          await writeMarkdownFile('also-valid.md', '# Also Valid');

          // Sync should not throw - parse error should be logged and file skipped
          await expect(customStore.sync()).resolves.not.toThrow();

          // Only valid files should be synced
          const ids = await customStore.getAllNodeIds();
          expect(ids.sort()).toEqual(['also-valid.md', 'valid.md']);

          // Warning should have been logged
          expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('broken.md'),
            expect.any(Error)
          );
        } finally {
          consoleSpy.mockRestore();
          customStore.close();
        }
      });

      it('logs warning with file path when reader throws', async () => {
        const { ReaderRegistry } = await import(
          '../../../src/providers/docstore/reader-registry.js'
        );

        const alwaysThrowsReader = {
          extensions: ['.md'],
          parse: () => {
            throw new Error('Always fails');
          },
        };

        const customRegistry = new ReaderRegistry();
        customRegistry.register(alwaysThrowsReader);

        const customStore = new DocStore({
          sourceRoot: sourceDir,
          cacheDir: join(tempDir, 'logging-cache'),
          registry: customRegistry,
        });

        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        try {
          await writeMarkdownFile('test.md', '# Test');

          await customStore.sync();

          // Should log with helpful context
          expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringMatching(/test\.md/i),
            expect.any(Error)
          );
        } finally {
          consoleSpy.mockRestore();
          customStore.close();
        }
      });
    });
  });

  describe('FileWatcher injection', () => {
    it('uses injected FileWatcher instead of creating one', async () => {
      let isWatchingState = false;
      const mockFileWatcher = {
        start: vi.fn().mockImplementation(() => {
          isWatchingState = true;
          return Promise.resolve();
        }),
        stop: vi.fn().mockImplementation(() => {
          isWatchingState = false;
        }),
        isWatching: vi.fn().mockImplementation(() => isWatchingState),
        flush: vi.fn(),
      };

      const customStore = new DocStore({
        sourceRoot: sourceDir,
        cacheDir: join(tempDir, 'watcher-inject-cache'),
        fileWatcher: mockFileWatcher as unknown as import('../../../src/providers/docstore/watcher.js').FileWatcher,
      });

      // FileWatcher was injected, not created
      await customStore.startWatching();

      // Verify injected watcher's start() was called
      expect(mockFileWatcher.start).toHaveBeenCalled();
      expect(customStore.isWatching()).toBe(true);

      // Verify injected watcher's stop() is called
      customStore.stopWatching();
      expect(mockFileWatcher.stop).toHaveBeenCalled();

      customStore.close();
    });

    it('does not create new FileWatcher when one is injected', async () => {
      const mockFileWatcher = {
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn(),
        isWatching: vi.fn().mockReturnValue(false),
        flush: vi.fn(),
      };

      const customStore = new DocStore({
        sourceRoot: sourceDir,
        cacheDir: join(tempDir, 'watcher-no-create-cache'),
        fileWatcher: mockFileWatcher as unknown as import('../../../src/providers/docstore/watcher.js').FileWatcher,
      });

      // Call startWatching - should use injected, not create new
      await customStore.startWatching();

      // The injected watcher's start should be called
      expect(mockFileWatcher.start).toHaveBeenCalledTimes(1);

      customStore.close();
    });
  });
});
