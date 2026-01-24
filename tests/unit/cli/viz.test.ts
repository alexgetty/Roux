import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { vizCommand, type VizOptions } from '../../../src/cli/commands/viz.js';
import { initCommand } from '../../../src/cli/commands/init.js';
import { DocStore } from '../../../src/providers/docstore/index.js';

describe('viz command', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `roux-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('throws if not initialized', async () => {
    await expect(vizCommand(testDir)).rejects.toThrow('not initialized');
  });

  it('outputs to .roux/graph.html by default', async () => {
    await initCommand(testDir);
    await writeFile(join(testDir, 'test.md'), '# Test', 'utf-8');

    const store = new DocStore(testDir, join(testDir, '.roux'));
    await store.sync();
    store.close();

    const result = await vizCommand(testDir);

    expect(result.outputPath).toBe(join(testDir, '.roux', 'graph.html'));
    await expect(access(result.outputPath)).resolves.toBeUndefined();
  });

  it('respects custom output path', async () => {
    await initCommand(testDir);
    const customPath = join(testDir, 'custom', 'viz.html');

    const result = await vizCommand(testDir, { output: customPath });

    expect(result.outputPath).toBe(customPath);
    await expect(access(customPath)).resolves.toBeUndefined();
  });

  it('generates valid HTML with D3 CDN', async () => {
    await initCommand(testDir);
    await writeFile(join(testDir, 'test.md'), '# Test', 'utf-8');

    const store = new DocStore(testDir, join(testDir, '.roux'));
    await store.sync();
    store.close();

    const result = await vizCommand(testDir);
    const html = await readFile(result.outputPath, 'utf-8');

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('d3js.org');
    expect(html).toContain('<svg');
  });

  it('includes graph data in output', async () => {
    await initCommand(testDir);
    await writeFile(join(testDir, 'a.md'), '---\ntitle: Node A\n---\n\nLinks to [[B]]', 'utf-8');
    await writeFile(join(testDir, 'b.md'), '---\ntitle: Node B\n---\n\nContent', 'utf-8');

    const store = new DocStore(testDir, join(testDir, '.roux'));
    await store.sync();
    store.close();

    const result = await vizCommand(testDir);
    const html = await readFile(result.outputPath, 'utf-8');

    expect(html).toContain('Node A');
    expect(html).toContain('Node B');
    expect(result.nodeCount).toBe(2);
    expect(result.edgeCount).toBe(1);
  });

  it('returns open: false when not requested', async () => {
    await initCommand(testDir);

    const result = await vizCommand(testDir);

    expect(result.shouldOpen).toBe(false);
  });

  it('returns open: true when requested', async () => {
    await initCommand(testDir);

    const result = await vizCommand(testDir, { open: true });

    expect(result.shouldOpen).toBe(true);
  });

  it('filters edges to nonexistent target nodes', async () => {
    await initCommand(testDir);
    // Create a node that links to a nonexistent node
    await writeFile(
      join(testDir, 'a.md'),
      '---\ntitle: A\n---\n\nLinks to [[nonexistent]] and [[b]]',
      'utf-8'
    );
    await writeFile(join(testDir, 'b.md'), '---\ntitle: B\n---\n\nContent', 'utf-8');

    const store = new DocStore(testDir, join(testDir, '.roux'));
    await store.sync();
    store.close();

    const result = await vizCommand(testDir);
    const html = await readFile(result.outputPath, 'utf-8');

    // Should have 2 nodes
    expect(result.nodeCount).toBe(2);
    // Should only have 1 edge (A->B), not 2 (A->nonexistent is filtered)
    expect(result.edgeCount).toBe(1);
    // HTML should contain the valid link target but not the broken one
    expect(html).toContain('b.md');
  });
});
