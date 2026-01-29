import type { DirectedGraph } from 'graphology';
import { bidirectional } from 'graphology-shortest-path';
import type { NeighborOptions, Metric } from '../types/provider.js';
import { MinHeap } from '../utils/heap.js';

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
 * Uses min-heap for O(n log k) complexity instead of O(n log n).
 */
export function getHubs(
  graph: DirectedGraph,
  metric: Metric,
  limit: number
): Array<[string, number]> {
  if (limit <= 0) {
    return [];
  }

  const heap = new MinHeap<[string, number]>((a, b) => a[1] - b[1]);

  graph.forEachNode((id) => {
    const score = metric === 'in_degree' ? graph.inDegree(id) : graph.outDegree(id);

    if (heap.size() < limit) {
      heap.push([id, score]);
    } else if (score > heap.peek()![1]) {
      heap.pop();
      heap.push([id, score]);
    }
  });

  // Sort by score descending, then by node ID ascending for deterministic tie-breaking
  return heap.toArray().sort((a, b) => {
    const scoreDiff = b[1] - a[1];
    if (scoreDiff !== 0) return scoreDiff;
    return a[0].localeCompare(b[0]);
  });
}
