import type { DirectedGraph } from 'graphology';
import type { CentralityMetrics } from '../types/provider.js';

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
