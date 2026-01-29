import type { Node, NodeUpdates } from './node.js';
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
  updateNode(id: string, updates: NodeUpdates): Promise<void>;
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

/**
 * Runtime type guard for Store interface.
 * IMPORTANT: Update this function when Store interface changes.
 * Current method count: 16
 */
export function isStoreProvider(value: unknown): value is Store {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.createNode === 'function' &&
    typeof obj.updateNode === 'function' &&
    typeof obj.deleteNode === 'function' &&
    typeof obj.getNode === 'function' &&
    typeof obj.getNodes === 'function' &&
    typeof obj.getNeighbors === 'function' &&
    typeof obj.findPath === 'function' &&
    typeof obj.getHubs === 'function' &&
    typeof obj.storeEmbedding === 'function' &&
    typeof obj.searchByVector === 'function' &&
    typeof obj.searchByTags === 'function' &&
    typeof obj.getRandomNode === 'function' &&
    typeof obj.resolveTitles === 'function' &&
    typeof obj.listNodes === 'function' &&
    typeof obj.resolveNodes === 'function' &&
    typeof obj.nodesExist === 'function'
  );
}

/**
 * Runtime type guard for Embedding interface.
 * IMPORTANT: Update this function when Embedding interface changes.
 * Current method count: 4
 */
export function isEmbeddingProvider(value: unknown): value is Embedding {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.embed === 'function' &&
    typeof obj.embedBatch === 'function' &&
    typeof obj.dimensions === 'function' &&
    typeof obj.modelId === 'function'
  );
}

// Re-export for convenience
export type { Direction, NeighborOptions };
