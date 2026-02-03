/**
 * DocStore watcher integration tests
 *
 * These tests verify DocStore's integration with FileWatcher:
 * - Batch processing (handleWatcherBatch)
 * - Cache and graph updates
 * - onChange callback
 * - Error handling during file processing
 *
 * FileWatcher unit tests (coalescing, debouncing, filtering) are in file-watcher.test.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DocStore, FileWatcher } from '../../../src/providers/docstore/index.js';

// Mock chokidar
vi.mock('chokidar', () => {
  const mockWatcher = {
    on: vi.fn().mockReturnThis(),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return {
    watch: vi.fn(() => mockWatcher),
    __mockWatcher: mockWatcher,
  };
});

// Import after mocking
import * as chokidar from 'chokidar';

// Helper to get mock watcher and trigger events
function getMockWatcher() {
  const mock = chokidar as unknown as {
    watch: Mock;
    __mockWatcher: {
      on: Mock;
      close: Mock;
    };
  };
  return mock.__mockWatcher;
}

function triggerEvent(event: string, arg?: string | Error) {
  const mockWatcher = getMockWatcher();
  const onCalls = mockWatcher.on.mock.calls;
  const handler = onCalls.find((call: unknown[]) => call[0] === event)?.[1] as
    | ((arg?: string | Error) => void)
    | undefined;
  if (!handler) {
    throw new Error(`No handler registered for event '${event}'`);
  }
  handler(arg);
}

describe('DocStore watcher integration', () => {
  let tempDir: string;
  let sourceDir: string;
  let cacheDir: string;
  let store: DocStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    tempDir = await mkdtemp(join(tmpdir(), 'roux-watcher-test-'));
    sourceDir = join(tempDir, 'source');
    cacheDir = join(tempDir, 'cache');
    await mkdir(sourceDir, { recursive: true });
    store = new DocStore({ sourceRoot: sourceDir, cacheDir });
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

  describe('onChange callback', () => {
    it('called with correct IDs for add event', async () => {
      await writeMarkdownFile('new-note.md', '# New Note');

      const onChange = vi.fn();
      store.startWatching(onChange);

      triggerEvent('add', join(sourceDir, 'new-note.md'));

      await vi.waitFor(
        async () => {
          // onChange receives stable IDs, not paths
          expect(onChange).toHaveBeenCalled();
          const passedIds = onChange.mock.calls[0][0] as string[];
          expect(passedIds).toHaveLength(1);
          // Verify the ID is a valid stable ID (12-char nanoid)
          expect(passedIds[0]).toMatch(/^[A-Za-z0-9_-]{12}$/);
          // Verify we can look up the node by the returned ID
          const node = await store.getNode(passedIds[0]);
          expect(node).not.toBeNull();
          expect(node!.title).toBe('New Note');
        },
        { timeout: 2000 }
      );
    });

    it('called with correct IDs for change event', async () => {
      await writeMarkdownFile('existing.md', '# Existing');
      await store.sync();

      // Get stable ID after sync
      const node = await store.getNode('existing.md');
      expect(node).not.toBeNull();
      const stableId = node!.id;

      const onChange = vi.fn();
      store.startWatching(onChange);

      triggerEvent('change', join(sourceDir, 'existing.md'));

      await vi.waitFor(
        () => {
          // onChange receives stable IDs, not paths
          expect(onChange).toHaveBeenCalledWith(
            expect.arrayContaining([stableId])
          );
        },
        { timeout: 2000 }
      );
    });

    it('called with correct IDs for unlink event', async () => {
      await writeMarkdownFile('deleted.md', '# Deleted');
      await store.sync();

      // Get the stable ID before deletion
      const node = await store.getNode('deleted.md');
      expect(node).not.toBeNull();
      const stableId = node!.id;

      const onChange = vi.fn();
      store.startWatching(onChange);

      triggerEvent('unlink', join(sourceDir, 'deleted.md'));

      await vi.waitFor(
        () => {
          // onChange receives stable IDs, not paths
          expect(onChange).toHaveBeenCalledWith(
            expect.arrayContaining([stableId])
          );
        },
        { timeout: 2000 }
      );
    });

    it('handles nested file paths correctly', async () => {
      await writeMarkdownFile('folder/subfolder/deep.md', '# Deep');

      const onChange = vi.fn();
      store.startWatching(onChange);

      triggerEvent('add', join(sourceDir, 'folder/subfolder/deep.md'));

      await vi.waitFor(
        async () => {
          // onChange receives stable IDs, not paths
          expect(onChange).toHaveBeenCalled();
          const passedIds = onChange.mock.calls[0][0] as string[];
          expect(passedIds).toHaveLength(1);
          expect(passedIds[0]).toMatch(/^[A-Za-z0-9_-]{12}$/);
          // Verify we can look up the node by the returned ID
          const node = await store.getNode(passedIds[0]);
          expect(node).not.toBeNull();
          expect(node!.title).toBe('Deep');
        },
        { timeout: 2000 }
      );
    });
  });

  describe('error handling during batch processing', () => {
    it('logs warning and skips file on parse failure', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await writeMarkdownFile('valid.md', '# Valid');

      const onChange = vi.fn();
      store.startWatching(onChange);

      // This will fail because the file doesn't exist on disk
      triggerEvent('add', join(sourceDir, 'nonexistent.md'));
      // Also add a valid file so we can verify batch continues
      triggerEvent('add', join(sourceDir, 'valid.md'));

      await vi.waitFor(
        async () => {
          // Warning should have been logged with useful info
          expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('nonexistent.md'),
            expect.anything()
          );
          // Batch should continue with valid file - callback receives stable IDs
          expect(onChange).toHaveBeenCalled();
          const passedIds = onChange.mock.calls[0][0] as string[];
          // Valid file should have been processed (has a stable ID)
          expect(passedIds).toHaveLength(1);
          expect(passedIds[0]).toMatch(/^[A-Za-z0-9_-]{12}$/);
          // Verify the node was created correctly
          const node = await store.getNode(passedIds[0]);
          expect(node).not.toBeNull();
          expect(node!.title).toBe('Valid');
        },
        { timeout: 2000 }
      );

      consoleSpy.mockRestore();
    });

    it('continues processing batch after individual file error', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await writeMarkdownFile('a.md', '# A');
      await writeMarkdownFile('c.md', '# C');
      await store.sync();

      const onChange = vi.fn();
      store.startWatching(onChange);

      // Queue changes - b.md doesn't exist
      triggerEvent('change', join(sourceDir, 'a.md'));
      triggerEvent('change', join(sourceDir, 'b-missing.md'));
      triggerEvent('change', join(sourceDir, 'c.md'));

      await vi.waitFor(
        () => {
          // Should still call with successful files
          expect(onChange).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );

      consoleSpy.mockRestore();
    });
  });

  describe('cache and graph updates', () => {
    it('upserts node on add event with complete node data', async () => {
      await writeMarkdownFile('new.md', '---\ntitle: New\ntags:\n  - test\n---\nContent body here');

      store.startWatching();
      triggerEvent('add', join(sourceDir, 'new.md'));

      await vi.waitFor(
        async () => {
          const node = await store.getNode('new.md');
          expect(node).not.toBeNull();
        },
        { timeout: 2000 }
      );

      const node = await store.getNode('new.md');
      // Verify complete node structure, not just title
      // ID is now a stable nanoid, not the file path
      expect(node?.id).toMatch(/^[A-Za-z0-9_-]{12}$/);
      expect(node?.title).toBe('New');
      expect(node?.content).toBe('Content body here');
      expect(node?.tags).toContain('test');
    });

    it('upserts node on change event with updated content', async () => {
      await writeMarkdownFile('existing.md', '---\ntitle: Original\ntags:\n  - old\n---\nOriginal content');
      await store.sync();

      // Verify original state
      const originalNode = await store.getNode('existing.md');
      expect(originalNode?.title).toBe('Original');
      expect(originalNode?.content).toBe('Original content');
      expect(originalNode?.tags).toContain('old');

      // Modify the file
      await writeMarkdownFile('existing.md', '---\ntitle: Updated\ntags:\n  - new\n---\nNew content here');

      store.startWatching();
      triggerEvent('change', join(sourceDir, 'existing.md'));

      await vi.waitFor(
        async () => {
          const node = await store.getNode('existing.md');
          // Verify complete update, not just title
          expect(node?.title).toBe('Updated');
          expect(node?.content).toBe('New content here');
          expect(node?.tags).toContain('new');
          expect(node?.tags).not.toContain('old');
        },
        { timeout: 2000 }
      );
    });

    it('deletes node on unlink event', async () => {
      await writeMarkdownFile('doomed.md', '# Doomed');
      await store.sync();

      expect(await store.getNode('doomed.md')).not.toBeNull();

      store.startWatching();
      triggerEvent('unlink', join(sourceDir, 'doomed.md'));

      await vi.waitFor(
        async () => {
          expect(await store.getNode('doomed.md')).toBeNull();
        },
        { timeout: 2000 }
      );
    });

    it('rebuilds graph after processing queue', async () => {
      await writeMarkdownFile('a.md', '---\ntitle: A\n---\nLinks to [[b]]');
      await store.sync();
      await writeMarkdownFile('b.md', '---\ntitle: B\n---\nContent');

      // Get the stable ID of node A before the watcher event
      const nodeA = await store.getNode('a.md');
      expect(nodeA).not.toBeNull();
      const aId = nodeA!.id;

      store.startWatching();
      triggerEvent('add', join(sourceDir, 'b.md'));

      await vi.waitFor(
        async () => {
          // Get stable ID for b
          const nodeB = await store.getNode('b.md');
          expect(nodeB).not.toBeNull();
          const bId = nodeB!.id;

          // Graph should be rebuilt - verify bidirectional edge relationships
          // 1. b should be reachable from a (outgoing from source)
          const outgoing = await store.getNeighbors('a.md', { direction: 'out' });
          expect(outgoing.map((n) => n.id)).toContain(bId);

          // 2. a should be in b's incoming neighbors (incoming to target)
          const incoming = await store.getNeighbors('b.md', { direction: 'in' });
          expect(incoming.map((n) => n.id)).toContain(aId);
        },
        { timeout: 2000 }
      );
    });

    it('resolves wiki-links for files added via watcher', async () => {
      // Setup: nested target exists
      await writeMarkdownFile('folder/target.md', '---\ntitle: Target\n---\nContent');
      await store.sync();

      // Get the stable ID of target before watcher event
      const targetNode = await store.getNode('folder/target.md');
      expect(targetNode).not.toBeNull();
      const targetId = targetNode!.id;

      store.startWatching();

      // Add source file with bare wiki-link
      await writeMarkdownFile('source.md', 'Link to [[target]]');
      triggerEvent('add', join(sourceDir, 'source.md'));

      await vi.waitFor(
        async () => {
          const node = await store.getNode('source.md');
          // outgoingLinks now contain stable IDs, not paths
          expect(node?.outgoingLinks).toContain(targetId);
        },
        { timeout: 2000 }
      );
    });

    it('deletes orphaned ghost when watcher processes file update removing link', async () => {
      // Setup: create file with unresolved link (creates ghost)
      await writeMarkdownFile('linker.md', '---\ntitle: Linker\n---\n[[Missing Page]]');
      await store.sync();

      // Verify ghost was created
      const linker = await store.getNode('linker.md');
      expect(linker).not.toBeNull();
      const ghostId = linker!.outgoingLinks[0]!;
      expect(ghostId.startsWith('ghost_')).toBe(true);

      let ghost = await store.getNode(ghostId);
      expect(ghost).not.toBeNull();
      expect(ghost?.title).toBe('Missing Page');

      store.startWatching();

      // Update file to remove the link
      await writeMarkdownFile('linker.md', '---\ntitle: Linker\n---\nNo more links');
      triggerEvent('change', join(sourceDir, 'linker.md'));

      await vi.waitFor(
        async () => {
          // Link should be removed from linker
          const updatedLinker = await store.getNode('linker.md');
          expect(updatedLinker?.outgoingLinks).toHaveLength(0);

          // Ghost should be deleted (orphaned)
          ghost = await store.getNode(ghostId);
          expect(ghost).toBeNull();
        },
        { timeout: 2000 }
      );
    });

    it('deletes embedding from vector store on unlink (after TTL)', async () => {
      // Track whether embedding exists via stateful mock (keyed by stable ID)
      const embeddingState = new Map<string, boolean>();

      const mockVector = {
        store: vi.fn().mockImplementation(async (id: string) => {
          embeddingState.set(id, true);
        }),
        search: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockImplementation(async (id: string) => {
          embeddingState.delete(id);
        }),
        getModel: vi.fn().mockResolvedValue(null),
        hasEmbedding: vi.fn().mockImplementation((id: string) => {
          return embeddingState.has(id);
        }),
      };

      const customCacheDir = join(tempDir, 'vector-test-cache');
      const customStore = new DocStore({ sourceRoot: sourceDir, cacheDir: customCacheDir, vectorIndex: mockVector });

      await writeMarkdownFile('with-embedding.md', '# Has embedding');
      await customStore.sync();

      // Get the stable ID of the synced node
      const node = await customStore.getNode('with-embedding.md');
      expect(node).not.toBeNull();
      const stableId = node!.id;

      // Simulate that an embedding was stored for this node (by stable ID)
      embeddingState.set(stableId, true);
      expect(mockVector.hasEmbedding(stableId)).toBe(true);

      // Override TTL for faster test
      // @ts-expect-error accessing private for testing
      customStore.UNLINK_TTL_MS = 100;

      customStore.startWatching();
      triggerEvent('unlink', join(sourceDir, 'with-embedding.md'));

      // Wait for unlink to be processed - node removed from cache immediately
      await vi.waitFor(
        async () => {
          expect(await customStore.getNode('with-embedding.md')).toBeNull();
        },
        { timeout: 2000 }
      );

      // Vector delete is deferred until TTL expires (rename detection)
      // Wait for TTL to expire
      await new Promise((r) => setTimeout(r, 150));

      // Trigger another event to force cleanup of expired pending unlinks
      await writeMarkdownFile('trigger.md', '# Trigger');
      triggerEvent('add', join(sourceDir, 'trigger.md'));

      await vi.waitFor(
        async () => {
          // Vector delete is called after TTL expires
          expect(mockVector.delete).toHaveBeenCalledWith(stableId);
          // Verify embedding is actually gone
          expect(mockVector.hasEmbedding(stableId)).toBe(false);
        },
        { timeout: 2000 }
      );

      customStore.close();
    });

    it('integration: unlink removes embedding from real SqliteVectorIndex (after TTL)', async () => {
      const integrationCacheDir = join(tempDir, 'integration-vector-cache');
      await mkdir(integrationCacheDir, { recursive: true });

      // Use real SqliteVectorIndex instead of mock
      const { SqliteVectorIndex } = await import(
        '../../../src/providers/vector/sqlite.js'
      );
      const realVectorProvider = new SqliteVectorIndex(integrationCacheDir);
      const integrationStore = new DocStore({
        sourceRoot: sourceDir,
        cacheDir: integrationCacheDir,
        vectorIndex: realVectorProvider,
      });

      // Create file and sync
      await writeMarkdownFile('embedded-doc.md', '# Document with embedding');
      await integrationStore.sync();

      // Get the stable ID of the synced node
      const node = await integrationStore.getNode('embedded-doc.md');
      expect(node).not.toBeNull();
      const stableId = node!.id;

      // Store a real embedding using stable ID (simulating what embedding provider would do)
      const testVector = [0.1, 0.2, 0.3, 0.4, 0.5];
      await realVectorProvider.store(stableId, testVector, 'test-model');

      // Verify embedding exists (by stable ID)
      expect(realVectorProvider.hasEmbedding(stableId)).toBe(true);
      expect(realVectorProvider.getEmbeddingCount()).toBe(1);

      // Override TTL for faster test
      // @ts-expect-error accessing private for testing
      integrationStore.UNLINK_TTL_MS = 100;

      // Start watching and trigger unlink
      integrationStore.startWatching();
      triggerEvent('unlink', join(sourceDir, 'embedded-doc.md'));

      // Wait for unlink to be processed - cache immediately updated
      await vi.waitFor(
        async () => {
          expect(await integrationStore.getNode('embedded-doc.md')).toBeNull();
        },
        { timeout: 2000 }
      );

      // Vector delete is deferred - embedding still exists
      expect(realVectorProvider.hasEmbedding(stableId)).toBe(true);

      // Wait for TTL to expire
      await new Promise((r) => setTimeout(r, 150));

      // Trigger another event to force cleanup
      await writeMarkdownFile('trigger-cleanup.md', '# Trigger');
      triggerEvent('add', join(sourceDir, 'trigger-cleanup.md'));

      // Wait for vector cleanup
      await vi.waitFor(
        async () => {
          // Verify embedding is now removed from SQLite
          expect(realVectorProvider.hasEmbedding(stableId)).toBe(false);
          expect(realVectorProvider.getEmbeddingCount()).toBe(0);
        },
        { timeout: 2000 }
      );

      integrationStore.close();
      realVectorProvider.close();
    });
  });

  describe('FileWatcher pause/resume', () => {
    it('pause() stops queueing events', async () => {
      await writeMarkdownFile('paused.md', '# Paused');

      const onChange = vi.fn();
      store.startWatching(onChange);

      // Get the FileWatcher instance and pause it
      // @ts-expect-error accessing private fileWatcher for testing
      const watcher = store.fileWatcher;
      watcher.pause();

      // Trigger an event - should be ignored
      triggerEvent('add', join(sourceDir, 'paused.md'));

      // Wait a bit
      await new Promise((r) => setTimeout(r, 200));

      // onChange should NOT have been called
      expect(onChange).not.toHaveBeenCalled();
    });

    it('resume() resumes queueing events', async () => {
      await writeMarkdownFile('resumed.md', '# Resumed');

      const onChange = vi.fn();
      store.startWatching(onChange);

      // @ts-expect-error accessing private fileWatcher for testing
      const watcher = store.fileWatcher;

      // Pause, then resume
      watcher.pause();
      watcher.resume();

      // Trigger event after resume
      triggerEvent('add', join(sourceDir, 'resumed.md'));

      await vi.waitFor(
        async () => {
          // onChange receives stable IDs, not paths
          expect(onChange).toHaveBeenCalled();
          const passedIds = onChange.mock.calls[0][0] as string[];
          expect(passedIds).toHaveLength(1);
          // Verify the ID is a valid stable ID
          expect(passedIds[0]).toMatch(/^[A-Za-z0-9_-]{12}$/);
          // Verify the node was created
          const node = await store.getNode(passedIds[0]);
          expect(node).not.toBeNull();
          expect(node!.title).toBe('Resumed');
        },
        { timeout: 2000 }
      );
    });

    it('events during pause are dropped, not queued', async () => {
      await writeMarkdownFile('dropped.md', '# Dropped');

      const onChange = vi.fn();
      store.startWatching(onChange);

      // @ts-expect-error accessing private fileWatcher for testing
      const watcher = store.fileWatcher;

      // Pause
      watcher.pause();

      // Trigger event during pause
      triggerEvent('add', join(sourceDir, 'dropped.md'));

      // Resume
      watcher.resume();

      // Wait for any potential flush
      await new Promise((r) => setTimeout(r, 200));

      // onChange should NOT have been called - event was dropped, not queued
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('DocStore lifecycle integration', () => {
    it('stopWatching is called when close() is invoked', () => {
      store.startWatching();
      expect(store.isWatching()).toBe(true);

      store.close();

      expect(store.isWatching()).toBe(false);
      expect(getMockWatcher().close).toHaveBeenCalled();
    });

    it('close() is safe when not watching', () => {
      expect(() => store.close()).not.toThrow();
    });

    it('isWatching delegates to FileWatcher', () => {
      expect(store.isWatching()).toBe(false);

      store.startWatching();
      expect(store.isWatching()).toBe(true);

      store.stopWatching();
      expect(store.isWatching()).toBe(false);
    });

    it('stopWatching is safe to call when not watching', () => {
      expect(() => store.stopWatching()).not.toThrow();
    });

    it('throws if startWatching called while already watching', () => {
      store.startWatching();
      expect(() => store.startWatching()).toThrow(/already watching/i);
    });
  });

  describe('vectorProvider.delete() failure handling', () => {
    it('logs warning and continues when vectorProvider.delete throws on unlink (after TTL)', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const failingVector = {
        store: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockRejectedValue(new Error('Vector delete failed')),
        getModel: vi.fn().mockResolvedValue(null),
        hasEmbedding: vi.fn().mockReturnValue(true),
      };

      const customCacheDir = join(tempDir, 'vector-fail-test');
      const customStore = new DocStore({ sourceRoot: sourceDir, cacheDir: customCacheDir, vectorIndex: failingVector });

      // Create and sync a file
      await writeMarkdownFile('to-delete.md', '# To Delete');
      await customStore.sync();

      // Verify node exists
      expect(await customStore.getNode('to-delete.md')).not.toBeNull();

      // Override TTL for faster test
      // @ts-expect-error accessing private for testing
      customStore.UNLINK_TTL_MS = 100;

      const onChange = vi.fn();
      customStore.startWatching(onChange);

      // Trigger unlink - vectorProvider.delete is deferred
      triggerEvent('unlink', join(sourceDir, 'to-delete.md'));

      // Wait for cache to be updated
      await vi.waitFor(
        async () => {
          expect(await customStore.getNode('to-delete.md')).toBeNull();
        },
        { timeout: 2000 }
      );

      // Wait for TTL to expire
      await new Promise((r) => setTimeout(r, 150));

      // Trigger another event to force cleanup (which will fail)
      await writeMarkdownFile('trigger-fail.md', '# Trigger');
      triggerEvent('add', join(sourceDir, 'trigger-fail.md'));

      await vi.waitFor(
        () => {
          // Warning should have been logged when vector delete failed
          expect(consoleSpy).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );

      // The key test is that it doesn't crash and processing continues
      consoleSpy.mockRestore();
      customStore.close();
    });

    it('still removes node from cache even when vectorProvider.delete fails', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const failingVector = {
        store: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockRejectedValue(new Error('Storage unavailable')),
        getModel: vi.fn().mockResolvedValue(null),
        hasEmbedding: vi.fn().mockReturnValue(true),
      };

      const customCacheDir = join(tempDir, 'cache-still-deletes');
      const customStore = new DocStore({ sourceRoot: sourceDir, cacheDir: customCacheDir, vectorIndex: failingVector });

      await writeMarkdownFile('will-be-orphaned.md', '# Orphan');
      await customStore.sync();

      customStore.startWatching();
      triggerEvent('unlink', join(sourceDir, 'will-be-orphaned.md'));

      await vi.waitFor(
        async () => {
          // Node should be deleted from cache even though vector delete failed
          expect(await customStore.getNode('will-be-orphaned.md')).toBeNull();
        },
        { timeout: 2000 }
      );

      consoleSpy.mockRestore();
      customStore.close();
    });

    it('continues processing other files after vectorProvider.delete failure', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const failOnceVector = {
        store: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        delete: vi.fn()
          .mockRejectedValueOnce(new Error('First delete failed'))
          .mockResolvedValue(undefined),
        getModel: vi.fn().mockResolvedValue(null),
        hasEmbedding: vi.fn().mockReturnValue(true),
      };

      const customCacheDir = join(tempDir, 'batch-continues');
      const customStore = new DocStore({ sourceRoot: sourceDir, cacheDir: customCacheDir, vectorIndex: failOnceVector });

      await writeMarkdownFile('fail.md', '# Fail');
      await writeMarkdownFile('succeed.md', '# Succeed');
      await customStore.sync();

      const onChange = vi.fn();
      customStore.startWatching(onChange);

      // Trigger both unlinks - first will fail vector delete, second succeeds
      triggerEvent('unlink', join(sourceDir, 'fail.md'));
      triggerEvent('unlink', join(sourceDir, 'succeed.md'));

      await vi.waitFor(
        async () => {
          // Both nodes should be removed from cache
          expect(await customStore.getNode('fail.md')).toBeNull();
          expect(await customStore.getNode('succeed.md')).toBeNull();
        },
        { timeout: 2000 }
      );

      consoleSpy.mockRestore();
      customStore.close();
    });
  });

  describe('event coalescing cache state', () => {
    it('add + change = add → node exists in cache with correct content', async () => {
      // Write file with initial content
      await writeMarkdownFile('coalesce-add-change.md', '---\ntitle: Initial\n---\nInitial content');

      store.startWatching();

      // Simulate rapid add + change (both events before flush)
      triggerEvent('add', join(sourceDir, 'coalesce-add-change.md'));
      // Update file content before debounce fires
      await writeMarkdownFile('coalesce-add-change.md', '---\ntitle: Updated\n---\nUpdated content');
      triggerEvent('change', join(sourceDir, 'coalesce-add-change.md'));

      await vi.waitFor(
        async () => {
          const node = await store.getNode('coalesce-add-change.md');
          expect(node).not.toBeNull();
        },
        { timeout: 2000 }
      );

      // Cache should have the node with updated content (add event reads latest file)
      const node = await store.getNode('coalesce-add-change.md');
      expect(node?.title).toBe('Updated');
      expect(node?.content).toBe('Updated content');
    });

    it('change + change = change → node has latest content in cache', async () => {
      // Initial file - sync will generate a stable ID
      await writeMarkdownFile('coalesce-change-change.md', '---\ntitle: V1\n---\nVersion 1');
      await store.sync();

      const originalNode = await store.getNode('coalesce-change-change.md');
      expect(originalNode?.title).toBe('V1');

      store.startWatching();

      // First change - simulating external edit that doesn't preserve ID
      // The system should handle this gracefully by cleaning up old node
      await writeMarkdownFile('coalesce-change-change.md', '---\ntitle: V2\n---\nVersion 2');
      triggerEvent('change', join(sourceDir, 'coalesce-change-change.md'));

      // Second change (before debounce)
      await writeMarkdownFile('coalesce-change-change.md', '---\ntitle: V3\n---\nVersion 3 final');
      triggerEvent('change', join(sourceDir, 'coalesce-change-change.md'));

      await vi.waitFor(
        async () => {
          const node = await store.getNode('coalesce-change-change.md');
          expect(node?.title).toBe('V3');
        },
        { timeout: 2000 }
      );

      // Cache should have the latest content
      const node = await store.getNode('coalesce-change-change.md');
      expect(node?.content).toBe('Version 3 final');
    });

    it('add + unlink = nothing → node does NOT exist in cache', async () => {
      // Ensure node doesn't exist initially
      expect(await store.getNode('coalesce-add-unlink.md')).toBeNull();

      // Write and immediately delete (transient file)
      await writeMarkdownFile('coalesce-add-unlink.md', '---\ntitle: Transient\n---\nContent');

      const onChange = vi.fn();
      store.startWatching(onChange);

      // add + unlink cancels out
      triggerEvent('add', join(sourceDir, 'coalesce-add-unlink.md'));
      triggerEvent('unlink', join(sourceDir, 'coalesce-add-unlink.md'));

      // Wait a bit for any processing
      await new Promise((r) => setTimeout(r, 100));

      // Node should NOT exist in cache - the events cancelled out
      expect(await store.getNode('coalesce-add-unlink.md')).toBeNull();

      // onChange should not have been called with this node
      // (empty batch means no callback)
      if (onChange.mock.calls.length > 0) {
        const calledIds = onChange.mock.calls.flat(2) as string[];
        expect(calledIds).not.toContain('coalesce-add-unlink.md');
      }
    });
  });

  describe('rename detection via stable ID', () => {
    it('detects rename when unlink+add have same stable ID in same batch', async () => {
      // Create file with stable ID
      await writeMarkdownFile('old-name.md', '---\nid: abc123def456\ntitle: Renamed\n---\nContent');
      await store.sync();

      // Verify node exists with the stable ID
      const originalNode = await store.getNode('abc123def456');
      expect(originalNode).not.toBeNull();
      expect(originalNode!.title).toBe('Renamed');
      expect(originalNode!.sourceRef?.path).toBe(join(sourceDir, 'old-name.md'));

      // Simulate rename: move file to new location with same content/ID
      await writeMarkdownFile('new-name.md', '---\nid: abc123def456\ntitle: Renamed\n---\nContent');
      // Old file would be removed by OS

      const onChange = vi.fn();
      store.startWatching(onChange);

      // Trigger unlink for old path, add for new path (same batch)
      triggerEvent('unlink', join(sourceDir, 'old-name.md'));
      triggerEvent('add', join(sourceDir, 'new-name.md'));

      await vi.waitFor(
        async () => {
          // Node should still exist with SAME stable ID
          const node = await store.getNode('abc123def456');
          expect(node).not.toBeNull();
          expect(node!.id).toBe('abc123def456');
          expect(node!.title).toBe('Renamed');
          // Path should be updated to new location
          expect(node!.sourceRef?.path).toBe(join(sourceDir, 'new-name.md'));
        },
        { timeout: 2000 }
      );
    });

    it('detects rename when unlink+add occur in separate batches within TTL', async () => {
      // Create file with stable ID
      await writeMarkdownFile('before-rename.md', '---\nid: rename123456\ntitle: Moving\n---\nBody');
      await store.sync();

      const originalNode = await store.getNode('rename123456');
      expect(originalNode).not.toBeNull();

      const onChange = vi.fn();
      store.startWatching(onChange);

      // Trigger unlink first
      triggerEvent('unlink', join(sourceDir, 'before-rename.md'));

      // Wait for first batch to process
      await vi.waitFor(
        () => {
          expect(onChange).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );
      onChange.mockClear();

      // Simulate file appearing at new location (still within 5s TTL)
      await writeMarkdownFile('after-rename.md', '---\nid: rename123456\ntitle: Moving\n---\nBody');
      triggerEvent('add', join(sourceDir, 'after-rename.md'));

      await vi.waitFor(
        async () => {
          // Node should exist at new path with same ID
          const node = await store.getNode('rename123456');
          expect(node).not.toBeNull();
          expect(node!.sourceRef?.path).toBe(join(sourceDir, 'after-rename.md'));
        },
        { timeout: 2000 }
      );
    });

    it('deletes node if unlink has no matching add within TTL', async () => {
      // Create file with stable ID (must be exactly 12 chars, URL-safe)
      await writeMarkdownFile('permanent-delete.md', '---\nid: delete_no_re\ntitle: Gone\n---\nDeleted');
      await store.sync();

      expect(await store.getNode('delete_no_re')).not.toBeNull();

      store.startWatching();

      // Trigger unlink only (no matching add)
      triggerEvent('unlink', join(sourceDir, 'permanent-delete.md'));

      // Wait for batch processing - without a matching add, node should be deleted
      // Note: With rename detection, node deletion may be deferred waiting for matching add
      // After TTL expires (or immediately if no rename detection), node should be gone
      await vi.waitFor(
        async () => {
          // Node should eventually be deleted since no matching add came
          expect(await store.getNode('delete_no_re')).toBeNull();
        },
        { timeout: 10000 } // Allow time for TTL to expire
      );
    });

    it('creates new node if add has no pending unlink with matching ID', async () => {
      // Ensure no pending state
      const onChange = vi.fn();
      store.startWatching(onChange);

      // Add a brand new file (not a rename)
      await writeMarkdownFile('brand-new.md', '---\nid: brandnew1234\ntitle: Fresh\n---\nNew content');
      triggerEvent('add', join(sourceDir, 'brand-new.md'));

      await vi.waitFor(
        async () => {
          const node = await store.getNode('brandnew1234');
          expect(node).not.toBeNull();
          expect(node!.id).toBe('brandnew1234');
          expect(node!.title).toBe('Fresh');
        },
        { timeout: 2000 }
      );
    });

    it('preserves node data and graph edges on rename', async () => {
      // Create source and target files (IDs must be exactly 12 chars)
      await writeMarkdownFile('link-source.md', '---\nid: linksrc_1234\ntitle: Source\n---\nLinks to [[Target]]');
      await writeMarkdownFile('target.md', '---\nid: lnktarget456\ntitle: Target\n---\nTarget content');
      await store.sync();

      // Verify link exists - link resolution maps [[Target]] title to stable ID
      const sourceNode = await store.getNode('linksrc_1234');
      expect(sourceNode).not.toBeNull();
      const targetNode = await store.getNode('lnktarget456');
      expect(targetNode).not.toBeNull();
      expect(sourceNode!.outgoingLinks).toContain(targetNode!.id);

      // Rename source file
      await writeMarkdownFile('renamed-source.md', '---\nid: linksrc_1234\ntitle: Source\n---\nLinks to [[Target]]');

      store.startWatching();
      triggerEvent('unlink', join(sourceDir, 'link-source.md'));
      triggerEvent('add', join(sourceDir, 'renamed-source.md'));

      await vi.waitFor(
        async () => {
          const node = await store.getNode('linksrc_1234');
          expect(node).not.toBeNull();
          // Node data preserved
          expect(node!.title).toBe('Source');
          // Graph edges preserved - should still link to target's stable ID
          expect(node!.outgoingLinks).toContain('lnktarget456');
          // Path updated
          expect(node!.sourceRef?.path).toBe(join(sourceDir, 'renamed-source.md'));
        },
        { timeout: 2000 }
      );
    });

    it('handles rename to different directory', async () => {
      await writeMarkdownFile('root-file.md', '---\nid: movingdeep12\ntitle: Moving Deep\n---\nGoing to subfolder');
      await store.sync();

      expect(await store.getNode('movingdeep12')).not.toBeNull();

      // Move to nested directory
      await writeMarkdownFile('folder/subfolder/moved-file.md', '---\nid: movingdeep12\ntitle: Moving Deep\n---\nGoing to subfolder');

      store.startWatching();
      triggerEvent('unlink', join(sourceDir, 'root-file.md'));
      triggerEvent('add', join(sourceDir, 'folder/subfolder/moved-file.md'));

      await vi.waitFor(
        async () => {
          const node = await store.getNode('movingdeep12');
          expect(node).not.toBeNull();
          expect(node!.sourceRef?.path).toBe(join(sourceDir, 'folder/subfolder/moved-file.md'));
        },
        { timeout: 2000 }
      );
    });

    it('cleans up expired pending unlinks on subsequent events', async () => {
      // Create files (IDs must be exactly 12 chars)
      await writeMarkdownFile('will-expire.md', '---\nid: expiring_123\ntitle: Expiring\n---\nContent');
      await writeMarkdownFile('other-file.md', '---\nid: otherfile_12\ntitle: Other\n---\nContent');
      await store.sync();

      expect(await store.getNode('expiring_123')).not.toBeNull();
      expect(await store.getNode('otherfile_12')).not.toBeNull();

      store.startWatching();

      // Unlink first file
      triggerEvent('unlink', join(sourceDir, 'will-expire.md'));

      // Trigger another event (change on other file) - this should still work
      await writeMarkdownFile('other-file.md', '---\nid: otherfile_12\ntitle: Other Modified\n---\nUpdated');
      triggerEvent('change', join(sourceDir, 'other-file.md'));

      await vi.waitFor(
        async () => {
          // First file should be deleted (no matching add)
          expect(await store.getNode('expiring_123')).toBeNull();
          // Other file should be updated
          const other = await store.getNode('otherfile_12');
          expect(other).not.toBeNull();
          expect(other!.title).toBe('Other Modified');
        },
        { timeout: 10000 }
      );
    });

    it('does NOT delete from vector index during rename (same batch)', async () => {
      // This test verifies that rename detection avoids unnecessary vector operations
      const vectorDeleteCalls: string[] = [];
      const mockVector = {
        store: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockImplementation(async (id: string) => {
          vectorDeleteCalls.push(id);
        }),
        getModel: vi.fn().mockResolvedValue(null),
        hasEmbedding: vi.fn().mockReturnValue(true),
      };

      const customCacheDir = join(tempDir, 'vector-rename-test');
      const customStore = new DocStore({ sourceRoot: sourceDir, cacheDir: customCacheDir, vectorIndex: mockVector });

      // Create file with stable ID (must be exactly 12 chars)
      await writeMarkdownFile('original.md', '---\nid: vecrename_12\ntitle: Vector Test\n---\nContent');
      await customStore.sync();

      expect(await customStore.getNode('vecrename_12')).not.toBeNull();

      customStore.startWatching();

      // Simulate rename: write new file, trigger unlink+add
      await writeMarkdownFile('renamed.md', '---\nid: vecrename_12\ntitle: Vector Test\n---\nContent');
      triggerEvent('unlink', join(sourceDir, 'original.md'));
      triggerEvent('add', join(sourceDir, 'renamed.md'));

      await vi.waitFor(
        async () => {
          const node = await customStore.getNode('vecrename_12');
          expect(node).not.toBeNull();
          expect(node!.sourceRef?.path).toBe(join(sourceDir, 'renamed.md'));
        },
        { timeout: 2000 }
      );

      // Vector delete should NOT have been called - it was a rename, not a delete
      expect(vectorDeleteCalls).not.toContain('vecrename_12');

      customStore.close();
    });

    it('does NOT delete from vector index during rename (across batches within TTL)', async () => {
      const vectorDeleteCalls: string[] = [];
      const mockVector = {
        store: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockImplementation(async (id: string) => {
          vectorDeleteCalls.push(id);
        }),
        getModel: vi.fn().mockResolvedValue(null),
        hasEmbedding: vi.fn().mockReturnValue(true),
      };

      const customCacheDir = join(tempDir, 'vector-rename-ttl-test');
      const customStore = new DocStore({ sourceRoot: sourceDir, cacheDir: customCacheDir, vectorIndex: mockVector });

      await writeMarkdownFile('orig-file.md', '---\nid: vecttl_12345\ntitle: TTL Test\n---\nBody');
      await customStore.sync();

      const onChange = vi.fn();
      customStore.startWatching(onChange);

      // First batch: unlink only
      triggerEvent('unlink', join(sourceDir, 'orig-file.md'));

      await vi.waitFor(
        () => {
          expect(onChange).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );

      // Vector delete should NOT have been called yet - pending unlink waiting for matching add
      expect(vectorDeleteCalls).not.toContain('vecttl_12345');

      // Second batch: add with same ID (within TTL)
      await writeMarkdownFile('new-file.md', '---\nid: vecttl_12345\ntitle: TTL Test\n---\nBody');
      triggerEvent('add', join(sourceDir, 'new-file.md'));

      await vi.waitFor(
        async () => {
          const node = await customStore.getNode('vecttl_12345');
          expect(node).not.toBeNull();
          expect(node!.sourceRef?.path).toBe(join(sourceDir, 'new-file.md'));
        },
        { timeout: 2000 }
      );

      // Vector delete should still NOT have been called - rename was detected
      expect(vectorDeleteCalls).not.toContain('vecttl_12345');

      customStore.close();
    });
  });

  describe('path collision cleanup', () => {
    it('cleans up old node when add event has different ID at existing path', async () => {
      // Create and sync a file with ID "oldid_123456"
      await writeMarkdownFile('collision.md', '---\nid: oldid_123456\ntitle: Old\n---\nOld content');
      await store.sync();

      const oldNode = await store.getNode('oldid_123456');
      expect(oldNode).not.toBeNull();
      expect(oldNode!.sourceRef?.path).toBe(join(sourceDir, 'collision.md'));

      // Now externally the file is replaced with a new file at same path but different ID
      // (simulating a user replacing the file entirely)
      await writeMarkdownFile('collision.md', '---\nid: newid_789012\ntitle: New\n---\nNew content');

      store.startWatching();

      // Trigger add event (not change, because it's treated as a new file appearance)
      triggerEvent('add', join(sourceDir, 'collision.md'));

      await vi.waitFor(
        async () => {
          // New node should exist
          const newNode = await store.getNode('newid_789012');
          expect(newNode).not.toBeNull();
          expect(newNode!.title).toBe('New');
        },
        { timeout: 2000 }
      );

      // Old node should be deleted (path collision cleanup)
      const oldNodeAfter = await store.getNode('oldid_123456');
      expect(oldNodeAfter).toBeNull();
    });

    it('cleans up old node when change event has different ID at existing path', async () => {
      // Create and sync a file with ID "changold_456"
      await writeMarkdownFile('change-collision.md', '---\nid: changold_456\ntitle: Old\n---\nOld');
      await store.sync();

      expect(await store.getNode('changold_456')).not.toBeNull();

      store.startWatching();

      // Externally replace file with different ID (simulating user edit that replaces ID)
      await writeMarkdownFile('change-collision.md', '---\nid: changnew_789\ntitle: New\n---\nNew');

      // Trigger change event
      triggerEvent('change', join(sourceDir, 'change-collision.md'));

      await vi.waitFor(
        async () => {
          const newNode = await store.getNode('changnew_789');
          expect(newNode).not.toBeNull();
          expect(newNode!.title).toBe('New');
        },
        { timeout: 2000 }
      );

      // Old node should be deleted
      expect(await store.getNode('changold_456')).toBeNull();
    });

    it('deletes from vector index when path collision cleanup occurs on add', async () => {
      const vectorDeleteCalls: string[] = [];
      const mockVector = {
        store: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockImplementation(async (id: string) => {
          vectorDeleteCalls.push(id);
        }),
        getModel: vi.fn().mockResolvedValue(null),
        hasEmbedding: vi.fn().mockReturnValue(true),
      };

      const customCacheDir = join(tempDir, 'vector-collision-add');
      const customStore = new DocStore({ sourceRoot: sourceDir, cacheDir: customCacheDir, vectorIndex: mockVector });

      await writeMarkdownFile('vec-collision.md', '---\nid: vecold_12345\ntitle: Old\n---\nOld');
      await customStore.sync();

      customStore.startWatching();

      // Replace file with new ID
      await writeMarkdownFile('vec-collision.md', '---\nid: vecnew_67890\ntitle: New\n---\nNew');
      triggerEvent('add', join(sourceDir, 'vec-collision.md'));

      await vi.waitFor(
        async () => {
          expect(await customStore.getNode('vecnew_67890')).not.toBeNull();
        },
        { timeout: 2000 }
      );

      // Old ID should have been deleted from vector index
      expect(vectorDeleteCalls).toContain('vecold_12345');

      customStore.close();
    });

    it('deletes from vector index when path collision cleanup occurs on change', async () => {
      const vectorDeleteCalls: string[] = [];
      const mockVector = {
        store: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockImplementation(async (id: string) => {
          vectorDeleteCalls.push(id);
        }),
        getModel: vi.fn().mockResolvedValue(null),
        hasEmbedding: vi.fn().mockReturnValue(true),
      };

      const customCacheDir = join(tempDir, 'vector-collision-change');
      const customStore = new DocStore({ sourceRoot: sourceDir, cacheDir: customCacheDir, vectorIndex: mockVector });

      await writeMarkdownFile('vec-change.md', '---\nid: chgold_12345\ntitle: Old\n---\nOld');
      await customStore.sync();

      customStore.startWatching();

      // Replace file with new ID via change event
      await writeMarkdownFile('vec-change.md', '---\nid: chgnew_67890\ntitle: New\n---\nNew');
      triggerEvent('change', join(sourceDir, 'vec-change.md'));

      await vi.waitFor(
        async () => {
          expect(await customStore.getNode('chgnew_67890')).not.toBeNull();
        },
        { timeout: 2000 }
      );

      // Old ID should have been deleted from vector index
      expect(vectorDeleteCalls).toContain('chgold_12345');

      customStore.close();
    });

    it('continues when vector delete fails during path collision cleanup on add', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mockVector = {
        store: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockRejectedValue(new Error('Vector delete failed')),
        getModel: vi.fn().mockResolvedValue(null),
        hasEmbedding: vi.fn().mockReturnValue(true),
      };

      const customCacheDir = join(tempDir, 'vector-fail-add');
      const customStore = new DocStore({ sourceRoot: sourceDir, cacheDir: customCacheDir, vectorIndex: mockVector });

      await writeMarkdownFile('fail-add.md', '---\nid: failold_1234\ntitle: Old\n---\nOld');
      await customStore.sync();

      customStore.startWatching();

      await writeMarkdownFile('fail-add.md', '---\nid: failnew_5678\ntitle: New\n---\nNew');
      triggerEvent('add', join(sourceDir, 'fail-add.md'));

      await vi.waitFor(
        async () => {
          // New node should still be created despite vector delete failure
          const newNode = await customStore.getNode('failnew_5678');
          expect(newNode).not.toBeNull();
          expect(newNode!.title).toBe('New');
        },
        { timeout: 2000 }
      );

      // Old node should still be removed from cache
      expect(await customStore.getNode('failold_1234')).toBeNull();

      consoleSpy.mockRestore();
      customStore.close();
    });

    it('continues when vector delete fails during path collision cleanup on change', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mockVector = {
        store: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockRejectedValue(new Error('Vector delete failed')),
        getModel: vi.fn().mockResolvedValue(null),
        hasEmbedding: vi.fn().mockReturnValue(true),
      };

      const customCacheDir = join(tempDir, 'vector-fail-change');
      const customStore = new DocStore({ sourceRoot: sourceDir, cacheDir: customCacheDir, vectorIndex: mockVector });

      await writeMarkdownFile('fail-change.md', '---\nid: chgfailold12\ntitle: Old\n---\nOld');
      await customStore.sync();

      customStore.startWatching();

      await writeMarkdownFile('fail-change.md', '---\nid: chgfailnew34\ntitle: New\n---\nNew');
      triggerEvent('change', join(sourceDir, 'fail-change.md'));

      await vi.waitFor(
        async () => {
          // New node should still be created despite vector delete failure
          const newNode = await customStore.getNode('chgfailnew34');
          expect(newNode).not.toBeNull();
          expect(newNode!.title).toBe('New');
        },
        { timeout: 2000 }
      );

      // Old node should still be removed from cache
      expect(await customStore.getNode('chgfailold12')).toBeNull();

      consoleSpy.mockRestore();
      customStore.close();
    });
  });

});
