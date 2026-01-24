import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

export interface InitResult {
  created: boolean;
  configPath: string;
}

const DEFAULT_CONFIG = `providers:
  store:
    type: docstore
`;

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

  if (configExists) {
    return { created: false, configPath };
  }

  // Create roux.yaml with minimal defaults
  await writeFile(configPath, DEFAULT_CONFIG, 'utf-8');
  return { created: true, configPath };
}
