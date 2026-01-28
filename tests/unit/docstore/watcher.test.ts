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
  if (handler) {
    handler(arg);
  }
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

  describe('onChange callback', () => {
    it('called with correct IDs for add event', async () => {
      await writeMarkdownFile('new-note.md', '# New Note');

      const onChange = vi.fn();
      store.startWatching(onChange);

      triggerEvent('add', join(sourceDir, 'new-note.md'));

      await vi.waitFor(
        () => {
          expect(onChange).toHaveBeenCalledWith(
            expect.arrayContaining(['new-note.md'])
          );
        },
        { timeout: 2000 }
      );
    });

    it('called with correct IDs for change event', async () => {
      await writeMarkdownFile('existing.md', '# Existing');
      await store.sync();

      const onChange = vi.fn();
      store.startWatching(onChange);

      triggerEvent('change', join(sourceDir, 'existing.md'));

      await vi.waitFor(
        () => {
          expect(onChange).toHaveBeenCalledWith(
            expect.arrayContaining(['existing.md'])
          );
        },
        { timeout: 2000 }
      );
    });

    it('called with correct IDs for unlink event', async () => {
      await writeMarkdownFile('deleted.md', '# Deleted');
      await store.sync();

      const onChange = vi.fn();
      store.startWatching(onChange);

      triggerEvent('unlink', join(sourceDir, 'deleted.md'));

      await vi.waitFor(
        () => {
          expect(onChange).toHaveBeenCalledWith(
            expect.arrayContaining(['deleted.md'])
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
        () => {
          expect(onChange).toHaveBeenCalledWith(
            expect.arrayContaining(['folder/subfolder/deep.md'])
          );
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
        () => {
          // Warning should have been logged with useful info
          expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('nonexistent.md'),
            expect.anything()
          );
          // Batch should continue with valid file
          expect(onChange).toHaveBeenCalledWith(expect.arrayContaining(['valid.md']));
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
    it('upserts node on add event', async () => {
      await writeMarkdownFile('new.md', '---\ntitle: New\n---\nContent');

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
      expect(node?.title).toBe('New');
    });

    it('upserts node on change event', async () => {
      await writeMarkdownFile('existing.md', '---\ntitle: Original\n---\nContent');
      await store.sync();
      // Modify the file
      await writeMarkdownFile('existing.md', '---\ntitle: Updated\n---\nNew content');

      store.startWatching();
      triggerEvent('change', join(sourceDir, 'existing.md'));

      await vi.waitFor(
        async () => {
          const node = await store.getNode('existing.md');
          expect(node?.title).toBe('Updated');
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

      store.startWatching();
      triggerEvent('add', join(sourceDir, 'b.md'));

      await vi.waitFor(
        async () => {
          // Graph should be rebuilt - verify bidirectional edge relationships
          // 1. b should be reachable from a (outgoing from source)
          const outgoing = await store.getNeighbors('a.md', { direction: 'out' });
          expect(outgoing.map((n) => n.id)).toContain('b.md');

          // 2. a should be in b's incoming neighbors (incoming to target)
          const incoming = await store.getNeighbors('b.md', { direction: 'in' });
          expect(incoming.map((n) => n.id)).toContain('a.md');
        },
        { timeout: 2000 }
      );
    });

    it('resolves wiki-links for files added via watcher', async () => {
      // Setup: nested target exists
      await writeMarkdownFile('folder/target.md', '---\ntitle: Target\n---\nContent');
      await store.sync();

      store.startWatching();

      // Add source file with bare wiki-link
      await writeMarkdownFile('source.md', 'Link to [[target]]');
      triggerEvent('add', join(sourceDir, 'source.md'));

      await vi.waitFor(
        async () => {
          const node = await store.getNode('source.md');
          // Should resolve to full path, not stay as 'target.md'
          expect(node?.outgoingLinks).toContain('folder/target.md');
        },
        { timeout: 2000 }
      );
    });

    it('deletes embedding from vector store on unlink', async () => {
      // Track whether embedding exists via stateful mock
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
      const customStore = new DocStore(sourceDir, customCacheDir, mockVector);

      await writeMarkdownFile('with-embedding.md', '# Has embedding');
      await customStore.sync();

      // Simulate that an embedding was stored for this file
      // (DocStore.sync doesn't store embeddings - that's done by embedding provider)
      embeddingState.set('with-embedding.md', true);
      expect(mockVector.hasEmbedding('with-embedding.md')).toBe(true);

      customStore.startWatching();
      triggerEvent('unlink', join(sourceDir, 'with-embedding.md'));

      await vi.waitFor(
        async () => {
          expect(mockVector.delete).toHaveBeenCalledWith('with-embedding.md');
          // Verify embedding is actually gone, not just that delete was called
          expect(mockVector.hasEmbedding('with-embedding.md')).toBe(false);
          // Verify node is also removed from DocStore cache
          expect(await customStore.getNode('with-embedding.md')).toBeNull();
        },
        { timeout: 2000 }
      );

      customStore.close();
    });

    it('integration: unlink removes embedding from real SqliteVectorIndex', async () => {
      const integrationCacheDir = join(tempDir, 'integration-vector-cache');
      await mkdir(integrationCacheDir, { recursive: true });

      // Use real SqliteVectorIndex instead of mock
      const { SqliteVectorIndex } = await import(
        '../../../src/providers/vector/sqlite.js'
      );
      const realVectorProvider = new SqliteVectorIndex(integrationCacheDir);
      const integrationStore = new DocStore(
        sourceDir,
        integrationCacheDir,
        realVectorProvider
      );

      // Create file and sync
      await writeMarkdownFile('embedded-doc.md', '# Document with embedding');
      await integrationStore.sync();

      // Store a real embedding (simulating what embedding provider would do)
      const testVector = [0.1, 0.2, 0.3, 0.4, 0.5];
      await realVectorProvider.store('embedded-doc.md', testVector, 'test-model');

      // Verify embedding exists
      expect(realVectorProvider.hasEmbedding('embedded-doc.md')).toBe(true);
      expect(realVectorProvider.getEmbeddingCount()).toBe(1);

      // Start watching and trigger unlink
      integrationStore.startWatching();
      triggerEvent('unlink', join(sourceDir, 'embedded-doc.md'));

      // Wait for processing
      await vi.waitFor(
        async () => {
          // Verify node is removed from cache
          expect(await integrationStore.getNode('embedded-doc.md')).toBeNull();
          // Verify embedding is actually removed from SQLite (not just mock assertion)
          expect(realVectorProvider.hasEmbedding('embedded-doc.md')).toBe(false);
          expect(realVectorProvider.getEmbeddingCount()).toBe(0);
        },
        { timeout: 2000 }
      );

      integrationStore.close();
      realVectorProvider.close();
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

});
