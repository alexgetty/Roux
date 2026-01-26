import type { DirectedGraph } from 'graphology';
import { bidirectional } from 'graphology-shortest-path';
import type {
  NeighborOptions,
  Metric,
  CentralityMetrics,
} from '../types/provider.js';

/**
 * Get neighbor IDs based on direction.
 * Returns empty array if node doesn't exist.
 */
export function getNeighborIds(
  graph: DirectedGraph,
  id: string,
  options: NeighborOptions
): string[] {
  if (!graph.hasNode(id)) {
    return [];
  }

  let neighbors: string[];

  switch (options.direction) {
    case 'in':
      neighbors = graph.inNeighbors(id);
      break;
    case 'out':
      neighbors = graph.outNeighbors(id);
      break;
    case 'both':
      neighbors = graph.neighbors(id);
      break;
  }

  if (options.limit !== undefined) {
    if (options.limit <= 0) {
      return [];
    }
    if (options.limit < neighbors.length) {
      return neighbors.slice(0, options.limit);
    }
  }

  return neighbors;
}

/**
 * Find shortest path between two nodes.
 * Returns array of node IDs or null if no path exists.
 */
export function findPath(
  graph: DirectedGraph,
  source: string,
  target: string
): string[] | null {
  if (!graph.hasNode(source) || !graph.hasNode(target)) {
    return null;
  }

  if (source === target) {
    return [source];
  }

  const path = bidirectional(graph, source, target);
  return path;
}

/**
 * Get top nodes by centrality metric.
 * Returns array of [id, score] tuples sorted descending.
 */
export function getHubs(
  graph: DirectedGraph,
  metric: Metric,
  limit: number
): Array<[string, number]> {
  if (limit <= 0) {
    return [];
  }

  const scores: Array<[string, number]> = [];

  graph.forEachNode((id) => {
    let score: number;
    switch (metric) {
      case 'in_degree':
        score = graph.inDegree(id);
        break;
      case 'out_degree':
        score = graph.outDegree(id);
        break;
    }
    scores.push([id, score]);
  });

  scores.sort((a, b) => b[1] - a[1]);
  return scores.slice(0, limit);
}

/**
 * Compute centrality metrics for all nodes.
 * For MVP, computes in_degree and out_degree only.
 */
export function computeCentrality(
  graph: DirectedGraph
): Map<string, CentralityMetrics> {
  const result = new Map<string, CentralityMetrics>();

  graph.forEachNode((id) => {
    result.set(id, {
      inDegree: graph.inDegree(id),
      outDegree: graph.outDegree(id),
    });
  });

  return result;
}
