import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readFile, access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Will be implemented
import { initCommand } from '../../../src/cli/commands/init.js';

describe('init command', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `roux-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('creates roux.yaml with minimal defaults', async () => {
    const result = await initCommand(testDir);

    const configPath = join(testDir, 'roux.yaml');
    const content = await readFile(configPath, 'utf-8');

    expect(content).toContain('providers:');
    expect(content).toContain('store:');
    expect(content).toContain('type: docstore');
    expect(result.created).toBe(true);
  });

  it('creates .roux directory', async () => {
    await initCommand(testDir);

    const rouxDir = join(testDir, '.roux');
    await expect(access(rouxDir)).resolves.toBeUndefined();
  });

  it('returns created: false if already initialized', async () => {
    await initCommand(testDir);
    const result = await initCommand(testDir);

    expect(result.created).toBe(false);
    expect(result.configPath).toBe(join(testDir, 'roux.yaml'));
  });

  it('does not overwrite existing roux.yaml', async () => {
    const configPath = join(testDir, 'roux.yaml');
    await writeFile(configPath, 'custom: config\n', 'utf-8');

    await initCommand(testDir);

    const content = await readFile(configPath, 'utf-8');
    expect(content).toBe('custom: config\n');
  });

  it('creates .roux even if roux.yaml exists', async () => {
    const configPath = join(testDir, 'roux.yaml');
    await writeFile(configPath, 'custom: config\n', 'utf-8');

    await initCommand(testDir);

    const rouxDir = join(testDir, '.roux');
    await expect(access(rouxDir)).resolves.toBeUndefined();
  });
});
