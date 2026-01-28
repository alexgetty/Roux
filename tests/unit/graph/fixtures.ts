import { DirectedGraph } from 'graphology';
import type { Node } from '../../../src/types/node.js';

/** Create a test node with optional outgoing links */
export function createTestNode(id: string, links: string[] = []): Node {
  return {
    id,
    title: id,
    content: '',
    tags: [],
    outgoingLinks: links,
    properties: {},
  };
}

/**
 * Create the standard 5-node test graph:
 *
 *   a -> b -> c
 *   |    |
 *   v    v
 *   d -> e
 *
 * In-degrees: a=0, b=1, c=1, d=1, e=2
 * Out-degrees: a=2, b=2, c=0, d=1, e=0
 */
export function createTestGraph(): DirectedGraph {
  const graph = new DirectedGraph();
  graph.addNode('a');
  graph.addNode('b');
  graph.addNode('c');
  graph.addNode('d');
  graph.addNode('e');
  graph.addDirectedEdge('a', 'b');
  graph.addDirectedEdge('a', 'd');
  graph.addDirectedEdge('b', 'c');
  graph.addDirectedEdge('b', 'e');
  graph.addDirectedEdge('d', 'e');
  return graph;
}
