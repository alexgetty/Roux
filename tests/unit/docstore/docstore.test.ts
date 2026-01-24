import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DocStore } from '../../../src/providers/docstore/index.js';
import type { Node } from '../../../src/types/node.js';

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

  describe('Phase 5/6 stubs', () => {
    it('getNeighbors throws not implemented', async () => {
      await expect(
        store.getNeighbors('any.md', { direction: 'out' })
      ).rejects.toThrow(/not implemented/i);
    });

    it('findPath throws not implemented', async () => {
      await expect(store.findPath('a.md', 'b.md')).rejects.toThrow(
        /not implemented/i
      );
    });

    it('getHubs throws not implemented', async () => {
      await expect(store.getHubs('pagerank', 10)).rejects.toThrow(
        /not implemented/i
      );
    });

    it('storeEmbedding throws not implemented', async () => {
      await expect(
        store.storeEmbedding('id', [1, 2, 3], 'model')
      ).rejects.toThrow(/not implemented/i);
    });

    it('searchByVector throws not implemented', async () => {
      await expect(store.searchByVector([1, 2, 3], 10)).rejects.toThrow(
        /not implemented/i
      );
    });
  });
});
