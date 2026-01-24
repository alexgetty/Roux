import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { statusCommand, type StatusResult } from '../../../src/cli/commands/status.js';
import { initCommand } from '../../../src/cli/commands/init.js';
import { DocStore } from '../../../src/providers/docstore/index.js';

describe('status command', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `roux-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('throws if not initialized', async () => {
    await expect(statusCommand(testDir)).rejects.toThrow('not initialized');
  });

  it('returns zero counts for empty graph', async () => {
    await initCommand(testDir);
    // Create empty cache by syncing empty dir
    const store = new DocStore(testDir, join(testDir, '.roux'));
    await store.sync();
    store.close();

    const result = await statusCommand(testDir);

    expect(result.nodeCount).toBe(0);
    expect(result.edgeCount).toBe(0);
    expect(result.embeddingCount).toBe(0);
    expect(result.embeddingCoverage).toBe(1);
  });

  it('returns correct counts with nodes', async () => {
    await initCommand(testDir);

    // Create some markdown files
    await writeFile(join(testDir, 'a.md'), '---\ntitle: A\n---\n\nLinks to [[B]]', 'utf-8');
    await writeFile(join(testDir, 'b.md'), '---\ntitle: B\n---\n\nContent', 'utf-8');

    // Sync to create cache
    const store = new DocStore(testDir, join(testDir, '.roux'));
    await store.sync();
    store.close();

    const result = await statusCommand(testDir);

    expect(result.nodeCount).toBe(2);
    expect(result.edgeCount).toBe(1);
    expect(result.embeddingCount).toBe(0);
    expect(result.embeddingCoverage).toBe(0);
  });

  it('calculates embedding coverage correctly', async () => {
    await initCommand(testDir);

    await writeFile(join(testDir, 'a.md'), '---\ntitle: A\n---\n\nContent', 'utf-8');
    await writeFile(join(testDir, 'b.md'), '---\ntitle: B\n---\n\nContent', 'utf-8');

    const store = new DocStore(testDir, join(testDir, '.roux'));
    await store.sync();

    // Store embedding for one node
    await store.storeEmbedding('a.md', [0.1, 0.2, 0.3], 'test-model');
    store.close();

    const result = await statusCommand(testDir);

    expect(result.nodeCount).toBe(2);
    expect(result.embeddingCount).toBe(1);
    expect(result.embeddingCoverage).toBe(0.5);
  });

  it('returns zeros for initialized but unsynced directory', async () => {
    await initCommand(testDir);

    // Add files but do NOT sync - simulates `roux init` without `roux serve`
    await writeFile(join(testDir, 'a.md'), '---\ntitle: A\n---\n\nContent', 'utf-8');
    await writeFile(join(testDir, 'b.md'), '---\ntitle: B\n---\n\nContent', 'utf-8');

    // Status should not crash, should return zeros
    const result = await statusCommand(testDir);

    expect(result.nodeCount).toBe(0);
    expect(result.edgeCount).toBe(0);
    expect(result.embeddingCount).toBe(0);
    expect(result.embeddingCoverage).toBe(1); // 0/0 = 1 by convention
  });
});
