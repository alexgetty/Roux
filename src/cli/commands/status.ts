import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { Cache } from '../../providers/docstore/cache.js';
import { SqliteVectorIndex } from '../../providers/vector/sqlite.js';

export interface StatusResult {
  nodeCount: number;
  edgeCount: number;
  embeddingCount: number;
  embeddingCoverage: number;
}

export async function statusCommand(directory: string): Promise<StatusResult> {
  const configPath = join(directory, 'roux.yaml');

  // Check if initialized
  try {
    await access(configPath);
  } catch {
    throw new Error(`Directory not initialized. Run 'roux init' first.`);
  }

  const cacheDir = join(directory, '.roux');
  const cache = new Cache(cacheDir);
  const vectorProvider = new SqliteVectorIndex(cacheDir);

  try {
    const stats = cache.getStats();
    const embeddingCount = vectorProvider.getEmbeddingCount();

    const embeddingCoverage =
      stats.nodeCount === 0 ? 1 : embeddingCount / stats.nodeCount;

    return {
      nodeCount: stats.nodeCount,
      edgeCount: stats.edgeCount,
      embeddingCount,
      embeddingCoverage,
    };
  } finally {
    cache.close();
    vectorProvider.close();
  }
}
