import type { Node } from './node.js';
import type { Direction, NeighborOptions } from './edge.js';

export type Metric = 'in_degree' | 'out_degree';

// Batch operation types
export interface ListFilter {
  /** Filter by tag (case-insensitive) */
  tag?: string;
  /** Filter by path prefix (startsWith) */
  path?: string;
}

export interface ListOptions {
  /** Default 100, max 1000 */
  limit?: number;
  /** Default 0 */
  offset?: number;
}

export interface NodeSummary {
  id: string;
  title: string;
}

export interface ListNodesResult {
  nodes: NodeSummary[];
  /** Total matching nodes (before limit/offset applied) */
  total: number;
}

export type ResolveStrategy = 'exact' | 'fuzzy' | 'semantic';

export interface ResolveOptions {
  /** Filter candidates by tag */
  tag?: string;
  /** Filter candidates by path prefix */
  path?: string;
  /** 0-1, default 0.7, ignored for 'exact' */
  threshold?: number;
  /** Default 'fuzzy' */
  strategy?: ResolveStrategy;
}

export interface ResolveResult {
  /** Original input */
  query: string;
  /** Matched node ID or null */
  match: string | null;
  /** 0-1, 0 if no match */
  score: number;
}

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
export interface Store {
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
  searchByTags(tags: string[], mode: TagMode, limit?: number): Promise<Node[]>;

  // Discovery
  getRandomNode(tags?: string[]): Promise<Node | null>;

  // Link resolution (for MCP response formatting)
  resolveTitles(ids: string[]): Promise<Map<string, string>>;

  // Batch operations
  listNodes(filter: ListFilter, options?: ListOptions): Promise<ListNodesResult>;
  resolveNodes(names: string[], options?: ResolveOptions): Promise<ResolveResult[]>;
  nodesExist(ids: string[]): Promise<Map<string, boolean>>;
}

/** Stateless vector generation. Storage handled by Store. */
export interface Embedding {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  /** For storage allocation */
  dimensions(): number;
  modelId(): string;
}

/** Pluggable vector storage and similarity search. */
export interface VectorIndex {
  store(id: string, vector: number[], model: string): Promise<void>;
  search(vector: number[], limit: number): Promise<VectorSearchResult[]>;
  delete(id: string): Promise<void>;
  getModel(id: string): Promise<string | null>;
  hasEmbedding(id: string): boolean;
}

export function isVectorIndex(value: unknown): value is VectorIndex {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.store === 'function' &&
    typeof obj.search === 'function' &&
    typeof obj.delete === 'function' &&
    typeof obj.getModel === 'function' &&
    typeof obj.hasEmbedding === 'function'
  );
}

// Re-export for convenience
export type { Direction, NeighborOptions };
