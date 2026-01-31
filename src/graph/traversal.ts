import type { DirectedGraph } from 'graphology';
import { bidirectional } from 'graphology-shortest-path';
import type { NeighborOptions, Metric } from '../types/provider.js';
import { MinHeap } from '../utils/heap.js';

/**
 * Get neighbor IDs based on direction.
 * Returns empty array if node doesn't exist.
 * Uses iterator-based traversal for early termination when limit is specified.
 */
export function getNeighborIds(
  graph: DirectedGraph,
  id: string,
  options: NeighborOptions
): string[] {
  if (!graph.hasNode(id)) {
    return [];
  }

  const limit = options.limit;
  if (limit !== undefined && limit <= 0) {
    return [];
  }

  const maxCount = limit ?? Infinity;
  const direction = options.direction;

  // For 'both' direction, use graphology's neighborEntries which deduplicates
  if (direction === 'both') {
    const neighbors: string[] = [];
    for (const entry of graph.neighborEntries(id)) {
      if (neighbors.length >= maxCount) break;
      neighbors.push(entry.neighbor);
    }
    return neighbors;
  }

  // For single direction, iterate directly
  const neighbors: string[] = [];
  const iterator =
    direction === 'in'
      ? graph.inNeighborEntries(id)
      : graph.outNeighborEntries(id);

  for (const entry of iterator) {
    if (neighbors.length >= maxCount) break;
    neighbors.push(entry.neighbor);
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
