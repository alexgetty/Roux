import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

export interface InitResult {
  created: boolean;
  configPath: string;
  hooksInstalled: boolean;
}

interface McpServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  type?: string;
  url?: string;
}

interface McpConfig {
  mcpServers?: Record<string, McpServerConfig>;
}

interface ClaudeHook {
  type: string;
  command: string;
}

interface ClaudeHookEntry {
  matcher: string;
  hooks: ClaudeHook[];
}

interface ClaudeSettings {
  hooks?: {
    PreToolUse?: ClaudeHookEntry[];
    PostToolUse?: ClaudeHookEntry[];
    [key: string]: ClaudeHookEntry[] | undefined;
  };
  [key: string]: unknown;
}

const DEFAULT_CONFIG = `providers:
  store:
    type: docstore
`;

const ROUX_MCP_CONFIG: McpServerConfig = {
  command: 'npx',
  args: ['roux', 'serve', '.'],
  env: {},
};

/** Marker to identify roux's hook for idempotent updates */
export const HOOK_MARKER = 'roux-enforce-mcp';

/** Hook command that rejects direct file operations on .md files */
const ENFORCE_MCP_HOOK_COMMAND = `node -e "/* ${HOOK_MARKER} */ const d=JSON.parse(require('fs').readFileSync(0,'utf8'));const p=d.tool_input?.file_path||'';if(p.endsWith('.md')){console.error('Use mcp__roux__* tools for markdown files instead of Read/Edit/Write');process.exit(2)}"`;

const ROUX_HOOK_ENTRY: ClaudeHookEntry = {
  matcher: 'Read|Edit|Write',
  hooks: [{ type: 'command', command: ENFORCE_MCP_HOOK_COMMAND }],
};

export async function initCommand(directory: string): Promise<InitResult> {
  const configPath = join(directory, 'roux.yaml');
  const rouxDir = join(directory, '.roux');

  // Check if already initialized
  let configExists = false;
  try {
    await access(configPath);
    configExists = true;
  } catch {
    // File doesn't exist
  }

  // Create .roux directory regardless
  await mkdir(rouxDir, { recursive: true });

  // Create/update MCP config
  await updateMcpConfig(directory);

  // Determine store type and update Claude hooks if docstore
  const storeType = await getStoreType(directory, configExists);
  let hooksInstalled = false;
  if (storeType === 'docstore') {
    hooksInstalled = await updateClaudeSettings(directory);
  }

  if (configExists) {
    return { created: false, configPath, hooksInstalled };
  }

  // Create roux.yaml with minimal defaults
  await writeFile(configPath, DEFAULT_CONFIG, 'utf-8');
  return { created: true, configPath, hooksInstalled };
}

async function updateMcpConfig(directory: string): Promise<void> {
  const mcpPath = join(directory, '.mcp.json');

  let config: McpConfig = {};

  // Try to read existing config
  try {
    const content = await readFile(mcpPath, 'utf-8');
    config = JSON.parse(content) as McpConfig;
  } catch {
    // File doesn't exist or invalid JSON — start fresh
  }

  // Ensure mcpServers object exists
  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  // Add/update roux entry
  config.mcpServers.roux = ROUX_MCP_CONFIG;

  // Write back
  await writeFile(mcpPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

async function getStoreType(
  directory: string,
  configExists: boolean
): Promise<string> {
  if (!configExists) {
    return 'docstore'; // Default
  }

  try {
    const configPath = join(directory, 'roux.yaml');
    const content = await readFile(configPath, 'utf-8');
    // Simple YAML parsing for store type
    const typeMatch = content.match(/store:\s*\n\s*type:\s*(\w+)/);
    if (typeMatch?.[1]) {
      return typeMatch[1];
    }
  } catch {
    // Can't read config, assume default
  }

  return 'docstore';
}

/** Returns true if hooks were installed, false if skipped */
async function updateClaudeSettings(directory: string): Promise<boolean> {
  const claudeDir = join(directory, '.claude');
  const settingsPath = join(claudeDir, 'settings.json');

  // Ensure .claude directory exists
  await mkdir(claudeDir, { recursive: true });

  let config: ClaudeSettings = {};
  let existingContent: string | null = null;

  // Try to read existing settings
  try {
    existingContent = await readFile(settingsPath, 'utf-8');
    config = JSON.parse(existingContent) as ClaudeSettings;
  } catch (err) {
    if (existingContent !== null) {
      // File exists but is malformed JSON — don't touch it
      return false;
    }
    // File doesn't exist — start fresh
  }

  // Ensure hooks.PreToolUse array exists
  if (!config.hooks) {
    config.hooks = {};
  }
  if (!config.hooks.PreToolUse) {
    config.hooks.PreToolUse = [];
  }

  // Check if our hook already exists
  const hasRouxHook = config.hooks.PreToolUse.some((entry) =>
    entry.hooks?.some((h) => h.command?.includes(HOOK_MARKER))
  );

  if (hasRouxHook) {
    return false; // Already installed, don't duplicate
  }

  // Add our hook
  config.hooks.PreToolUse.push(ROUX_HOOK_ENTRY);

  // Write back
  await writeFile(settingsPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  return true;
}
