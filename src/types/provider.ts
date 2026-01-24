import type { Node } from './node.js';
import type { Direction, NeighborOptions } from './edge.js';

export type Metric = 'pagerank' | 'in_degree' | 'out_degree';

export interface CentralityMetrics {
  inDegree: number;
  outDegree: number;
}

export type TagMode = 'any' | 'all';

export interface VectorSearchResult {
  id: string;
  distance: number;
}

/** Link with resolved title for MCP responses. */
export interface LinkInfo {
  id: string;
  title: string;
}

/** Data persistence and graph operations. Required provider. */
export interface StoreProvider {
  // CRUD
  createNode(node: Node): Promise<void>;
  updateNode(id: string, updates: Partial<Node>): Promise<void>;
  deleteNode(id: string): Promise<void>;
  getNode(id: string): Promise<Node | null>;
  getNodes(ids: string[]): Promise<Node[]>;

  // Graph operations
  getNeighbors(id: string, options: NeighborOptions): Promise<Node[]>;
  findPath(source: string, target: string): Promise<string[] | null>;
  getHubs(metric: Metric, limit: number): Promise<Array<[string, number]>>;

  // Vector storage
  storeEmbedding(id: string, vector: number[], model: string): Promise<void>;
  searchByVector(
    vector: number[],
    limit: number
  ): Promise<VectorSearchResult[]>;

  // Search
  searchByTags(tags: string[], mode: TagMode): Promise<Node[]>;

  // Link resolution (for MCP response formatting)
  resolveTitles(ids: string[]): Promise<Map<string, string>>;
}

/** Stateless vector generation. Storage handled by StoreProvider. */
export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  /** For storage allocation */
  dimensions(): number;
  modelId(): string;
}

// Re-export for convenience
export type { Direction, NeighborOptions };
