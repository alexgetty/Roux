import { DirectedGraph } from 'graphology';
import type { Node } from '../types/node.js';
import type { NeighborOptions, Metric, CentralityMetrics } from '../types/provider.js';
import { buildGraph } from './builder.js';
import { getNeighborIds, findPath, getHubs } from './traversal.js';
import { computeCentrality } from './analysis.js';

export class GraphNotReadyError extends Error {
  constructor() {
    super('Graph not built. Call build() before querying.');
    this.name = 'GraphNotReadyError';
  }
}

export class GraphManager {
  private graph: DirectedGraph | null = null;

  /** Build graph and return centrality metrics. Caller stores as needed. */
  build(nodes: Node[]): Map<string, CentralityMetrics> {
    this.graph = buildGraph(nodes);
    return computeCentrality(this.graph);
  }

  /** Throws GraphNotReadyError if not built. Returns graph for query use. */
  assertReady(): DirectedGraph {
    if (!this.graph) throw new GraphNotReadyError();
    return this.graph;
  }

  isReady(): boolean {
    return this.graph !== null;
  }

  getNeighborIds(id: string, options: NeighborOptions): string[] {
    return getNeighborIds(this.assertReady(), id, options);
  }

  findPath(source: string, target: string): string[] | null {
    return findPath(this.assertReady(), source, target);
  }

  getHubs(metric: Metric, limit: number): Array<[string, number]> {
    return getHubs(this.assertReady(), metric, limit);
  }
}
