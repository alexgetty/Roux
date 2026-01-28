import type { Node } from '../../types/node.js';
import type {
  Metric,
  CentralityMetrics,
  VectorIndex,
  VectorSearchResult,
  TagMode,
  ListFilter,
  ListOptions,
  ListNodesResult,
  ResolveOptions,
  ResolveResult,
} from '../../types/provider.js';
import type { NeighborOptions } from '../../types/edge.js';
import { GraphManager } from '../../graph/manager.js';
import { resolveNames } from './resolve.js';

export interface StoreProviderOptions {
  vectorIndex?: VectorIndex;
}

export abstract class StoreProvider {
  protected readonly graphManager = new GraphManager();
  protected readonly vectorIndex: VectorIndex | null;

  constructor(options?: StoreProviderOptions) {
    this.vectorIndex = options?.vectorIndex ?? null;
  }

  // ── Abstract methods (subclasses MUST implement) ───────────

  protected abstract loadAllNodes(): Promise<Node[]>;
  protected abstract getNodesByIds(ids: string[]): Promise<Node[]>;
  abstract createNode(node: Node): Promise<void>;
  abstract updateNode(id: string, updates: Partial<Node>): Promise<void>;
  abstract deleteNode(id: string): Promise<void>;
  abstract getNode(id: string): Promise<Node | null>;
  abstract getNodes(ids: string[]): Promise<Node[]>;
  abstract close(): void;

  // ── Graph operations (delegate to GraphManager) ────────────

  async getNeighbors(id: string, options: NeighborOptions): Promise<Node[]> {
    if (!this.graphManager.isReady()) return [];
    const neighborIds = this.graphManager.getNeighborIds(id, options);
    return this.getNodesByIds(neighborIds);
  }

  async findPath(source: string, target: string): Promise<string[] | null> {
    if (!this.graphManager.isReady()) return null;
    return this.graphManager.findPath(source, target);
  }

  async getHubs(metric: Metric, limit: number): Promise<Array<[string, number]>> {
    if (!this.graphManager.isReady()) return [];
    return this.graphManager.getHubs(metric, limit);
  }

  // ── Vector operations (delegate to VectorIndex) ────────────

  async storeEmbedding(id: string, vector: number[], model: string): Promise<void> {
    if (!this.vectorIndex) throw new Error('No VectorIndex configured');
    return this.vectorIndex.store(id, vector, model);
  }

  async searchByVector(vector: number[], limit: number): Promise<VectorSearchResult[]> {
    if (!this.vectorIndex) throw new Error('No VectorIndex configured');
    return this.vectorIndex.search(vector, limit);
  }

  // ── Discovery ──────────────────────────────────────────────

  async getRandomNode(tags?: string[]): Promise<Node | null> {
    let candidates: Node[];
    if (tags && tags.length > 0) {
      candidates = await this.searchByTags(tags, 'any');
    } else {
      candidates = await this.loadAllNodes();
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)]!;
  }

  // ── Default implementations (overridable) ──────────────────

  async searchByTags(tags: string[], mode: TagMode, limit?: number): Promise<Node[]> {
    const allNodes = await this.loadAllNodes();
    const lowerTags = tags.map(t => t.toLowerCase());
    let results = allNodes.filter(node => {
      const nodeTags = node.tags.map(t => t.toLowerCase());
      return mode === 'any'
        ? lowerTags.some(t => nodeTags.includes(t))
        : lowerTags.every(t => nodeTags.includes(t));
    });
    if (limit !== undefined) results = results.slice(0, limit);
    return results;
  }

  async listNodes(filter: ListFilter, options?: ListOptions): Promise<ListNodesResult> {
    let nodes = await this.loadAllNodes();
    if (filter.tag) {
      const lower = filter.tag.toLowerCase();
      nodes = nodes.filter(n => n.tags.some(t => t.toLowerCase() === lower));
    }
    if (filter.path) {
      const lowerPath = filter.path.toLowerCase();
      nodes = nodes.filter(n => n.id.startsWith(lowerPath));
    }
    const total = nodes.length;
    const offset = options?.offset ?? 0;
    const limit = Math.min(options?.limit ?? 100, 1000);
    const sliced = nodes.slice(offset, offset + limit);
    return {
      nodes: sliced.map(n => ({ id: n.id, title: n.title })),
      total,
    };
  }

  async nodesExist(ids: string[]): Promise<Map<string, boolean>> {
    if (ids.length === 0) return new Map();
    const found = await this.getNodesByIds(ids);
    const foundIds = new Set(found.map(n => n.id));
    const result = new Map<string, boolean>();
    for (const id of ids) {
      result.set(id, foundIds.has(id));
    }
    return result;
  }

  async resolveTitles(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const nodes = await this.getNodesByIds(ids);
    const result = new Map<string, string>();
    for (const node of nodes) {
      result.set(node.id, node.title);
    }
    return result;
  }

  async resolveNodes(names: string[], options?: ResolveOptions): Promise<ResolveResult[]> {
    const strategy = options?.strategy ?? 'fuzzy';
    if (strategy === 'semantic') {
      return names.map(query => ({ query, match: null, score: 0 }));
    }
    const allNodes = await this.loadAllNodes();
    let candidates = allNodes.map(n => ({ id: n.id, title: n.title }));
    if (options?.tag) {
      const lower = options.tag.toLowerCase();
      const filtered = allNodes.filter(n => n.tags.some(t => t.toLowerCase() === lower));
      candidates = filtered.map(n => ({ id: n.id, title: n.title }));
    }
    if (options?.path) {
      const lowerPath = options.path.toLowerCase();
      candidates = candidates.filter(c => c.id.startsWith(lowerPath));
    }
    return resolveNames(names, candidates, {
      strategy,
      threshold: options?.threshold ?? 0.7,
    });
  }

  // ── Graph lifecycle ────────────────────────────────────────

  protected async syncGraph(): Promise<void> {
    const nodes = await this.loadAllNodes();
    const centrality = this.graphManager.build(nodes);
    this.onCentralityComputed(centrality);
  }

  protected onCentralityComputed(_centrality: Map<string, CentralityMetrics>): void {
    // Default no-op. Subclasses override to persist centrality.
  }
}
