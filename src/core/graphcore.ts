import type { Node, NodeUpdates, NodeWithContext } from '../types/node.js';
import type {
  GraphCore,
  SearchOptions,
} from '../types/graphcore.js';
import type {
  Store,
  Embedding,
  Metric,
  TagMode,
  NeighborOptions,
  ListFilter,
  ListOptions,
  ListNodesResult,
  ResolveOptions,
  ResolveResult,
} from '../types/provider.js';
import {
  isStoreProvider,
  isEmbeddingProvider,
} from '../types/provider.js';
import type { RouxConfig } from '../types/config.js';
import { DocStore } from '../providers/docstore/index.js';
import { TransformersEmbedding } from '../providers/embedding/transformers.js';
import { cosineSimilarity } from '../utils/math.js';

export class GraphCoreImpl implements GraphCore {
  private store: Store | null = null;
  private embedding: Embedding | null = null;

  async registerStore(provider: Store): Promise<void> {
    if (!provider) {
      throw new Error('Store provider is required');
    }
    if (!isStoreProvider(provider)) {
      throw new Error('Invalid Store provider: missing required methods or id');
    }

    // Unregister previous provider if exists
    if (this.store?.onUnregister) {
      try {
        await this.store.onUnregister();
      } catch (err) {
        console.warn('Error during store onUnregister:', err);
      }
    }

    // Set new provider (before calling onRegister so it can use the store)
    this.store = provider;

    // Call lifecycle hook if exists
    if (provider.onRegister) {
      try {
        await provider.onRegister();
      } catch (err) {
        // Rollback on failure
        this.store = null;
        throw err;
      }
    }
  }

  async registerEmbedding(provider: Embedding): Promise<void> {
    if (!provider) {
      throw new Error('Embedding provider is required');
    }
    if (!isEmbeddingProvider(provider)) {
      throw new Error('Invalid Embedding provider: missing required methods or id');
    }

    // Unregister previous provider if exists
    if (this.embedding?.onUnregister) {
      try {
        await this.embedding.onUnregister();
      } catch (err) {
        console.warn('Error during embedding onUnregister:', err);
      }
    }

    // Set new provider
    this.embedding = provider;

    // Call lifecycle hook if exists
    if (provider.onRegister) {
      try {
        await provider.onRegister();
      } catch (err) {
        // Rollback on failure
        this.embedding = null;
        throw err;
      }
    }
  }

  async destroy(): Promise<void> {
    // Unregister in reverse order of typical registration
    if (this.embedding?.onUnregister) {
      try {
        await this.embedding.onUnregister();
      } catch (err) {
        console.warn('Error during embedding onUnregister in destroy:', err);
      }
    }
    if (this.store?.onUnregister) {
      try {
        await this.store.onUnregister();
      } catch (err) {
        console.warn('Error during store onUnregister in destroy:', err);
      }
    }

    // Clear references
    this.embedding = null;
    this.store = null;
  }

  private requireStore(): Store {
    if (!this.store) {
      throw new Error('Store not registered');
    }
    return this.store;
  }

  private requireEmbedding(): Embedding {
    if (!this.embedding) {
      throw new Error('Embedding not registered');
    }
    return this.embedding;
  }

  async search(query: string, options?: SearchOptions): Promise<Node[]> {
    const store = this.requireStore();
    const embedding = this.requireEmbedding();

    const limit = options?.limit ?? 10;
    const vector = await embedding.embed(query);
    const results = await store.searchByVector(vector, limit);

    // Results are already sorted by distance ascending
    const ids = results.map((r) => r.id);
    return store.getNodes(ids);
  }

  async getNode(id: string, depth?: number): Promise<NodeWithContext | null> {
    const store = this.requireStore();
    const node = await store.getNode(id);

    if (!node) {
      return null;
    }

    if (!depth || depth === 0) {
      return node;
    }

    // Fetch neighbors for context
    const [incomingNeighbors, outgoingNeighbors] = await Promise.all([
      store.getNeighbors(id, { direction: 'in' }),
      store.getNeighbors(id, { direction: 'out' }),
    ]);

    // Deduplicate neighbors (same node could be both incoming and outgoing)
    const neighborMap = new Map<string, Node>();
    for (const n of [...incomingNeighbors, ...outgoingNeighbors]) {
      neighborMap.set(n.id, n);
    }

    const result: NodeWithContext = {
      ...node,
      neighbors: Array.from(neighborMap.values()),
      incomingCount: incomingNeighbors.length,
      outgoingCount: outgoingNeighbors.length,
    };

    return result;
  }

  async createNode(partial: Partial<Node>): Promise<Node> {
    const store = this.requireStore();

    if (!partial.id || partial.id.trim() === '') {
      throw new Error('Node id is required and cannot be empty');
    }
    if (!partial.title) {
      throw new Error('Node title is required');
    }

    const node: Node = {
      id: partial.id,
      title: partial.title,
      content: partial.content ?? '',
      tags: partial.tags ?? [],
      outgoingLinks: partial.outgoingLinks ?? [],
      properties: partial.properties ?? {},
      ...(partial.sourceRef && { sourceRef: partial.sourceRef }),
    };

    await store.createNode(node);
    return (await store.getNode(node.id)) ?? node;
  }

  async updateNode(id: string, updates: NodeUpdates): Promise<Node> {
    const store = this.requireStore();
    await store.updateNode(id, updates);
    const updated = await store.getNode(id);
    if (!updated) {
      throw new Error(`Node not found after update: ${id}`);
    }
    return updated;
  }

  async deleteNode(id: string): Promise<boolean> {
    const store = this.requireStore();
    try {
      await store.deleteNode(id);
      return true;
    } catch (err) {
      // Only swallow "not found" errors - propagate everything else
      if (err instanceof Error && /not found/i.test(err.message)) {
        return false;
      }
      throw err;
    }
  }

  async getNeighbors(id: string, options: NeighborOptions): Promise<Node[]> {
    const store = this.requireStore();
    return store.getNeighbors(id, options);
  }

  async findPath(source: string, target: string): Promise<string[] | null> {
    const store = this.requireStore();
    return store.findPath(source, target);
  }

  async getHubs(
    metric: Metric,
    limit: number
  ): Promise<Array<[string, number]>> {
    const store = this.requireStore();
    return store.getHubs(metric, limit);
  }

  async searchByTags(
    tags: string[],
    mode: TagMode,
    limit?: number
  ): Promise<Node[]> {
    const store = this.requireStore();
    return store.searchByTags(tags, mode, limit);
  }

  async getRandomNode(tags?: string[]): Promise<Node | null> {
    const store = this.requireStore();
    return store.getRandomNode(tags);
  }

  async listNodes(
    filter: ListFilter,
    options?: ListOptions
  ): Promise<ListNodesResult> {
    return this.requireStore().listNodes(filter, options);
  }

  async resolveNodes(
    names: string[],
    options?: ResolveOptions
  ): Promise<ResolveResult[]> {
    const store = this.requireStore();
    const strategy = options?.strategy ?? 'fuzzy';

    // Semantic strategy requires embedding provider
    if (strategy === 'semantic') {
      if (!this.embedding) {
        throw new Error('Semantic resolution requires Embedding');
      }

      // Build filter without undefined values
      const filter: ListFilter = {};
      if (options?.tag) filter.tag = options.tag;
      if (options?.path) filter.path = options.path;

      // Get candidates from store with filters
      const { nodes: candidates } = await store.listNodes(filter, { limit: 1000 });

      if (candidates.length === 0 || names.length === 0) {
        return names.map((query) => ({ query, match: null, score: 0 }));
      }

      const threshold = options?.threshold ?? 0.7;

      // Embed all queries in batch
      const queryVectors = await this.embedding.embedBatch(names);

      // Embed all candidate titles in batch
      const candidateTitles = candidates.map((c) => c.title);
      const candidateVectors = await this.embedding.embedBatch(candidateTitles);

      // Validate dimensions match
      if (queryVectors.length > 0 && candidateVectors.length > 0) {
        const queryDim = queryVectors[0]!.length;
        const candidateDim = candidateVectors[0]!.length;
        if (queryDim !== candidateDim) {
          throw new Error(
            `Embedding dimension mismatch: query=${queryDim}, candidate=${candidateDim}`
          );
        }
      }

      // For each query, find best matching candidate by cosine similarity
      return names.map((query, qIdx): ResolveResult => {
        const queryVector = queryVectors[qIdx]!;
        let bestScore = 0;
        let bestMatch: string | null = null;

        for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
          const similarity = cosineSimilarity(queryVector, candidateVectors[cIdx]!);
          if (similarity > bestScore) {
            bestScore = similarity;
            bestMatch = candidates[cIdx]!.id;
          }
        }

        if (bestScore >= threshold) {
          return { query, match: bestMatch, score: bestScore };
        }
        return { query, match: null, score: 0 };
      });
    }

    // Exact and fuzzy delegate to store
    return store.resolveNodes(names, options);
  }

  static async fromConfig(config: RouxConfig): Promise<GraphCoreImpl> {
    if (!config.providers?.store) {
      throw new Error('Store configuration is required');
    }

    const core = new GraphCoreImpl();

    try {
      // Create store based on config
      if (config.providers.store.type === 'docstore') {
        const sourcePath = config.source?.path ?? '.';
        const cachePath = config.cache?.path ?? '.roux';
        const store = new DocStore({ sourceRoot: sourcePath, cacheDir: cachePath });
        await core.registerStore(store);
      } else {
        throw new Error(
          `Unsupported store provider type: ${config.providers.store.type}. Supported: docstore`
        );
      }

      // Create embedding provider (defaults to local transformers)
      const embeddingConfig = config.providers.embedding;
      if (!embeddingConfig || embeddingConfig.type === 'local') {
        const model = embeddingConfig?.model;
        const embedding = new TransformersEmbedding(model ? { model } : {});
        await core.registerEmbedding(embedding);
      } else {
        throw new Error(
          `Unsupported embedding provider type: ${embeddingConfig.type}. Supported: local`
        );
      }

      return core;
    } catch (err) {
      // Clean up any registered providers on failure
      await core.destroy();
      throw err;
    }
  }
}
