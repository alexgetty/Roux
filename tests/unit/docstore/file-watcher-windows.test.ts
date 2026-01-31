/**
 * FileWatcher Windows path normalization tests
 *
 * These tests verify that Windows-style backslash paths are normalized to forward slashes.
 * Uses vi.mock to override node:path.relative behavior.
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Mock node:path to simulate Windows behavior
vi.mock('node:path', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:path')>();
  return {
    ...original,
    relative: (from: string, to: string) => {
      const result = original.relative(from, to);
      // Simulate Windows: if the path contains 'winpath', return backslash version
      if (to.includes('winpath')) {
        return result.replace(/\//g, '\\');
      }
      return result;
    },
  };
});

// Must import FileWatcher AFTER the mock is set up
import { FileWatcher } from '../../../src/providers/docstore/watcher.js';

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

import * as chokidar from 'chokidar';

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

describe('FileWatcher Windows path normalization', () => {
  let tempDir: string;
  let sourceDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tempDir = await mkdtemp(join(tmpdir(), 'roux-watcher-win-test-'));
    sourceDir = join(tempDir, 'source');
    await mkdir(sourceDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('normalizes Windows backslash paths to forward slashes', () => {
    const onBatch = vi.fn();
    const watcher = new FileWatcher({
      root: sourceDir,
      extensions: new Set(['.md']),
      onBatch,
    });
    watcher.start();
    triggerReady();

    // The mocked path.relative will convert this to 'notes\\winpath.md'
    triggerEvent('add', join(sourceDir, 'notes', 'winpath.md'));

    watcher.flush();
    // Should be normalized to forward slashes
    expect(onBatch).toHaveBeenCalledWith(
      new Map([['notes/winpath.md', 'add']])
    );
  });

  it('normalizes deeply nested Windows paths', () => {
    const onBatch = vi.fn();
    const watcher = new FileWatcher({
      root: sourceDir,
      extensions: new Set(['.md']),
      onBatch,
    });
    watcher.start();
    triggerReady();

    // The mocked path.relative will convert this to 'deep\\nested\\winpath.md'
    triggerEvent('add', join(sourceDir, 'deep', 'nested', 'winpath.md'));

    watcher.flush();
    // Should be normalized to forward slashes
    expect(onBatch).toHaveBeenCalledWith(
      new Map([['deep/nested/winpath.md', 'add']])
    );
  });
});
