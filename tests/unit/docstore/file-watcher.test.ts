import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileWatcher, EXCLUDED_DIRS, type FileEventType } from '../../../src/providers/docstore/watcher.js';

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

function triggerReady() {
  triggerEvent('ready');
}

describe('FileWatcher', () => {
  let tempDir: string;
  let sourceDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tempDir = await mkdtemp(join(tmpdir(), 'roux-file-watcher-test-'));
    sourceDir = join(tempDir, 'source');
    await mkdir(sourceDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('lifecycle', () => {
    it('isWatching returns false initially', () => {
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch: vi.fn(),
      });
      expect(watcher.isWatching()).toBe(false);
    });

    it('isWatching returns true after start()', async () => {
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch: vi.fn(),
      });
      const promise = watcher.start();
      triggerReady();
      await promise;
      expect(watcher.isWatching()).toBe(true);
    });

    it('isWatching returns false after stop()', async () => {
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch: vi.fn(),
      });
      const promise = watcher.start();
      triggerReady();
      await promise;
      watcher.stop();
      expect(watcher.isWatching()).toBe(false);
    });

    it('stop() before start() is a no-op', () => {
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch: vi.fn(),
      });
      expect(() => watcher.stop()).not.toThrow();
      expect(watcher.isWatching()).toBe(false);
    });

    it('start() throws if already watching', async () => {
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch: vi.fn(),
      });
      const promise = watcher.start();
      triggerReady();
      await promise;

      await expect(watcher.start()).rejects.toThrow(/already watching/i);
    });
  });

  describe('chokidar configuration', () => {
    it('initializes chokidar with correct options', async () => {
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch: vi.fn(),
      });
      const promise = watcher.start();
      triggerReady();
      await promise;

      expect(chokidar.watch).toHaveBeenCalledWith(
        sourceDir,
        expect.objectContaining({
          ignoreInitial: true,
          awaitWriteFinish: expect.objectContaining({
            stabilityThreshold: 100,
          }),
          followSymlinks: false,
        })
      );
    });

    it('configures ignored patterns for excluded directories', async () => {
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch: vi.fn(),
      });
      const promise = watcher.start();
      triggerReady();
      await promise;

      const callArgs = (chokidar.watch as Mock).mock.calls[0];
      const options = callArgs[1];
      expect(options.ignored).toEqual(
        expect.arrayContaining([
          '**/.roux/**',
          '**/node_modules/**',
          '**/.git/**',
          '**/.obsidian/**',
        ])
      );
    });

    it('registers handlers for ready, add, change, unlink, and error events', async () => {
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch: vi.fn(),
      });
      watcher.start();
      const mockWatcher = getMockWatcher();

      const registeredEvents = mockWatcher.on.mock.calls.map(
        (call: unknown[]) => call[0]
      );
      expect(registeredEvents).toContain('ready');
      expect(registeredEvents).toContain('add');
      expect(registeredEvents).toContain('change');
      expect(registeredEvents).toContain('unlink');
      expect(registeredEvents).toContain('error');
    });

    it('resolves start() promise when ready event fires', async () => {
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch: vi.fn(),
      });
      const promise = watcher.start();

      let resolved = false;
      promise.then(() => {
        resolved = true;
      });

      await Promise.resolve();
      expect(resolved).toBe(false);

      triggerReady();
      await promise;
      expect(resolved).toBe(true);
    });

    it('closes chokidar watcher on stop()', async () => {
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch: vi.fn(),
      });
      const promise = watcher.start();
      triggerReady();
      await promise;

      watcher.stop();

      const mockWatcher = getMockWatcher();
      expect(mockWatcher.close).toHaveBeenCalled();
    });
  });

  describe('event filtering', () => {
    it('ignores files not in extensions set', () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      watcher.start();
      triggerReady();

      triggerEvent('add', join(sourceDir, 'image.png'));
      triggerEvent('add', join(sourceDir, 'data.json'));
      triggerEvent('add', join(sourceDir, 'script.js'));

      watcher.flush();
      expect(onBatch).not.toHaveBeenCalled();
    });

    it('allows multiple extensions', () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md', '.markdown']),
        onBatch,
      });
      watcher.start();
      triggerReady();

      triggerEvent('add', join(sourceDir, 'note.md'));
      triggerEvent('add', join(sourceDir, 'readme.markdown'));

      watcher.flush();
      expect(onBatch).toHaveBeenCalledWith(
        new Map([
          ['note.md', 'add'],
          ['readme.markdown', 'add'],
        ])
      );
    });

    it('skips files with no extension', () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      watcher.start();
      triggerReady();

      triggerEvent('add', join(sourceDir, 'README'));
      triggerEvent('add', join(sourceDir, 'LICENSE'));

      watcher.flush();
      expect(onBatch).not.toHaveBeenCalled();
    });

    it('skips dotfiles (extension is empty)', () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      watcher.start();
      triggerReady();

      triggerEvent('add', join(sourceDir, '.gitignore'));
      triggerEvent('add', join(sourceDir, '.env'));

      watcher.flush();
      expect(onBatch).not.toHaveBeenCalled();
    });

    it('is case-insensitive for extension matching', () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      watcher.start();
      triggerReady();

      triggerEvent('add', join(sourceDir, 'upper.MD'));
      triggerEvent('add', join(sourceDir, 'lower.md'));
      triggerEvent('add', join(sourceDir, 'mixed.Md'));

      watcher.flush();
      expect(onBatch).toHaveBeenCalledWith(
        new Map([
          ['upper.md', 'add'],
          ['lower.md', 'add'],
          ['mixed.md', 'add'],
        ])
      );
    });

    it('skips all files when extensions set is empty', () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(),
        onBatch,
      });
      watcher.start();
      triggerReady();

      triggerEvent('add', join(sourceDir, 'note.md'));
      triggerEvent('add', join(sourceDir, 'data.json'));

      watcher.flush();
      expect(onBatch).not.toHaveBeenCalled();
    });

    it('ignores files in .roux directory', () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      watcher.start();
      triggerReady();

      triggerEvent('add', join(sourceDir, '.roux/cache.md'));

      watcher.flush();
      expect(onBatch).not.toHaveBeenCalled();
    });

    it('ignores files in .git directory', () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      watcher.start();
      triggerReady();

      triggerEvent('add', join(sourceDir, '.git/objects/abc.md'));

      watcher.flush();
      expect(onBatch).not.toHaveBeenCalled();
    });

    it('ignores files in node_modules directory', () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      watcher.start();
      triggerReady();

      triggerEvent('add', join(sourceDir, 'node_modules/pkg/README.md'));

      watcher.flush();
      expect(onBatch).not.toHaveBeenCalled();
    });

    it('ignores files in .obsidian directory', () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      watcher.start();
      triggerReady();

      triggerEvent('add', join(sourceDir, '.obsidian/workspace.md'));

      watcher.flush();
      expect(onBatch).not.toHaveBeenCalled();
    });

    it('processes .md files outside excluded directories', () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      watcher.start();
      triggerReady();

      triggerEvent('add', join(sourceDir, 'valid.md'));

      watcher.flush();
      expect(onBatch).toHaveBeenCalledWith(new Map([['valid.md', 'add']]));
    });

    it('handles nested file paths correctly', () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      watcher.start();
      triggerReady();

      triggerEvent('add', join(sourceDir, 'folder/subfolder/deep.md'));

      watcher.flush();
      expect(onBatch).toHaveBeenCalledWith(
        new Map([['folder/subfolder/deep.md', 'add']])
      );
    });

  });

  describe('event coalescing', () => {
    it('add + change = add', () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      watcher.start();
      triggerReady();

      triggerEvent('add', join(sourceDir, 'new.md'));
      triggerEvent('change', join(sourceDir, 'new.md'));

      watcher.flush();
      expect(onBatch).toHaveBeenCalledWith(new Map([['new.md', 'add']]));
    });

    it('add + unlink = removed from queue (no event)', () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      watcher.start();
      triggerReady();

      triggerEvent('add', join(sourceDir, 'transient.md'));
      triggerEvent('unlink', join(sourceDir, 'transient.md'));

      watcher.flush();
      // No events emitted - file was created then deleted in same window
      expect(onBatch).not.toHaveBeenCalled();
    });

    it('add + unlink clears debounce timer (no wasted flush call)', async () => {
      vi.useFakeTimers();

      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        debounceMs: 100,
        onBatch,
      });
      watcher.start();
      triggerReady();

      // Spy on flush to verify it's not called when timer expires
      const flushSpy = vi.spyOn(watcher, 'flush');

      // add + unlink cancels out, timer should be cleared
      triggerEvent('add', join(sourceDir, 'transient.md'));
      triggerEvent('unlink', join(sourceDir, 'transient.md'));

      // Let debounce timer expire
      await vi.advanceTimersByTimeAsync(200);

      // flush should NOT be called - timer should have been cleared, not just guarded
      expect(flushSpy).not.toHaveBeenCalled();
      expect(onBatch).not.toHaveBeenCalled();

      watcher.stop();
      vi.useRealTimers();
    });

    it('change + change = change', () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      watcher.start();
      triggerReady();

      triggerEvent('change', join(sourceDir, 'multi.md'));
      triggerEvent('change', join(sourceDir, 'multi.md'));
      triggerEvent('change', join(sourceDir, 'multi.md'));

      watcher.flush();
      expect(onBatch).toHaveBeenCalledTimes(1);
      expect(onBatch).toHaveBeenCalledWith(new Map([['multi.md', 'change']]));
    });

    it('change + unlink = unlink', () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      watcher.start();
      triggerReady();

      triggerEvent('change', join(sourceDir, 'modified.md'));
      triggerEvent('unlink', join(sourceDir, 'modified.md'));

      watcher.flush();
      expect(onBatch).toHaveBeenCalledWith(new Map([['modified.md', 'unlink']]));
    });

    it('change + add = add (delete was missed, treat as new file)', () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      watcher.start();
      triggerReady();

      triggerEvent('change', join(sourceDir, 'replaced.md'));
      triggerEvent('add', join(sourceDir, 'replaced.md'));

      watcher.flush();
      expect(onBatch).toHaveBeenCalledWith(new Map([['replaced.md', 'add']]));
    });

    it('unlink + add = add (file deleted then re-created)', () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      watcher.start();
      triggerReady();

      triggerEvent('unlink', join(sourceDir, 'recreated.md'));
      triggerEvent('add', join(sourceDir, 'recreated.md'));

      watcher.flush();
      expect(onBatch).toHaveBeenCalledWith(new Map([['recreated.md', 'add']]));
    });

    it('unlink + change = unlink (spurious change after delete is ignored)', () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      watcher.start();
      triggerReady();

      triggerEvent('unlink', join(sourceDir, 'deleted.md'));
      triggerEvent('change', join(sourceDir, 'deleted.md'));

      watcher.flush();
      expect(onBatch).toHaveBeenCalledWith(new Map([['deleted.md', 'unlink']]));
    });

    it('add + add = add (idempotent)', () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      watcher.start();
      triggerReady();

      triggerEvent('add', join(sourceDir, 'duplicate.md'));
      triggerEvent('add', join(sourceDir, 'duplicate.md'));
      triggerEvent('add', join(sourceDir, 'duplicate.md'));

      watcher.flush();
      expect(onBatch).toHaveBeenCalledTimes(1);
      expect(onBatch).toHaveBeenCalledWith(new Map([['duplicate.md', 'add']]));
    });

    it('unlink + unlink = unlink (idempotent)', () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      watcher.start();
      triggerReady();

      triggerEvent('unlink', join(sourceDir, 'removed.md'));
      triggerEvent('unlink', join(sourceDir, 'removed.md'));
      triggerEvent('unlink', join(sourceDir, 'removed.md'));

      watcher.flush();
      expect(onBatch).toHaveBeenCalledTimes(1);
      expect(onBatch).toHaveBeenCalledWith(new Map([['removed.md', 'unlink']]));
    });
  });

  describe('debouncing', () => {
    it('batches multiple events within debounce window', async () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        debounceMs: 1000,
        onBatch,
      });
      watcher.start();
      triggerReady();

      triggerEvent('add', join(sourceDir, 'a.md'));
      triggerEvent('add', join(sourceDir, 'b.md'));
      triggerEvent('add', join(sourceDir, 'c.md'));

      // Not called yet (debounce window)
      expect(onBatch).not.toHaveBeenCalled();

      // Flush to emit immediately
      watcher.flush();
      expect(onBatch).toHaveBeenCalledTimes(1);
      expect(onBatch).toHaveBeenCalledWith(
        new Map([
          ['a.md', 'add'],
          ['b.md', 'add'],
          ['c.md', 'add'],
        ])
      );
    });

    it('resets timer on each new event', async () => {
      vi.useFakeTimers();

      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        debounceMs: 200,
        onBatch,
      });
      watcher.start();
      triggerReady();

      // First event starts the 200ms timer
      triggerEvent('add', join(sourceDir, 'first.md'));

      // Advance 100ms (halfway through debounce)
      await vi.advanceTimersByTimeAsync(100);
      expect(onBatch).not.toHaveBeenCalled();

      // Second event resets the timer back to 200ms
      triggerEvent('add', join(sourceDir, 'second.md'));

      // Advance another 100ms (200ms from first, but only 100ms from second)
      await vi.advanceTimersByTimeAsync(100);
      expect(onBatch).not.toHaveBeenCalled();

      // Advance 100ms more (now 200ms from second event) - should fire
      await vi.advanceTimersByTimeAsync(100);
      expect(onBatch).toHaveBeenCalledTimes(1);
      expect(onBatch).toHaveBeenCalledWith(
        new Map([
          ['first.md', 'add'],
          ['second.md', 'add'],
        ])
      );

      watcher.stop();
      vi.useRealTimers();
    });

    it('uses default 1000ms debounce when not specified', async () => {
      vi.useFakeTimers();

      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      watcher.start();
      triggerReady();

      // Trigger an event
      triggerEvent('add', join(sourceDir, 'test.md'));

      // At 500ms: should NOT have fired yet
      await vi.advanceTimersByTimeAsync(500);
      expect(onBatch).not.toHaveBeenCalled();

      // At 999ms: still should NOT have fired
      await vi.advanceTimersByTimeAsync(499);
      expect(onBatch).not.toHaveBeenCalled();

      // At 1000ms: NOW it should fire
      await vi.advanceTimersByTimeAsync(1);
      expect(onBatch).toHaveBeenCalledTimes(1);
      expect(onBatch).toHaveBeenCalledWith(new Map([['test.md', 'add']]));

      watcher.stop();
      vi.useRealTimers();
    });
  });

  describe('flush()', () => {
    it('emits current batch immediately', () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      watcher.start();
      triggerReady();

      triggerEvent('add', join(sourceDir, 'test.md'));
      expect(onBatch).not.toHaveBeenCalled();

      watcher.flush();
      expect(onBatch).toHaveBeenCalledTimes(1);
      expect(onBatch).toHaveBeenCalledWith(new Map([['test.md', 'add']]));
    });

    it('clears debounce timer', () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      watcher.start();
      triggerReady();

      triggerEvent('add', join(sourceDir, 'test.md'));
      watcher.flush();

      // Flush again should not emit (queue was cleared)
      watcher.flush();
      expect(onBatch).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when queue is empty', () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      watcher.start();
      triggerReady();

      watcher.flush();
      expect(onBatch).not.toHaveBeenCalled();
    });

    it('works before start() without crashing', () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });

      expect(() => watcher.flush()).not.toThrow();
      expect(onBatch).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('rejects start() promise on chokidar error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch: vi.fn(),
      });
      const promise = watcher.start();

      const emfileError = new Error(
        'EMFILE: too many open files'
      ) as NodeJS.ErrnoException;
      emfileError.code = 'EMFILE';
      triggerEvent('error', emfileError);

      await expect(promise).rejects.toThrow('EMFILE');
      consoleSpy.mockRestore();
    });

    it('logs helpful message for EMFILE errors', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch: vi.fn(),
      });
      const promise = watcher.start();

      const emfileError = new Error(
        'EMFILE: too many open files'
      ) as NodeJS.ErrnoException;
      emfileError.code = 'EMFILE';
      triggerEvent('error', emfileError);

      await expect(promise).rejects.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('file descriptor limit')
      );

      consoleSpy.mockRestore();
    });

    it('onBatch exception is logged but does not crash watcher', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const onBatch = vi.fn().mockImplementation(() => {
        throw new Error('Batch processing failed');
      });
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      watcher.start();
      triggerReady();

      triggerEvent('add', join(sourceDir, 'test.md'));
      expect(() => watcher.flush()).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('onBatch'),
        expect.any(Error)
      );

      // Watcher should still be operational
      expect(watcher.isWatching()).toBe(true);

      // Should be able to process more events
      triggerEvent('add', join(sourceDir, 'another.md'));
      watcher.flush();
      expect(onBatch).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });
  });

  describe('EXCLUDED_DIRS constant', () => {
    it('exports correct excluded directories', () => {
      expect(EXCLUDED_DIRS).toBeInstanceOf(Set);
      expect(EXCLUDED_DIRS.has('.roux')).toBe(true);
      expect(EXCLUDED_DIRS.has('node_modules')).toBe(true);
      expect(EXCLUDED_DIRS.has('.git')).toBe(true);
      expect(EXCLUDED_DIRS.has('.obsidian')).toBe(true);
      expect(EXCLUDED_DIRS.size).toBe(4);
    });

    it('is immutable (ReadonlySet)', () => {
      // TypeScript enforces this at compile time
      // We just verify the type exists and has expected values
      expect(EXCLUDED_DIRS).toBeDefined();
    });
  });

  describe('stop() behavior', () => {
    it('clears pending changes on stop', async () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      const promise = watcher.start();
      triggerReady();
      await promise;

      triggerEvent('add', join(sourceDir, 'pending.md'));
      watcher.stop();

      // Flush after stop should not emit the pending change
      watcher.flush();
      expect(onBatch).not.toHaveBeenCalled();
    });
  });

  describe('restart watching', () => {
    it('can restart after stop()', async () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });

      // First start
      const promise1 = watcher.start();
      triggerReady();
      await promise1;
      expect(watcher.isWatching()).toBe(true);

      // Stop
      watcher.stop();
      expect(watcher.isWatching()).toBe(false);

      // Clear mock calls from previous chokidar.watch
      vi.clearAllMocks();

      // Restart - should create new chokidar instance
      const promise2 = watcher.start();
      triggerReady();
      await promise2;

      expect(watcher.isWatching()).toBe(true);
      expect(chokidar.watch).toHaveBeenCalledTimes(1);

      // Verify events work after restart
      triggerEvent('add', join(sourceDir, 'after-restart.md'));
      watcher.flush();
      expect(onBatch).toHaveBeenCalledWith(new Map([['after-restart.md', 'add']]));
    });

    it('clears state between restarts', async () => {
      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });

      // Start and queue an event
      const promise1 = watcher.start();
      triggerReady();
      await promise1;
      triggerEvent('add', join(sourceDir, 'before-stop.md'));

      // Stop without flushing
      watcher.stop();
      vi.clearAllMocks();

      // Restart
      const promise2 = watcher.start();
      triggerReady();
      await promise2;

      // Flush should have nothing from before
      watcher.flush();
      expect(onBatch).not.toHaveBeenCalled();

      // New events should work
      triggerEvent('add', join(sourceDir, 'after-restart.md'));
      watcher.flush();
      expect(onBatch).toHaveBeenCalledWith(new Map([['after-restart.md', 'add']]));
    });
  });

  describe('error after ready', () => {
    it('logs error that occurs after watcher is ready', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch: vi.fn(),
      });
      const promise = watcher.start();
      triggerReady();
      await promise;

      // Error after ready
      const runtimeError = new Error('ENOSPC: no space left on device') as NodeJS.ErrnoException;
      runtimeError.code = 'ENOSPC';
      triggerEvent('error', runtimeError);

      // Should log the error
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('error'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('watcher continues operating after runtime error', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const onBatch = vi.fn();
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      const promise = watcher.start();
      triggerReady();
      await promise;

      // Error after ready
      const runtimeError = new Error('Some chokidar error');
      triggerEvent('error', runtimeError);

      // Watcher should still be watching
      expect(watcher.isWatching()).toBe(true);

      // Should still process events
      triggerEvent('add', join(sourceDir, 'after-error.md'));
      watcher.flush();
      expect(onBatch).toHaveBeenCalledWith(new Map([['after-error.md', 'add']]));

      consoleSpy.mockRestore();
    });
  });

  describe('async onBatch error handling', () => {
    it('handles async onBatch that returns rejected Promise', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const onBatch = vi.fn().mockRejectedValue(new Error('Async batch failed'));
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      watcher.start();
      triggerReady();

      triggerEvent('add', join(sourceDir, 'test.md'));

      // flush() should not throw even with async rejection
      expect(() => watcher.flush()).not.toThrow();

      // Give the Promise time to reject
      await new Promise((r) => setTimeout(r, 10));

      // Should log the async error
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('onBatch'),
        expect.any(Error)
      );

      // Watcher should still be operational
      expect(watcher.isWatching()).toBe(true);

      consoleSpy.mockRestore();
    });

    it('handles async onBatch that resolves successfully', async () => {
      const onBatch = vi.fn().mockResolvedValue(undefined);
      const watcher = new FileWatcher({
        root: sourceDir,
        extensions: new Set(['.md']),
        onBatch,
      });
      watcher.start();
      triggerReady();

      triggerEvent('add', join(sourceDir, 'test.md'));
      watcher.flush();

      // Should work fine
      expect(onBatch).toHaveBeenCalled();
      expect(watcher.isWatching()).toBe(true);
    });
  });
});
