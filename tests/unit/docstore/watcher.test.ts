import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DocStore } from '../../../src/providers/docstore/index.js';

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

function triggerEvent(event: string, path?: string) {
  const mockWatcher = getMockWatcher();
  const onCalls = mockWatcher.on.mock.calls;
  const handler = onCalls.find((call: unknown[]) => call[0] === event)?.[1] as
    | ((path?: string) => void)
    | undefined;
  if (handler) {
    handler(path);
  }
}

// Trigger 'ready' event to resolve startWatching promise
function triggerReady() {
  triggerEvent('ready');
}

// Helper to start watching and wait for ready in one step
async function startWatchingAndReady(
  store: DocStore,
  onChange?: (changedIds: string[]) => void
): Promise<void> {
  const promise = store.startWatching(onChange);
  triggerReady();
  await promise;
}

describe('DocStore File Watcher', () => {
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

  describe('isWatching', () => {
    it('returns false when not watching', () => {
      expect(store.isWatching()).toBe(false);
    });

    it('returns true after startWatching()', () => {
      store.startWatching();
      expect(store.isWatching()).toBe(true);
    });

    it('returns false after stopWatching()', () => {
      store.startWatching();
      store.stopWatching();
      expect(store.isWatching()).toBe(false);
    });
  });

  describe('startWatching', () => {
    it('initializes chokidar watcher with correct config', () => {
      store.startWatching();

      expect(chokidar.watch).toHaveBeenCalledWith(
        sourceDir,
        expect.objectContaining({
          ignoreInitial: true,
          awaitWriteFinish: expect.objectContaining({
            stabilityThreshold: 100,
          }),
        })
      );
    });

    it('throws if already watching', () => {
      store.startWatching();
      expect(() => store.startWatching()).toThrow(/already watching/i);
    });

    it('registers handlers for ready, add, change, and unlink events', () => {
      store.startWatching();
      const mockWatcher = getMockWatcher();

      const registeredEvents = mockWatcher.on.mock.calls.map(
        (call: unknown[]) => call[0]
      );
      expect(registeredEvents).toContain('ready');
      expect(registeredEvents).toContain('add');
      expect(registeredEvents).toContain('change');
      expect(registeredEvents).toContain('unlink');
    });

    it('returns promise that resolves when ready event fires', async () => {
      const promise = store.startWatching();

      // Promise should be pending until ready fires
      let resolved = false;
      promise.then(() => {
        resolved = true;
      });

      // Not resolved yet
      await Promise.resolve(); // Flush microtasks
      expect(resolved).toBe(false);

      // Trigger ready
      triggerReady();

      // Now it should resolve
      await promise;
      expect(resolved).toBe(true);
    });

    it('accepts optional onChange callback', async () => {
      await writeMarkdownFile('test.md', '# Test');
      await store.sync();

      const onChange = vi.fn();
      store.startWatching(onChange);

      // Trigger change event
      triggerEvent('change', join(sourceDir, 'test.md'));

      // Wait for debounce (1s) + processing
      await vi.waitFor(
        () => {
          expect(onChange).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );
    });
  });

  describe('stopWatching', () => {
    it('closes the chokidar watcher', async () => {
      store.startWatching();
      store.stopWatching();

      const mockWatcher = getMockWatcher();
      expect(mockWatcher.close).toHaveBeenCalled();
    });

    it('is safe to call when not watching', () => {
      expect(() => store.stopWatching()).not.toThrow();
    });

    it('clears pending changes', () => {
      store.startWatching();

      // Queue a change but stop before debounce fires
      triggerEvent('add', join(sourceDir, 'new.md'));

      store.stopWatching();

      // No crash, watcher stopped cleanly
      expect(store.isWatching()).toBe(false);
    });
  });

  describe('event handling', () => {
    it('onChange called with correct IDs for add event', async () => {
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

    it('onChange called with correct IDs for change event', async () => {
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

    it('onChange called with correct IDs for unlink event', async () => {
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

  describe('debouncing', () => {
    it('waits 1 second before processing queue', async () => {
      await writeMarkdownFile('test.md', '# Test');

      const onChange = vi.fn();
      store.startWatching(onChange);

      triggerEvent('add', join(sourceDir, 'test.md'));

      // Not called immediately
      expect(onChange).not.toHaveBeenCalled();

      // Wait for debounce + processing
      await vi.waitFor(
        () => {
          expect(onChange).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );
    });

    it('resets timer on each new event', async () => {
      await writeMarkdownFile('first.md', '# First');
      await writeMarkdownFile('second.md', '# Second');

      const onChange = vi.fn();
      store.startWatching(onChange);

      triggerEvent('add', join(sourceDir, 'first.md'));

      // After short delay, add another event - should reset timer
      await new Promise((r) => setTimeout(r, 100));
      triggerEvent('add', join(sourceDir, 'second.md'));

      // Wait for debounce + processing
      await vi.waitFor(
        () => {
          // Both files should be batched into single callback
          expect(onChange).toHaveBeenCalledTimes(1);
          expect(onChange).toHaveBeenCalledWith(
            expect.arrayContaining(['first.md', 'second.md'])
          );
        },
        { timeout: 2000 }
      );
    });

    it('batches multiple events within debounce window', async () => {
      await writeMarkdownFile('a.md', '# A');
      await writeMarkdownFile('b.md', '# B');
      await writeMarkdownFile('c.md', '# C');

      const onChange = vi.fn();
      store.startWatching(onChange);

      triggerEvent('add', join(sourceDir, 'a.md'));
      await new Promise((r) => setTimeout(r, 100));
      triggerEvent('add', join(sourceDir, 'b.md'));
      await new Promise((r) => setTimeout(r, 100));
      triggerEvent('add', join(sourceDir, 'c.md'));

      // Wait for debounce + processing
      await vi.waitFor(
        () => {
          expect(onChange).toHaveBeenCalledTimes(1);
          expect(onChange).toHaveBeenCalledWith(
            expect.arrayContaining(['a.md', 'b.md', 'c.md'])
          );
        },
        { timeout: 2000 }
      );
    });
  });

  describe('event coalescing', () => {
    it('add + change = add', async () => {
      await writeMarkdownFile('new.md', '# New');

      const onChange = vi.fn();
      store.startWatching(onChange);

      triggerEvent('add', join(sourceDir, 'new.md'));
      await new Promise((r) => setTimeout(r, 100));
      triggerEvent('change', join(sourceDir, 'new.md'));

      await vi.waitFor(
        () => {
          // Coalesced: add + change = add
          expect(onChange).toHaveBeenCalledTimes(1);
        },
        { timeout: 2000 }
      );
    });

    it('add + unlink = removed from queue', async () => {
      await writeMarkdownFile('persistent.md', '# Persistent');

      const onChange = vi.fn();
      store.startWatching(onChange);

      triggerEvent('add', join(sourceDir, 'transient.md'));
      await new Promise((r) => setTimeout(r, 100));
      triggerEvent('unlink', join(sourceDir, 'transient.md'));

      // Also add a persistent file so we can verify the callback is called
      triggerEvent('add', join(sourceDir, 'persistent.md'));

      await vi.waitFor(
        () => {
          // Transient file should not be in the results
          expect(onChange).toHaveBeenCalledTimes(1);
          expect(onChange).toHaveBeenCalledWith(['persistent.md']);
        },
        { timeout: 2000 }
      );
    });

    it('change + unlink = unlink', async () => {
      await writeMarkdownFile('modified.md', '# Original');
      await store.sync();

      // Verify node exists before
      expect(await store.getNode('modified.md')).not.toBeNull();

      const onChange = vi.fn();
      store.startWatching(onChange);

      triggerEvent('change', join(sourceDir, 'modified.md'));
      await new Promise((r) => setTimeout(r, 100));
      triggerEvent('unlink', join(sourceDir, 'modified.md'));

      await vi.waitFor(
        async () => {
          // Should process as unlink - node should be deleted
          expect(onChange).toHaveBeenCalledWith(
            expect.arrayContaining(['modified.md'])
          );
          expect(await store.getNode('modified.md')).toBeNull();
        },
        { timeout: 2000 }
      );
    });

    it('change + change = change', async () => {
      await writeMarkdownFile('multi.md', '# Original');
      await store.sync();

      const onChange = vi.fn();
      store.startWatching(onChange);

      triggerEvent('change', join(sourceDir, 'multi.md'));
      await new Promise((r) => setTimeout(r, 100));
      triggerEvent('change', join(sourceDir, 'multi.md'));
      await new Promise((r) => setTimeout(r, 100));
      triggerEvent('change', join(sourceDir, 'multi.md'));

      await vi.waitFor(
        () => {
          // Should call once with the file
          expect(onChange).toHaveBeenCalledTimes(1);
          expect(onChange).toHaveBeenCalledWith(
            expect.arrayContaining(['multi.md'])
          );
        },
        { timeout: 2000 }
      );
    });
  });

  describe('exclusions', () => {
    it('ignores .roux directory', async () => {
      vi.useFakeTimers();

      const onChange = vi.fn();
      store.startWatching(onChange);

      triggerEvent('add', join(sourceDir, '.roux/cache.md'));

      await vi.advanceTimersByTimeAsync(1500);

      expect(onChange).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('ignores .git directory', async () => {
      vi.useFakeTimers();

      const onChange = vi.fn();
      store.startWatching(onChange);

      triggerEvent('add', join(sourceDir, '.git/objects/abc.md'));

      await vi.advanceTimersByTimeAsync(1500);

      expect(onChange).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('ignores node_modules directory', async () => {
      vi.useFakeTimers();

      const onChange = vi.fn();
      store.startWatching(onChange);

      triggerEvent('add', join(sourceDir, 'node_modules/pkg/README.md'));

      await vi.advanceTimersByTimeAsync(1500);

      expect(onChange).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('ignores .obsidian directory', async () => {
      vi.useFakeTimers();

      const onChange = vi.fn();
      store.startWatching(onChange);

      triggerEvent('add', join(sourceDir, '.obsidian/workspace.md'));

      await vi.advanceTimersByTimeAsync(1500);

      expect(onChange).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('ignores non-.md files', async () => {
      vi.useFakeTimers();

      const onChange = vi.fn();
      store.startWatching(onChange);

      triggerEvent('add', join(sourceDir, 'image.png'));
      triggerEvent('add', join(sourceDir, 'data.json'));
      triggerEvent('add', join(sourceDir, 'script.js'));

      await vi.advanceTimersByTimeAsync(1500);

      expect(onChange).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('processes .md files outside excluded dirs', async () => {
      await writeMarkdownFile('valid.md', '# Valid');

      const onChange = vi.fn();
      store.startWatching(onChange);

      triggerEvent('add', join(sourceDir, 'valid.md'));

      await vi.waitFor(
        () => {
          expect(onChange).toHaveBeenCalledWith(expect.arrayContaining(['valid.md']));
        },
        { timeout: 2000 }
      );
    });
  });

  describe('error handling', () => {
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

      // Wait for async processing to complete
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
        () => {
          expect(mockVector.delete).toHaveBeenCalledWith('with-embedding.md');
          // Verify embedding is actually gone, not just that delete was called
          expect(mockVector.hasEmbedding('with-embedding.md')).toBe(false);
        },
        { timeout: 2000 }
      );

      customStore.close();
    });
  });

  describe('close() integration', () => {
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
  });
});
