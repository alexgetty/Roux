import type { Node, NodeWithContext } from './node.js';
import type {
  Metric,
  StoreProvider,
  EmbeddingProvider,
  TagMode,
  ListFilter,
  ListOptions,
  ListNodesResult,
  ResolveOptions,
  ResolveResult,
} from './provider.js';
import type { NeighborOptions } from './edge.js';

export interface SearchOptions {
  /** Default: 10 */
  limit?: number;
  /** 0-1 */
  threshold?: number;
  tags?: string[];
}

/** Orchestration hub. Zero functionality without providers. */
export interface GraphCore {
  // Provider registration
  registerStore(provider: StoreProvider): void;
  registerEmbedding(provider: EmbeddingProvider): void;

  // Unified operations (delegates to providers)
  search(query: string, options?: SearchOptions): Promise<Node[]>;
  getNode(id: string, depth?: number): Promise<NodeWithContext | null>;
  createNode(node: Partial<Node>): Promise<Node>;
  updateNode(id: string, updates: Partial<Node>): Promise<Node>;
  deleteNode(id: string): Promise<boolean>;

  // Graph operations
  getNeighbors(id: string, options: NeighborOptions): Promise<Node[]>;
  findPath(source: string, target: string): Promise<string[] | null>;
  getHubs(metric: Metric, limit: number): Promise<Array<[string, number]>>;

  // Tag and discovery operations
  searchByTags(tags: string[], mode: TagMode, limit?: number): Promise<Node[]>;
  getRandomNode(tags?: string[]): Promise<Node | null>;

  // Batch operations
  listNodes(filter: ListFilter, options?: ListOptions): Promise<ListNodesResult>;
  resolveNodes(names: string[], options?: ResolveOptions): Promise<ResolveResult[]>;
}
