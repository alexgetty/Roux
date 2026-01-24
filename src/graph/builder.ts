import { DirectedGraph } from 'graphology';
import type { Node } from '../types/node.js';

/**
 * Build a directed graph from an array of nodes.
 * Edges are derived from each node's outgoingLinks.
 * Links to non-existent nodes are ignored.
 */
export function buildGraph(nodes: Node[]): DirectedGraph {
  const graph = new DirectedGraph();

  // First pass: add all nodes
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    graph.addNode(node.id);
    nodeIds.add(node.id);
  }

  // Second pass: add edges (only to existing nodes)
  for (const node of nodes) {
    const seen = new Set<string>();
    for (const target of node.outgoingLinks) {
      // Skip if target doesn't exist or we've already added this edge
      if (!nodeIds.has(target) || seen.has(target)) {
        continue;
      }
      seen.add(target);
      graph.addDirectedEdge(node.id, target);
    }
  }

  return graph;
}
