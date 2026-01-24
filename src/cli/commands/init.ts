import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

export interface InitResult {
  created: boolean;
  configPath: string;
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

const DEFAULT_CONFIG = `providers:
  store:
    type: docstore
`;

const ROUX_MCP_CONFIG: McpServerConfig = {
  command: 'roux',
  args: ['serve', '.'],
  env: {},
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

  if (configExists) {
    return { created: false, configPath };
  }

  // Create roux.yaml with minimal defaults
  await writeFile(configPath, DEFAULT_CONFIG, 'utf-8');
  return { created: true, configPath };
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
