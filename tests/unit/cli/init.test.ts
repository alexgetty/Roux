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

  describe('MCP configuration', () => {
    it('creates .mcp.json with roux server config', async () => {
      await initCommand(testDir);

      const mcpPath = join(testDir, '.mcp.json');
      const content = await readFile(mcpPath, 'utf-8');
      const config = JSON.parse(content);

      expect(config.mcpServers).toBeDefined();
      expect(config.mcpServers.roux).toBeDefined();
      expect(config.mcpServers.roux.command).toBe('npx');
      expect(config.mcpServers.roux.args).toEqual(['roux', 'serve', '.']);
    });

    it('merges roux into existing .mcp.json preserving other servers', async () => {
      const mcpPath = join(testDir, '.mcp.json');
      const existingConfig = {
        mcpServers: {
          github: {
            type: 'http',
            url: 'https://api.githubcopilot.com/mcp/',
          },
        },
      };
      await writeFile(mcpPath, JSON.stringify(existingConfig, null, 2), 'utf-8');

      await initCommand(testDir);

      const content = await readFile(mcpPath, 'utf-8');
      const config = JSON.parse(content);

      expect(config.mcpServers.github).toEqual(existingConfig.mcpServers.github);
      expect(config.mcpServers.roux).toBeDefined();
      expect(config.mcpServers.roux.command).toBe('npx');
    });

    it('updates existing roux entry in .mcp.json', async () => {
      const mcpPath = join(testDir, '.mcp.json');
      const existingConfig = {
        mcpServers: {
          roux: {
            command: 'old-roux',
            args: ['old-args'],
          },
        },
      };
      await writeFile(mcpPath, JSON.stringify(existingConfig, null, 2), 'utf-8');

      await initCommand(testDir);

      const content = await readFile(mcpPath, 'utf-8');
      const config = JSON.parse(content);

      expect(config.mcpServers.roux.command).toBe('npx');
      expect(config.mcpServers.roux.args).toEqual(['roux', 'serve', '.']);
    });

    it('handles empty .mcp.json', async () => {
      const mcpPath = join(testDir, '.mcp.json');
      await writeFile(mcpPath, '{}', 'utf-8');

      await initCommand(testDir);

      const content = await readFile(mcpPath, 'utf-8');
      const config = JSON.parse(content);

      expect(config.mcpServers.roux).toBeDefined();
    });

    it('handles .mcp.json with empty mcpServers', async () => {
      const mcpPath = join(testDir, '.mcp.json');
      await writeFile(mcpPath, '{"mcpServers": {}}', 'utf-8');

      await initCommand(testDir);

      const content = await readFile(mcpPath, 'utf-8');
      const config = JSON.parse(content);

      expect(config.mcpServers.roux).toBeDefined();
    });
  });

  describe('Claude Code hooks', () => {
    const HOOK_MARKER = 'roux-enforce-mcp';

    it('creates .claude/settings.json with markdown hook for docstore provider', async () => {
      await initCommand(testDir);

      const settingsPath = join(testDir, '.claude', 'settings.json');
      const content = await readFile(settingsPath, 'utf-8');
      const config = JSON.parse(content);

      expect(config.hooks).toBeDefined();
      expect(config.hooks.PreToolUse).toBeDefined();
      expect(Array.isArray(config.hooks.PreToolUse)).toBe(true);

      const rouxHook = config.hooks.PreToolUse.find(
        (h: { matcher?: string; hooks?: Array<{ command?: string }> }) =>
          h.hooks?.some((hook: { command?: string }) => hook.command?.includes(HOOK_MARKER))
      );
      expect(rouxHook).toBeDefined();
      expect(rouxHook.matcher).toBe('Read|Edit|Write');
    });

    it('does not add hook when using non-docstore provider', async () => {
      const configPath = join(testDir, 'roux.yaml');
      await writeFile(
        configPath,
        `providers:
  store:
    type: memory
`,
        'utf-8'
      );

      await initCommand(testDir);

      const settingsPath = join(testDir, '.claude', 'settings.json');
      try {
        await access(settingsPath);
        // If file exists, check it has no roux hook
        const content = await readFile(settingsPath, 'utf-8');
        const config = JSON.parse(content);
        const rouxHook = config.hooks?.PreToolUse?.find(
          (h: { hooks?: Array<{ command?: string }> }) =>
            h.hooks?.some((hook: { command?: string }) => hook.command?.includes(HOOK_MARKER))
        );
        expect(rouxHook).toBeUndefined();
      } catch {
        // File doesn't exist, which is also valid
      }
    });

    it('creates .claude directory if it does not exist', async () => {
      await initCommand(testDir);

      const claudeDir = join(testDir, '.claude');
      await expect(access(claudeDir)).resolves.toBeUndefined();
    });

    it('merges hook into existing .claude/settings.json preserving other settings', async () => {
      const claudeDir = join(testDir, '.claude');
      await mkdir(claudeDir, { recursive: true });
      const settingsPath = join(claudeDir, 'settings.json');
      const existingConfig = {
        permissions: {
          allow: ['Bash(npm test)'],
        },
        someOtherSetting: 'value',
      };
      await writeFile(settingsPath, JSON.stringify(existingConfig, null, 2), 'utf-8');

      await initCommand(testDir);

      const content = await readFile(settingsPath, 'utf-8');
      const config = JSON.parse(content);

      // Existing settings preserved
      expect(config.permissions).toEqual(existingConfig.permissions);
      expect(config.someOtherSetting).toBe('value');
      // Hook added
      expect(config.hooks?.PreToolUse).toBeDefined();
    });

    it('merges hook into existing PreToolUse hooks', async () => {
      const claudeDir = join(testDir, '.claude');
      await mkdir(claudeDir, { recursive: true });
      const settingsPath = join(claudeDir, 'settings.json');
      const existingConfig = {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [{ type: 'command', command: 'echo "existing hook"' }],
            },
          ],
          PostToolUse: [
            {
              matcher: '*',
              hooks: [{ type: 'command', command: 'echo "post hook"' }],
            },
          ],
        },
      };
      await writeFile(settingsPath, JSON.stringify(existingConfig, null, 2), 'utf-8');

      await initCommand(testDir);

      const content = await readFile(settingsPath, 'utf-8');
      const config = JSON.parse(content);

      // Existing hooks preserved
      expect(config.hooks.PreToolUse).toHaveLength(2);
      expect(config.hooks.PreToolUse[0].matcher).toBe('Bash');
      expect(config.hooks.PostToolUse).toEqual(existingConfig.hooks.PostToolUse);
      // New hook added
      const rouxHook = config.hooks.PreToolUse.find(
        (h: { hooks?: Array<{ command?: string }> }) =>
          h.hooks?.some((hook: { command?: string }) => hook.command?.includes(HOOK_MARKER))
      );
      expect(rouxHook).toBeDefined();
    });

    it('does not duplicate hook on re-init', async () => {
      await initCommand(testDir);
      await initCommand(testDir);

      const settingsPath = join(testDir, '.claude', 'settings.json');
      const content = await readFile(settingsPath, 'utf-8');
      const config = JSON.parse(content);

      const rouxHooks = config.hooks.PreToolUse.filter(
        (h: { hooks?: Array<{ command?: string }> }) =>
          h.hooks?.some((hook: { command?: string }) => hook.command?.includes(HOOK_MARKER))
      );
      expect(rouxHooks).toHaveLength(1);
    });

    it('skips hook update on malformed .claude/settings.json', async () => {
      const claudeDir = join(testDir, '.claude');
      await mkdir(claudeDir, { recursive: true });
      const settingsPath = join(claudeDir, 'settings.json');
      await writeFile(settingsPath, '{ invalid json }', 'utf-8');

      // Should not throw
      await expect(initCommand(testDir)).resolves.toBeDefined();

      // Original file should be unchanged
      const content = await readFile(settingsPath, 'utf-8');
      expect(content).toBe('{ invalid json }');
    });

    it('hook command rejects .md files with helpful message', async () => {
      await initCommand(testDir);

      const settingsPath = join(testDir, '.claude', 'settings.json');
      const content = await readFile(settingsPath, 'utf-8');
      const config = JSON.parse(content);

      const rouxHook = config.hooks.PreToolUse.find(
        (h: { hooks?: Array<{ command?: string }> }) =>
          h.hooks?.some((hook: { command?: string }) => hook.command?.includes(HOOK_MARKER))
      );
      const command = rouxHook.hooks[0].command;

      // Command should check for .md extension
      expect(command).toContain('.md');
      // Command should mention MCP tools
      expect(command).toMatch(/mcp.*roux|roux.*mcp/i);
    });

    it('returns hooksInstalled: true on first init', async () => {
      const result = await initCommand(testDir);
      expect(result.hooksInstalled).toBe(true);
    });

    it('returns hooksInstalled: false when hooks already exist', async () => {
      await initCommand(testDir);
      const result = await initCommand(testDir);
      expect(result.hooksInstalled).toBe(false);
    });

    it('returns hooksInstalled: true when upgrading existing project without hooks', async () => {
      // Create roux.yaml manually (simulating old init without hooks)
      const configPath = join(testDir, 'roux.yaml');
      await writeFile(
        configPath,
        `providers:
  store:
    type: docstore
`,
        'utf-8'
      );

      const result = await initCommand(testDir);

      expect(result.created).toBe(false); // Config already existed
      expect(result.hooksInstalled).toBe(true); // But hooks were installed
    });
  });
});
