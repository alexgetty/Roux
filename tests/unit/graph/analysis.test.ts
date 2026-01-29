import { describe, it, expect, beforeEach } from 'vitest';
import { DirectedGraph } from 'graphology';
import { computeCentrality } from '../../../src/graph/analysis.js';
import { createTestGraph } from './fixtures.js';

describe('graph analysis', () => {
  let graph: DirectedGraph;

  // Uses standard 5-node test graph from fixtures.ts
  beforeEach(() => {
    graph = createTestGraph();
  });

  describe('computeCentrality', () => {
    it('computes in_degree and out_degree for all nodes', () => {
      const centrality = computeCentrality(graph);

      expect(centrality.get('a')).toEqual({ inDegree: 0, outDegree: 2 });
      expect(centrality.get('b')).toEqual({ inDegree: 1, outDegree: 2 });
      expect(centrality.get('c')).toEqual({ inDegree: 1, outDegree: 0 });
      expect(centrality.get('d')).toEqual({ inDegree: 1, outDegree: 1 });
      expect(centrality.get('e')).toEqual({ inDegree: 2, outDegree: 0 });
    });

    it('returns empty map for empty graph', () => {
      const emptyGraph = new DirectedGraph();
      const centrality = computeCentrality(emptyGraph);
      expect(centrality.size).toBe(0);
    });

    it('computes degree for single-node graph', () => {
      const singleNodeGraph = new DirectedGraph();
      singleNodeGraph.addNode('lonely');

      const centrality = computeCentrality(singleNodeGraph);

      expect(centrality.size).toBe(1);
      expect(centrality.get('lonely')).toEqual({ inDegree: 0, outDegree: 0 });
    });

    it('counts self-loop as both in-degree and out-degree', () => {
      const selfLoopGraph = new DirectedGraph();
      selfLoopGraph.addNode('narcissist');
      selfLoopGraph.addDirectedEdge('narcissist', 'narcissist');

      const centrality = computeCentrality(selfLoopGraph);

      // graphology counts self-loop as +1 to both in and out degree
      expect(centrality.get('narcissist')).toEqual({ inDegree: 1, outDegree: 1 });
    });

    it('handles node with self-loop plus other edges', () => {
      const mixedGraph = new DirectedGraph();
      mixedGraph.addNode('hub');
      mixedGraph.addNode('spoke');
      mixedGraph.addDirectedEdge('hub', 'hub'); // self-loop
      mixedGraph.addDirectedEdge('hub', 'spoke'); // outgoing
      mixedGraph.addDirectedEdge('spoke', 'hub'); // incoming

      const centrality = computeCentrality(mixedGraph);

      // hub: self-loop (1 in, 1 out) + outgoing to spoke (1 out) + incoming from spoke (1 in)
      expect(centrality.get('hub')).toEqual({ inDegree: 2, outDegree: 2 });
      expect(centrality.get('spoke')).toEqual({ inDegree: 1, outDegree: 1 });
    });
  });
});
