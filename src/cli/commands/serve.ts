import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { DocStore } from '../../providers/docstore/index.js';
import { TransformersEmbedding } from '../../providers/embedding/transformers.js';
import { GraphCoreImpl } from '../../core/graphcore.js';
import { McpServer, type TransportFactory } from '../../mcp/server.js';
import type { RouxConfig } from '../../types/config.js';

export interface ServeOptions {
  watch?: boolean;
  transportFactory?: TransportFactory;
  onProgress?: (current: number, total: number) => void;
}

export interface ServeHandle {
  stop: () => Promise<void>;
  isWatching: boolean;
  nodeCount: number;
}

export async function serveCommand(
  directory: string,
  options: ServeOptions = {}
): Promise<ServeHandle> {
  const { watch = true, transportFactory, onProgress } = options;

  const configPath = join(directory, 'roux.yaml');

  // Check if initialized
  try {
    await access(configPath);
  } catch {
    throw new Error(`Directory not initialized. Run 'roux init' first.`);
  }

  // Load config
  const configContent = await readFile(configPath, 'utf-8');
  const config = parseYaml(configContent) as RouxConfig;

  // Create providers
  const sourcePath = config.source?.path ?? '.';
  const resolvedSourcePath = join(directory, sourcePath);
  const cachePath = config.cache?.path ?? '.roux';
  const resolvedCachePath = join(directory, cachePath);

  const store = new DocStore(resolvedSourcePath, resolvedCachePath);
  const embedding = new TransformersEmbedding(
    config.providers?.embedding?.type === 'local'
      ? config.providers.embedding.model
      : undefined
  );

  // Sync cache
  await store.sync();

  // Generate embeddings for nodes without them
  const allNodeIds = await store.getAllNodeIds();
  const total = allNodeIds.length;

  for (let i = 0; i < allNodeIds.length; i++) {
    const id = allNodeIds[i]!;

    if (!hasExistingEmbedding(store, id)) {
      const node = await store.getNode(id);
      if (node && node.content) {
        const vector = await embedding.embed(node.content);
        await store.storeEmbedding(id, vector, embedding.modelId());
      }
    }

    if (onProgress) {
      onProgress(i + 1, total);
    }
  }

  // Create GraphCore
  const core = new GraphCoreImpl();
  core.registerStore(store);
  core.registerEmbedding(embedding);

  // Start MCP server
  const mcpServer = new McpServer({
    core,
    store,
    hasEmbedding: true,
  });

  await mcpServer.start(transportFactory);

  // Start file watcher if enabled
  if (watch) {
    try {
      await store.startWatching(async (changedIds) => {
        // Generate embeddings for changed nodes
        for (const id of changedIds) {
          const node = await store.getNode(id);
          if (node && node.content) {
            const vector = await embedding.embed(node.content);
            await store.storeEmbedding(id, vector, embedding.modelId());
          }
        }
      });
    } catch (err) {
      console.warn(
        'File watching disabled:',
        (err as Error).message || 'Unknown error'
      );
    }
  }

  return {
    stop: async () => {
      store.stopWatching();
      store.close();
      await mcpServer.close();
    },
    isWatching: store.isWatching(),
    nodeCount: allNodeIds.length,
  };
}

function hasExistingEmbedding(store: DocStore, id: string): boolean {
  return store.hasEmbedding(id);
}
