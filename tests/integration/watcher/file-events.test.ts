import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DocStore } from '../../../src/providers/docstore/index.js';
import { SqliteVectorIndex } from '../../../src/providers/vector/index.js';

/**
 * Delay after startWatching() resolves to let OS-level filesystem watcher stabilize.
 *
 * WHY 100ms: Empirically determined through CI runs. chokidar's 'ready' event fires
 * after its initial directory scan completes, but the underlying OS watcher
 * (FSEvents on macOS, inotify on Linux) may not be fully subscribed yet.
 * Without this delay, the first file event after startWatching() can be missed.
 *
 * This is inherent to filesystem watching - there's no API to query "is the watcher
 * fully ready". 100ms works reliably across macOS/Linux in both local and CI.
 */
const WATCHER_STABILIZATION_MS = 100;

/**
 * Creates a callback that captures all changed IDs for later assertion.
 * Uses vi.waitFor for proper cleanup instead of leaky manual timeouts.
 */
function createChangeCapture(): {
  callback: (ids: string[]) => void;
  waitForChanges: () => Promise<string[]>;
  getAllChanges: () => string[][];
  waitForNChanges: (n: number) => Promise<string[][]>;
} {
  const allChanges: string[][] = [];

  const callback = (changedIds: string[]) => {
    allChanges.push(changedIds);
  };

  const waitForChanges = async (): Promise<string[]> => {
    await vi.waitFor(
      () => {
        if (allChanges.length === 0) {
          throw new Error('Changes not yet received');
        }
      },
      { timeout: 5000 }
    );
    // Return the most recent change batch for backwards compatibility
    return allChanges[allChanges.length - 1]!;
  };

  const getAllChanges = (): string[][] => {
    return [...allChanges];
  };

  const waitForNChanges = async (n: number): Promise<string[][]> => {
    await vi.waitFor(
      () => {
        if (allChanges.length < n) {
          throw new Error(`Only ${allChanges.length}/${n} changes received`);
        }
      },
      { timeout: 5000 }
    );
    return [...allChanges];
  };

  return { callback, waitForChanges, getAllChanges, waitForNChanges };
}

/**
 * Start watching and wait for the watcher to stabilize.
 */
async function startWatchingStable(
  store: DocStore,
  callback?: (ids: string[]) => void
): Promise<void> {
  await store.startWatching(callback);
  await new Promise((r) => setTimeout(r, WATCHER_STABILIZATION_MS));
}

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
    store = new DocStore({ sourceRoot: sourceDir, cacheDir });
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

  /**
   * Get the stable nanoid for a node by its path.
   * With stable frontmatter IDs, node.id is a nanoid, not a path.
   */
  const getIdByPath = async (relativePath: string): Promise<string> => {
    const node = await store.getNode(relativePath);
    if (!node) throw new Error(`Node not found: ${relativePath}`);
    return node.id;
  };

  describe('real filesystem watching', () => {
    it('detects new file and adds to cache', async () => {
      const { callback, waitForChanges } = createChangeCapture();
      await startWatchingStable(store, callback);

      await writeMarkdownFile('new-note.md', '---\ntitle: New Note\n---\nContent');

      const changedIds = await waitForChanges();
      const node = await store.getNode('new-note.md');

      // changedIds contains stable nanoid IDs, not paths
      expect(node).not.toBeNull();
      expect(changedIds).toContain(node!.id);
      expect(node?.title).toBe('New Note');
    });

    it('detects file modification and updates cache', async () => {
      await writeMarkdownFile('existing.md', '---\ntitle: Original\n---\nContent');
      await store.sync();

      const { callback, waitForChanges } = createChangeCapture();
      await startWatchingStable(store, callback);

      await writeMarkdownFile('existing.md', '---\ntitle: Updated\n---\nNew content');

      const changedIds = await waitForChanges();

      // Watcher should report the updated node
      // Note: If file is rewritten without ID, a new stable ID is generated
      const node = await store.getNode('existing.md');
      expect(node).not.toBeNull();
      expect(changedIds).toContain(node!.id);
      expect(node?.title).toBe('Updated');
    });

    it('detects file deletion and removes from cache', async () => {
      const filePath = await writeMarkdownFile('to-delete.md', '# Will be deleted');
      await store.sync();

      const nodeId = await getIdByPath('to-delete.md');
      expect(await store.getNode('to-delete.md')).not.toBeNull();

      const { callback, waitForChanges } = createChangeCapture();
      await startWatchingStable(store, callback);

      await unlink(filePath);

      const changedIds = await waitForChanges();

      // changedIds contains stable nanoid IDs
      expect(changedIds).toContain(nodeId);
      expect(await store.getNode('to-delete.md')).toBeNull();
    });

    it('batches rapid edits within debounce window', async () => {
      await writeMarkdownFile('rapid.md', '---\ntitle: V1\n---\nContent');
      await store.sync();

      // Track all onChange calls
      const allChanges: string[][] = [];
      let resolveFirstChange: () => void;
      const firstChangePromise = new Promise<void>((resolve) => {
        resolveFirstChange = resolve;
      });

      const inlineCallback = (changedIds: string[]) => {
        allChanges.push(changedIds);
        resolveFirstChange();
      };
      await startWatchingStable(store, inlineCallback);

      // Rapid edits within debounce window
      await writeMarkdownFile('rapid.md', '---\ntitle: V2\n---\nContent');
      await new Promise((r) => setTimeout(r, 100));
      await writeMarkdownFile('rapid.md', '---\ntitle: V3\n---\nContent');
      await new Promise((r) => setTimeout(r, 100));
      await writeMarkdownFile('rapid.md', '---\ntitle: V4\n---\nContent');

      // Wait for at least one batch to process
      await firstChangePromise;

      // Wait a bit more to let any additional batches complete
      await new Promise((r) => setTimeout(r, 1500));

      // Final state should be V4
      const node = await store.getNode('rapid.md');
      expect(node?.title).toBe('V4');

      // Batching should limit calls - at most 3 (one per debounce window reset).
      // Range 1-3 is correct because:
      //   - Minimum 1: All edits could fall within a single debounce window
      //   - Maximum 3: Each 100ms delay could trigger separate batches if
      //     filesystem delivers events with timing variations
      // This test verifies batching WORKS, not exact batch count (which depends
      // on OS scheduler, disk speed, etc). Unit tests verify exact debounce behavior.
      expect(allChanges.length).toBeGreaterThanOrEqual(1);
      expect(allChanges.length).toBeLessThanOrEqual(3);
    });

    it('handles transient files (create then delete quickly)', async () => {
      const { callback, waitForChanges } = createChangeCapture();
      await startWatchingStable(store, callback);

      // Create persistent file first
      await writeMarkdownFile('persistent.md', '# Persistent');

      // Create and delete transient file within debounce window.
      // 50ms delay ensures filesystem has time to register the add event before
      // we unlink. Without this, the add event might not be queued at all,
      // and we'd be testing nothing. The 50ms is well under the 1000ms debounce.
      const transientPath = await writeMarkdownFile('transient.md', '# Transient');
      await new Promise((r) => setTimeout(r, 50));
      await unlink(transientPath);

      // Wait for watcher to process
      const changedIds = await waitForChanges();
      const persistentNode = await store.getNode('persistent.md');

      // Persistent file should be in the changes and cached
      // changedIds contains stable nanoid IDs
      expect(persistentNode).not.toBeNull();
      expect(changedIds).toContain(persistentNode!.id);

      // Transient file should not be in cache (add + unlink = no-op)
      expect(await store.getNode('transient.md')).toBeNull();
    });

    it('updates graph edges when links change', async () => {
      await writeMarkdownFile('source.md', '---\ntitle: Source\n---\nNo links yet');
      await writeMarkdownFile('target.md', '---\ntitle: Target\n---\nContent');
      await store.sync();

      const targetId = await getIdByPath('target.md');

      // Initially no edge
      let neighbors = await store.getNeighbors('source.md', { direction: 'out' });
      expect(neighbors.map((n) => n.id)).not.toContain(targetId);

      const { callback, waitForChanges } = createChangeCapture();
      await startWatchingStable(store, callback);

      await writeMarkdownFile('source.md', '---\ntitle: Source\n---\nLink to [[target]]');

      await waitForChanges();

      neighbors = await store.getNeighbors('source.md', { direction: 'out' });
      expect(neighbors.map((n) => n.id)).toContain(targetId);
    });

    it('ignores non-markdown files', async () => {
      const { callback, waitForChanges } = createChangeCapture();
      await startWatchingStable(store, callback);

      // Create non-md files (these should be ignored)
      await writeFile(join(sourceDir, 'image.png'), Buffer.from('fake png'));
      await writeFile(join(sourceDir, 'data.json'), '{}');

      // Create md file - this will trigger onChange
      await writeMarkdownFile('real.md', '# Real');

      const changedIds = await waitForChanges();
      const realNode = await store.getNode('real.md');

      // Only the md file should be in changes (changedIds contains stable IDs)
      expect(realNode).not.toBeNull();
      expect(changedIds).toContain(realNode!.id);
      expect(changedIds).not.toContain('image.png');
      expect(changedIds).not.toContain('data.json');

      // Non-md files should not be tracked
      expect(await store.getAllNodeIds()).not.toContain('image.png');
      expect(await store.getAllNodeIds()).not.toContain('data.json');
    });

    it('ignores .obsidian directory', async () => {
      const { callback, waitForChanges } = createChangeCapture();
      await startWatchingStable(store, callback);

      // Create files in .obsidian (should be ignored)
      await mkdir(join(sourceDir, '.obsidian'), { recursive: true });
      await writeFile(join(sourceDir, '.obsidian/workspace.md'), '# Workspace');

      // Create valid file - this will trigger onChange
      await writeMarkdownFile('valid.md', '# Valid');

      const changedIds = await waitForChanges();
      const validNode = await store.getNode('valid.md');

      // changedIds contains stable nanoid IDs
      expect(validNode).not.toBeNull();
      expect(changedIds).toContain(validNode!.id);
      expect(changedIds).not.toContain('.obsidian/workspace.md');

      // .obsidian file should not be tracked
      expect(await store.getNode('.obsidian/workspace.md')).toBeNull();
    });

    it('handles deeply nested directories', async () => {
      const { callback, waitForChanges } = createChangeCapture();
      await startWatchingStable(store, callback);

      await writeMarkdownFile('a/b/c/d/deep.md', '---\ntitle: Deep\n---\nContent');

      const changedIds = await waitForChanges();
      const node = await store.getNode('a/b/c/d/deep.md');

      // changedIds contains stable nanoid IDs
      expect(node).not.toBeNull();
      expect(changedIds).toContain(node!.id);
      expect(node?.title).toBe('Deep');
    });

    it('cleans up vector embedding when file is deleted (after TTL)', async () => {
      const vectorCacheDir = join(tempDir, 'vector-cache');
      await mkdir(vectorCacheDir, { recursive: true });
      const vectorProvider = new SqliteVectorIndex(vectorCacheDir);
      const storeWithVector = new DocStore({ sourceRoot: sourceDir, cacheDir, vectorIndex: vectorProvider });

      const filePath = await writeMarkdownFile(
        'with-embedding.md',
        '---\ntitle: With Embedding\n---\nContent for embedding'
      );
      await storeWithVector.sync();

      // Get the stable ID BEFORE deletion
      const nodeBeforeDelete = await storeWithVector.getNode('with-embedding.md');
      const nodeId = nodeBeforeDelete!.id;

      // Store embedding using stable ID
      await vectorProvider.store(nodeId, [0.1, 0.2, 0.3], 'test-model');
      expect(vectorProvider.hasEmbedding(nodeId)).toBe(true);

      // Override TTL for faster test
      // @ts-expect-error accessing private for testing
      storeWithVector.UNLINK_TTL_MS = 100;

      const { callback, waitForChanges, waitForNChanges } = createChangeCapture();
      await startWatchingStable(storeWithVector, callback);

      await unlink(filePath);

      const changedIds = await waitForChanges();

      // changedIds contains stable nanoid IDs - node removed from cache immediately
      expect(changedIds).toContain(nodeId);
      expect(await storeWithVector.getNode('with-embedding.md')).toBeNull();

      // Vector delete is deferred for rename detection - embedding still exists
      expect(vectorProvider.hasEmbedding(nodeId)).toBe(true);

      // Wait for TTL to expire
      await new Promise((r) => setTimeout(r, 150));

      // Trigger another event to force cleanup of expired pending unlinks
      await writeFile(join(sourceDir, 'trigger-cleanup.md'), '# Trigger', 'utf-8');

      // Wait for second batch of changes to complete
      await waitForNChanges(2);

      // Now the embedding should be cleaned up
      expect(vectorProvider.hasEmbedding(nodeId)).toBe(false);

      storeWithVector.close();
      vectorProvider.close();
    });
  });
});
