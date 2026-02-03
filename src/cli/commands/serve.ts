import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { DocStore } from '../../providers/docstore/index.js';
import { TransformersEmbedding } from '../../providers/embedding/transformers.js';
import { GraphCoreImpl } from '../../core/graphcore.js';
import { McpServer, type TransportFactory } from '../../mcp/server.js';
import { DEFAULT_NAMING, type RouxConfig } from '../../types/config.js';

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

  const store = new DocStore({ sourceRoot: resolvedSourcePath, cacheDir: resolvedCachePath });
  const embeddingModel =
    config.providers?.embedding?.type === 'local'
      ? config.providers.embedding.model
      : undefined;
  const embedding = new TransformersEmbedding(
    embeddingModel ? { model: embeddingModel } : {}
  );

  // Create GraphCore and register providers (store.onRegister calls sync)
  const core = new GraphCoreImpl();
  await core.registerStore(store);
  await core.registerEmbedding(embedding);

  // Generate embeddings for nodes without them
  const allNodeIds = await store.getAllNodeIds();
  const total = allNodeIds.length;

  for (let i = 0; i < allNodeIds.length; i++) {
    const id = allNodeIds[i]!;

    if (!hasExistingEmbedding(store, id)) {
      const node = await store.getNode(id);
      if (node) {
        // Ghost nodes (content === null) are embedded by title
        const textToEmbed = node.content ?? node.title;
        const vector = await embedding.embed(textToEmbed);
        await store.storeEmbedding(id, vector, embedding.modelId());
      }
    }

    if (onProgress) {
      onProgress(i + 1, total);
    }
  }

  // Resolve naming conventions
  const naming = { ...DEFAULT_NAMING, ...config.naming };

  // Start MCP server
  const mcpServer = new McpServer({
    core,
    store,
    hasEmbedding: true,
    naming,
  });

  try {
    await mcpServer.start(transportFactory);
  } catch (err) {
    // Clean up providers on MCP server start failure
    await core.destroy();
    throw err;
  }

  // Start file watcher if enabled
  if (watch) {
    try {
      await store.startWatching(async (changedIds) => {
        // Generate embeddings for changed nodes
        for (const id of changedIds) {
          try {
            const node = await store.getNode(id);
            if (node) {
              // Ghost nodes (content === null) are embedded by title
              const textToEmbed = node.content ?? node.title;
              const vector = await embedding.embed(textToEmbed);
              await store.storeEmbedding(id, vector, embedding.modelId());
            }
          } catch (err) {
            // Log warning but continue processing other changed files
            console.warn(
              'Failed to generate embedding for',
              id,
              ':',
              (err as Error).message || 'Unknown error'
            );
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
      await core.destroy();
      await mcpServer.close();
    },
    isWatching: store.isWatching(),
    nodeCount: allNodeIds.length,
  };
}

function hasExistingEmbedding(store: DocStore, id: string): boolean {
  return store.hasEmbedding(id);
}
