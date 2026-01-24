import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DocStore } from '../../../src/providers/docstore/index.js';

describe('File Watcher Integration', () => {
  let tempDir: string;
  let sourceDir: string;
  let cacheDir: string;
  let store: DocStore;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'roux-watcher-integration-'));
    sourceDir = join(tempDir, 'source');
    cacheDir = join(tempDir, 'cache');
    await mkdir(sourceDir, { recursive: true });
    store = new DocStore(sourceDir, cacheDir);
    await store.sync();
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

  describe('real filesystem watching', () => {
    it('detects new file and adds to cache', async () => {
      const onChange = vi.fn();
      store.startWatching(onChange);

      // Give chokidar time to initialize
      await new Promise((r) => setTimeout(r, 200));

      // Create new file
      await writeMarkdownFile('new-note.md', '---\ntitle: New Note\n---\nContent');

      await vi.waitFor(
        async () => {
          const node = await store.getNode('new-note.md');
          expect(node).not.toBeNull();
          expect(node?.title).toBe('New Note');
        },
        { timeout: 8000 }
      );

      expect(onChange).toHaveBeenCalled();
    });

    it('detects file modification and updates cache', async () => {
      await writeMarkdownFile('existing.md', '---\ntitle: Original\n---\nContent');
      await store.sync();

      const onChange = vi.fn();
      store.startWatching(onChange);

      // Modify file
      await writeMarkdownFile('existing.md', '---\ntitle: Updated\n---\nNew content');

      await vi.waitFor(
        async () => {
          const node = await store.getNode('existing.md');
          expect(node?.title).toBe('Updated');
        },
        { timeout: 5000 }
      );

      expect(onChange).toHaveBeenCalled();
    });

    it('detects file deletion and removes from cache', async () => {
      const filePath = await writeMarkdownFile('to-delete.md', '# Will be deleted');
      await store.sync();

      expect(await store.getNode('to-delete.md')).not.toBeNull();

      const onChange = vi.fn();
      store.startWatching(onChange);

      // Give chokidar time to initialize
      await new Promise((r) => setTimeout(r, 200));

      // Delete file
      await unlink(filePath);

      await vi.waitFor(
        async () => {
          expect(await store.getNode('to-delete.md')).toBeNull();
        },
        { timeout: 8000 }
      );

      expect(onChange).toHaveBeenCalled();
    });

    it('batches rapid edits within debounce window', async () => {
      await writeMarkdownFile('rapid.md', '---\ntitle: V1\n---\nContent');
      await store.sync();

      const onChange = vi.fn();
      store.startWatching(onChange);

      // Rapid edits
      await writeMarkdownFile('rapid.md', '---\ntitle: V2\n---\nContent');
      await new Promise((r) => setTimeout(r, 100));
      await writeMarkdownFile('rapid.md', '---\ntitle: V3\n---\nContent');
      await new Promise((r) => setTimeout(r, 100));
      await writeMarkdownFile('rapid.md', '---\ntitle: V4\n---\nContent');

      await vi.waitFor(
        async () => {
          const node = await store.getNode('rapid.md');
          expect(node?.title).toBe('V4');
        },
        { timeout: 5000 }
      );

      // Should be called once (batched) or a few times but with final state correct
      expect(onChange).toHaveBeenCalled();
    });

    it('handles transient files (create then delete quickly)', async () => {
      const onChange = vi.fn();
      store.startWatching(onChange);

      // Also create a persistent file to verify watcher is working
      await writeMarkdownFile('persistent.md', '# Persistent');

      // Create and delete transient file
      const transientPath = await writeMarkdownFile('transient.md', '# Transient');
      await new Promise((r) => setTimeout(r, 50));
      await unlink(transientPath);

      await vi.waitFor(
        async () => {
          // Persistent file should be cached
          expect(await store.getNode('persistent.md')).not.toBeNull();
        },
        { timeout: 5000 }
      );

      // Transient file should not be in cache (add + unlink = no-op)
      expect(await store.getNode('transient.md')).toBeNull();
    });

    it('updates graph edges when links change', async () => {
      await writeMarkdownFile('source.md', '---\ntitle: Source\n---\nNo links yet');
      await writeMarkdownFile('target.md', '---\ntitle: Target\n---\nContent');
      await store.sync();

      // Initially no edge
      let neighbors = await store.getNeighbors('source.md', { direction: 'out' });
      expect(neighbors.map((n) => n.id)).not.toContain('target.md');

      store.startWatching();

      // Add link to target
      await writeMarkdownFile('source.md', '---\ntitle: Source\n---\nLink to [[target]]');

      await vi.waitFor(
        async () => {
          neighbors = await store.getNeighbors('source.md', { direction: 'out' });
          expect(neighbors.map((n) => n.id)).toContain('target.md');
        },
        { timeout: 5000 }
      );
    });

    it('ignores non-markdown files', async () => {
      const onChange = vi.fn();
      store.startWatching(onChange);

      // Create non-md files
      await writeFile(join(sourceDir, 'image.png'), Buffer.from('fake png'));
      await writeFile(join(sourceDir, 'data.json'), '{}');

      // Also create md file to verify watcher is working
      await writeMarkdownFile('real.md', '# Real');

      await vi.waitFor(
        async () => {
          expect(await store.getNode('real.md')).not.toBeNull();
        },
        { timeout: 5000 }
      );

      // Non-md files should not be tracked
      expect(await store.getAllNodeIds()).not.toContain('image.png');
      expect(await store.getAllNodeIds()).not.toContain('data.json');
    });

    it('ignores .obsidian directory', async () => {
      const onChange = vi.fn();
      store.startWatching(onChange);

      // Create files in .obsidian
      await mkdir(join(sourceDir, '.obsidian'), { recursive: true });
      await writeFile(join(sourceDir, '.obsidian/workspace.md'), '# Workspace');

      // Also create a valid file
      await writeMarkdownFile('valid.md', '# Valid');

      await vi.waitFor(
        async () => {
          expect(await store.getNode('valid.md')).not.toBeNull();
        },
        { timeout: 5000 }
      );

      // .obsidian file should not be tracked
      expect(await store.getNode('.obsidian/workspace.md')).toBeNull();
    });

    it('handles deeply nested directories', async () => {
      store.startWatching();

      // Give chokidar time to initialize
      await new Promise((r) => setTimeout(r, 200));

      await writeMarkdownFile('a/b/c/d/deep.md', '---\ntitle: Deep\n---\nContent');

      await vi.waitFor(
        async () => {
          const node = await store.getNode('a/b/c/d/deep.md');
          expect(node).not.toBeNull();
          expect(node?.title).toBe('Deep');
        },
        { timeout: 8000 }
      );
    });
  });
});
