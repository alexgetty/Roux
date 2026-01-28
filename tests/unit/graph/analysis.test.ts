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
  });
});
