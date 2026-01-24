import type { Node, NodeWithContext } from '../types/node.js';
import type {
  GraphCore,
  SearchOptions,
} from '../types/graphcore.js';
import type {
  StoreProvider,
  EmbeddingProvider,
  Metric,
  TagMode,
  NeighborOptions,
} from '../types/provider.js';
import type { RouxConfig } from '../types/config.js';
import { DocStore } from '../providers/docstore/index.js';
import { TransformersEmbeddingProvider } from '../providers/embedding/transformers.js';

export class GraphCoreImpl implements GraphCore {
  private store: StoreProvider | null = null;
  private embedding: EmbeddingProvider | null = null;

  registerStore(provider: StoreProvider): void {
    this.store = provider;
  }

  registerEmbedding(provider: EmbeddingProvider): void {
    this.embedding = provider;
  }

  private requireStore(): StoreProvider {
    if (!this.store) {
      throw new Error('StoreProvider not registered');
    }
    return this.store;
  }

  private requireEmbedding(): EmbeddingProvider {
    if (!this.embedding) {
      throw new Error('EmbeddingProvider not registered');
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

    if (!partial.id) {
      throw new Error('Node id is required');
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

  async updateNode(id: string, updates: Partial<Node>): Promise<Node> {
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
    } catch {
      return false;
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
    const results = await store.searchByTags(tags, mode);
    if (limit !== undefined) {
      return results.slice(0, limit);
    }
    return results;
  }

  async getRandomNode(tags?: string[]): Promise<Node | null> {
    const store = this.requireStore();
    return store.getRandomNode(tags);
  }

  static fromConfig(config: RouxConfig): GraphCoreImpl {
    if (!config.providers?.store) {
      throw new Error('StoreProvider configuration is required');
    }

    const core = new GraphCoreImpl();

    // Create store based on config
    if (config.providers.store.type === 'docstore') {
      const sourcePath = config.source?.path ?? '.';
      const cachePath = config.cache?.path ?? '.roux';
      const store = new DocStore(sourcePath, cachePath);
      core.registerStore(store);
    }

    // Create embedding provider (defaults to local transformers)
    const embeddingConfig = config.providers.embedding;
    if (!embeddingConfig || embeddingConfig.type === 'local') {
      const model = embeddingConfig?.model;
      const embedding = new TransformersEmbeddingProvider(model);
      core.registerEmbedding(embedding);
    }
    // TODO: Ollama and OpenAI providers for post-MVP

    return core;
  }
}
