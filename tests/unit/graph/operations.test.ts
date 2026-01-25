import { describe, it, expect, beforeEach } from 'vitest';
import { DirectedGraph } from 'graphology';
import {
  getNeighborIds,
  findPath,
  getHubs,
  computeCentrality,
} from '../../../src/graph/operations.js';

describe('graph operations', () => {
  let graph: DirectedGraph;

  /**
   * Test graph structure:
   *   a -> b -> c
   *   |    |
   *   v    v
   *   d -> e
   *
   * In-degrees: a=0, b=1, c=1, d=1, e=2
   * Out-degrees: a=2, b=2, c=0, d=1, e=0
   */
  beforeEach(() => {
    graph = new DirectedGraph();
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
  });

  describe('getNeighborIds', () => {
    it('returns outgoing neighbors for direction "out"', () => {
      const result = getNeighborIds(graph, 'a', { direction: 'out' });
      expect(result.sort()).toEqual(['b', 'd']);
    });

    it('returns incoming neighbors for direction "in"', () => {
      const result = getNeighborIds(graph, 'e', { direction: 'in' });
      expect(result.sort()).toEqual(['b', 'd']);
    });

    it('returns both directions for direction "both"', () => {
      const result = getNeighborIds(graph, 'b', { direction: 'both' });
      expect(result.sort()).toEqual(['a', 'c', 'e']);
    });

    it('returns empty array for node with no neighbors in direction', () => {
      const result = getNeighborIds(graph, 'c', { direction: 'out' });
      expect(result).toEqual([]);
    });

    it('returns empty array for non-existent node', () => {
      const result = getNeighborIds(graph, 'nonexistent', { direction: 'out' });
      expect(result).toEqual([]);
    });

    it('respects limit option', () => {
      const result = getNeighborIds(graph, 'a', { direction: 'out', limit: 1 });
      expect(result).toHaveLength(1);
      // Verify returned neighbor is actually a valid neighbor
      expect(['b', 'd']).toContain(result[0]);
    });

    it('returns empty array for limit: 0', () => {
      const result = getNeighborIds(graph, 'a', { direction: 'out', limit: 0 });
      expect(result).toEqual([]);
    });

    it('returns all neighbors when limit is explicitly undefined', () => {
      const result = getNeighborIds(graph, 'a', {
        direction: 'out',
        limit: undefined,
      });
      expect(result.sort()).toEqual(['b', 'd']);
    });

    it('returns empty array for negative limit', () => {
      const result = getNeighborIds(graph, 'a', { direction: 'out', limit: -1 });
      expect(result).toEqual([]);
    });

    it('returns empty array for large negative limit', () => {
      const result = getNeighborIds(graph, 'a', { direction: 'out', limit: -5 });
      expect(result).toEqual([]);
    });
  });

  describe('findPath', () => {
    it('returns path between connected nodes', () => {
      const path = findPath(graph, 'a', 'c');
      expect(path).toEqual(['a', 'b', 'c']);
    });

    it('returns path for adjacent nodes', () => {
      const path = findPath(graph, 'a', 'b');
      expect(path).toEqual(['a', 'b']);
    });

    it('returns single node path for same source and target', () => {
      const path = findPath(graph, 'a', 'a');
      expect(path).toEqual(['a']);
    });

    it('returns null when no path exists', () => {
      const path = findPath(graph, 'c', 'a');
      expect(path).toBeNull();
    });

    it('returns null for non-existent source', () => {
      const path = findPath(graph, 'nonexistent', 'a');
      expect(path).toBeNull();
    });

    it('returns null for non-existent target', () => {
      const path = findPath(graph, 'a', 'nonexistent');
      expect(path).toBeNull();
    });

    it('finds shortest path when multiple exist', () => {
      // a -> e via d (2 hops) or via b (2 hops)
      const path = findPath(graph, 'a', 'e');
      expect(path).toHaveLength(3);
      expect(path?.[0]).toBe('a');
      expect(path?.[path.length - 1]).toBe('e');
    });
  });

  describe('getHubs', () => {
    it('returns top nodes by in_degree', () => {
      const hubs = getHubs(graph, 'in_degree', 3);
      expect(hubs[0]).toEqual(['e', 2]);
      expect(hubs[1][1]).toBe(1); // b, c, or d (all have in_degree 1)
    });

    it('returns top nodes by out_degree', () => {
      const hubs = getHubs(graph, 'out_degree', 2);
      expect(hubs[0]).toEqual(['a', 2]);
      expect(hubs[1]).toEqual(['b', 2]);
    });

    it('returns top nodes by pagerank (falls back to in_degree for MVP)', () => {
      const hubs = getHubs(graph, 'pagerank', 2);
      // PageRank uses in_degree as fallback for MVP
      expect(hubs[0]).toEqual(['e', 2]);
    });

    it('respects limit', () => {
      const hubs = getHubs(graph, 'in_degree', 1);
      expect(hubs).toHaveLength(1);
    });

    it('returns empty array for empty graph', () => {
      const emptyGraph = new DirectedGraph();
      const hubs = getHubs(emptyGraph, 'in_degree', 5);
      expect(hubs).toEqual([]);
    });

    it('returns all nodes when limit exceeds node count', () => {
      const hubs = getHubs(graph, 'in_degree', 100);
      expect(hubs).toHaveLength(5);
    });

    it('returns empty array for limit: 0', () => {
      const hubs = getHubs(graph, 'in_degree', 0);
      expect(hubs).toEqual([]);
    });

    it('returns empty array for negative limit', () => {
      const hubs = getHubs(graph, 'in_degree', -1);
      expect(hubs).toEqual([]);
    });

    it('returns empty array for large negative limit', () => {
      const hubs = getHubs(graph, 'out_degree', -10);
      expect(hubs).toEqual([]);
    });
  });

  describe('computeCentrality', () => {
    it('computes in_degree for all nodes', () => {
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
