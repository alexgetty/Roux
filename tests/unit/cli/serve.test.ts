import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  serveCommand,
  type ServeOptions,
  type ServeHandle,
} from '../../../src/cli/commands/serve.js';
import { initCommand } from '../../../src/cli/commands/init.js';
import { DocStore } from '../../../src/providers/docstore/index.js';

describe('serve command', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `roux-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('throws if not initialized', async () => {
    await expect(serveCommand(testDir)).rejects.toThrow('not initialized');
  });

  it('returns handle with stop method', async () => {
    await initCommand(testDir);

    // Use mock transport to avoid stdio
    const handle = await serveCommand(testDir, {
      watch: false,
      transportFactory: () => ({ start: async () => {}, close: async () => {} }),
    });

    expect(handle).toHaveProperty('stop');
    expect(typeof handle.stop).toBe('function');

    await handle.stop();
  });

  it('respects watch: false option', async () => {
    await initCommand(testDir);
    await writeFile(join(testDir, 'test.md'), '# Test', 'utf-8');

    const handle = await serveCommand(testDir, {
      watch: false,
      transportFactory: () => ({ start: async () => {}, close: async () => {} }),
    });

    expect(handle.isWatching).toBe(false);

    await handle.stop();
  });

  it('starts watching by default', async () => {
    await initCommand(testDir);
    await writeFile(join(testDir, 'test.md'), '# Test', 'utf-8');

    const handle = await serveCommand(testDir, {
      transportFactory: () => ({ start: async () => {}, close: async () => {} }),
    });

    expect(handle.isWatching).toBe(true);

    await handle.stop();
  });

  it('syncs files on startup', async () => {
    await initCommand(testDir);
    await writeFile(join(testDir, 'a.md'), '---\ntitle: A\n---\n\nContent', 'utf-8');
    await writeFile(join(testDir, 'b.md'), '---\ntitle: B\n---\n\nContent', 'utf-8');

    const handle = await serveCommand(testDir, {
      watch: false,
      transportFactory: () => ({ start: async () => {}, close: async () => {} }),
    });

    expect(handle.nodeCount).toBe(2);

    await handle.stop();
  });

  it('calls onProgress during embedding generation', async () => {
    await initCommand(testDir);
    await writeFile(join(testDir, 'a.md'), '---\ntitle: A\n---\n\nContent A', 'utf-8');
    await writeFile(join(testDir, 'b.md'), '---\ntitle: B\n---\n\nContent B', 'utf-8');

    const progressCalls: Array<{ current: number; total: number }> = [];

    const handle = await serveCommand(testDir, {
      watch: false,
      transportFactory: () => ({ start: async () => {}, close: async () => {} }),
      onProgress: (current, total) => {
        progressCalls.push({ current, total });
      },
    });

    // Should have progress updates (at least start and end)
    expect(progressCalls.length).toBeGreaterThan(0);
    expect(progressCalls[progressCalls.length - 1]?.current).toBe(2);
    expect(progressCalls[progressCalls.length - 1]?.total).toBe(2);

    await handle.stop();
  });

  it('skips embedding generation for nodes with existing embeddings', async () => {
    await initCommand(testDir);
    await writeFile(join(testDir, 'a.md'), '---\ntitle: A\n---\n\nContent A', 'utf-8');
    await writeFile(join(testDir, 'b.md'), '---\ntitle: B\n---\n\nContent B', 'utf-8');

    // Pre-populate embedding for node A via DocStore
    const store = new DocStore({ sourceRoot: testDir, cacheDir: join(testDir, '.roux') });
    await store.sync();
    // Use a known embedding vector (384 dims for transformers default model)
    const preExistingVector = new Array(384).fill(0.1);
    await store.storeEmbedding('a.md', preExistingVector, 'pre-existing-model');
    store.close();

    // Run serve - should skip A, only embed B
    const handle = await serveCommand(testDir, {
      watch: false,
      transportFactory: () => ({ start: async () => {}, close: async () => {} }),
    });

    await handle.stop();

    // Verify A still has original model (not overwritten by serve)
    const verifyStore = new DocStore({ sourceRoot: testDir, cacheDir: join(testDir, '.roux') });
    // hasEmbedding only tells us it exists, but getModel on vectorProvider can verify model name
    // Since DocStore doesn't expose getModel, we can check via SqliteVectorIndex directly
    const { SqliteVectorIndex } = await import('../../../src/providers/vector/sqlite.js');
    const vectorProvider = new SqliteVectorIndex(join(testDir, '.roux'));
    const modelForA = await vectorProvider.getModel('a.md');
    const modelForB = await vectorProvider.getModel('b.md');
    vectorProvider.close();
    verifyStore.close();

    // A should still have the pre-existing model (not overwritten)
    expect(modelForA).toBe('pre-existing-model');
    // B should have been embedded by serve (using transformers model)
    expect(modelForB).not.toBeNull();
    expect(modelForB).not.toBe('pre-existing-model');
  });

  it('degrades gracefully when file watcher fails', async () => {
    await initCommand(testDir);
    await writeFile(join(testDir, 'test.md'), '# Test', 'utf-8');

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Mock startWatching to fail
    const originalStartWatching = DocStore.prototype.startWatching;
    DocStore.prototype.startWatching = vi.fn().mockRejectedValue(
      Object.assign(new Error('EMFILE: too many open files'), { code: 'EMFILE' })
    );

    try {
      const handle = await serveCommand(testDir, {
        transportFactory: () => ({ start: async () => {}, close: async () => {} }),
      });

      // Server should still work
      expect(handle.nodeCount).toBe(1);
      // But watching should be disabled
      expect(handle.isWatching).toBe(false);
      // Warning should be logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('File watching disabled'),
        expect.any(String)
      );

      await handle.stop();
    } finally {
      DocStore.prototype.startWatching = originalStartWatching;
      consoleSpy.mockRestore();
    }
  });

  describe('error propagation and cleanup', () => {
    it('propagates embedding failure during startup', async () => {
      await initCommand(testDir);
      await writeFile(join(testDir, 'test.md'), '---\ntitle: Test\n---\n\nContent', 'utf-8');

      // Mock TransformersEmbedding to fail on embed()
      const { TransformersEmbedding } = await import('../../../src/providers/embedding/transformers.js');
      const originalEmbed = TransformersEmbedding.prototype.embed;
      TransformersEmbedding.prototype.embed = vi.fn().mockRejectedValue(
        new Error('Embedding model failed to load')
      );

      try {
        await expect(
          serveCommand(testDir, {
            watch: false,
            transportFactory: () => ({ start: async () => {}, close: async () => {} }),
          })
        ).rejects.toThrow('Embedding model failed to load');
      } finally {
        TransformersEmbedding.prototype.embed = originalEmbed;
      }
    });

    it('propagates MCP server start failure after store sync', async () => {
      await initCommand(testDir);
      await writeFile(join(testDir, 'test.md'), '# Test', 'utf-8');

      // Transport that fails on start
      const failingTransport = () => ({
        start: async () => {
          throw new Error('Transport connection failed');
        },
        close: async () => {},
      });

      await expect(
        serveCommand(testDir, {
          watch: false,
          transportFactory: failingTransport,
        })
      ).rejects.toThrow('Transport connection failed');
    });

    it('cleans up store when MCP server start fails', async () => {
      await initCommand(testDir);
      await writeFile(join(testDir, 'test.md'), '# Test', 'utf-8');

      // Track DocStore close calls
      const closeCalls: string[] = [];
      const originalClose = DocStore.prototype.close;
      DocStore.prototype.close = vi.fn().mockImplementation(function (this: DocStore) {
        closeCalls.push('close');
        return originalClose.call(this);
      });

      // Transport that fails on start
      const failingTransport = () => ({
        start: async () => {
          throw new Error('Transport connection failed');
        },
        close: async () => {},
      });

      try {
        await serveCommand(testDir, {
          watch: false,
          transportFactory: failingTransport,
        });
      } catch {
        // Expected to throw
      } finally {
        DocStore.prototype.close = originalClose;
      }

      // Store should be cleaned up on failure
      expect(closeCalls).toContain('close');
    });

    it('logs warning and continues when watch callback embedding fails', async () => {
      await initCommand(testDir);
      await writeFile(join(testDir, 'test.md'), '---\ntitle: Test\n---\n\nContent', 'utf-8');
      await writeFile(join(testDir, 'test2.md'), '---\ntitle: Test2\n---\n\nContent2', 'utf-8');

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Capture the watch callback
      let watchCallback: ((changedIds: string[]) => Promise<void>) | null = null;
      const originalStartWatching = DocStore.prototype.startWatching;
      DocStore.prototype.startWatching = vi.fn().mockImplementation(
        async function (this: DocStore, callback: (changedIds: string[]) => Promise<void>) {
          watchCallback = callback;
          // Call the real method to set up watching state
          return originalStartWatching.call(this, callback);
        }
      );

      // Mock embedding to fail on second call (first call is during startup)
      const { TransformersEmbedding } = await import('../../../src/providers/embedding/transformers.js');
      const originalEmbed = TransformersEmbedding.prototype.embed;
      let embedCallCount = 0;
      TransformersEmbedding.prototype.embed = vi.fn().mockImplementation(async (content: string) => {
        embedCallCount++;
        // Fail on third embed call (first two are during startup for test.md and test2.md)
        if (embedCallCount === 3) {
          throw new Error('Embedding failed in watch callback');
        }
        return originalEmbed.call(TransformersEmbedding.prototype, content);
      });

      let handle: ServeHandle | null = null;
      try {
        handle = await serveCommand(testDir, {
          watch: true,
          transportFactory: () => ({ start: async () => {}, close: async () => {} }),
        });

        // Trigger the watch callback - should NOT throw (graceful degradation)
        expect(watchCallback).not.toBeNull();
        await watchCallback!(['test.md', 'test2.md']);

        // Warning should be logged
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to generate embedding for',
          'test.md',
          ':',
          'Embedding failed in watch callback'
        );

        // Second file should still have been processed (embedCallCount should be 4)
        expect(embedCallCount).toBe(4);
      } finally {
        if (handle) {
          await handle.stop();
        }
        DocStore.prototype.startWatching = originalStartWatching;
        TransformersEmbedding.prototype.embed = originalEmbed;
        consoleSpy.mockRestore();
      }
    });
  });
});
