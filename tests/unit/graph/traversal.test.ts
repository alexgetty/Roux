import { describe, it, expect, beforeEach } from 'vitest';
import { DirectedGraph } from 'graphology';
import {
  getNeighborIds,
  findPath,
  getHubs,
} from '../../../src/graph/traversal.js';
import { createTestGraph } from './fixtures.js';

describe('graph traversal', () => {
  let graph: DirectedGraph;

  // Uses standard 5-node test graph from fixtures.ts
  beforeEach(() => {
    graph = createTestGraph();
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

    it('returns self as neighbor for self-loop (out direction)', () => {
      const selfLoopGraph = new DirectedGraph();
      selfLoopGraph.addNode('loop');
      selfLoopGraph.addDirectedEdge('loop', 'loop');

      const result = getNeighborIds(selfLoopGraph, 'loop', { direction: 'out' });
      expect(result).toEqual(['loop']);
    });

    it('returns self as neighbor for self-loop (in direction)', () => {
      const selfLoopGraph = new DirectedGraph();
      selfLoopGraph.addNode('loop');
      selfLoopGraph.addDirectedEdge('loop', 'loop');

      const result = getNeighborIds(selfLoopGraph, 'loop', { direction: 'in' });
      expect(result).toEqual(['loop']);
    });

    it('returns self once for self-loop (both direction, deduplicated)', () => {
      const selfLoopGraph = new DirectedGraph();
      selfLoopGraph.addNode('loop');
      selfLoopGraph.addDirectedEdge('loop', 'loop');

      // graphology.neighbors() should deduplicate
      const result = getNeighborIds(selfLoopGraph, 'loop', { direction: 'both' });
      expect(result).toEqual(['loop']);
    });

    it('returns empty for isolated node (zero edges)', () => {
      const isolatedGraph = new DirectedGraph();
      isolatedGraph.addNode('island');

      expect(getNeighborIds(isolatedGraph, 'island', { direction: 'out' })).toEqual([]);
      expect(getNeighborIds(isolatedGraph, 'island', { direction: 'in' })).toEqual([]);
      expect(getNeighborIds(isolatedGraph, 'island', { direction: 'both' })).toEqual([]);
    });

    it('deduplicates when both in and out edges to same neighbor', () => {
      // a <-> b (bidirectional)
      const biGraph = new DirectedGraph();
      biGraph.addNode('a');
      biGraph.addNode('b');
      biGraph.addDirectedEdge('a', 'b');
      biGraph.addDirectedEdge('b', 'a');

      const result = getNeighborIds(biGraph, 'a', { direction: 'both' });
      // graphology.neighbors() returns unique neighbors
      expect(result).toEqual(['b']);
    });

    it('early-terminates iteration when limit reached (performance)', () => {
      // Create a hub with 100 outgoing edges
      const hubGraph = new DirectedGraph();
      hubGraph.addNode('hub');
      for (let i = 0; i < 100; i++) {
        hubGraph.addNode(`target-${i}`);
        hubGraph.addDirectedEdge('hub', `target-${i}`);
      }

      // Track how many times the iterator is accessed
      let iterationCount = 0;
      const originalOutNeighbors = hubGraph.outNeighborEntries.bind(hubGraph);
      hubGraph.outNeighborEntries = function* (node: string) {
        for (const entry of originalOutNeighbors(node)) {
          iterationCount++;
          yield entry;
        }
      };

      const result = getNeighborIds(hubGraph, 'hub', { direction: 'out', limit: 5 });

      expect(result).toHaveLength(5);
      // Should iterate limit+1 times at most (one extra to detect termination condition)
      // The key assertion: we don't iterate all 100 edges
      expect(iterationCount).toBeLessThanOrEqual(6);
      expect(iterationCount).toBeGreaterThan(0);
    });

    it('early-terminates for direction "both" when limit reached', () => {
      // Create a node with many neighbors in both directions
      const hubGraph = new DirectedGraph();
      hubGraph.addNode('center');
      for (let i = 0; i < 50; i++) {
        hubGraph.addNode(`in-${i}`);
        hubGraph.addNode(`out-${i}`);
        hubGraph.addDirectedEdge(`in-${i}`, 'center');
        hubGraph.addDirectedEdge('center', `out-${i}`);
      }
      // center has 50 incoming + 50 outgoing = 100 total neighbors

      const result = getNeighborIds(hubGraph, 'center', { direction: 'both', limit: 5 });

      expect(result).toHaveLength(5);
      // Each returned neighbor should be a valid neighbor
      for (const neighbor of result) {
        expect(hubGraph.hasEdge('center', neighbor) || hubGraph.hasEdge(neighbor, 'center')).toBe(
          true
        );
      }
    });
  });

  describe('findPath', () => {
    it('returns path between connected nodes with valid edges', () => {
      const path = findPath(graph, 'a', 'c');
      expect(path).toEqual(['a', 'b', 'c']);
      // Verify path validity: every consecutive pair must have an edge
      for (let i = 0; i < path!.length - 1; i++) {
        const from = path![i]!;
        const to = path![i + 1]!;
        expect(graph.hasDirectedEdge(from, to)).toBe(true);
      }
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

    it('finds shortest path when multiple exist and all edges are valid', () => {
      // a -> e via d (2 hops) or via b (2 hops)
      const path = findPath(graph, 'a', 'e');
      expect(path).toHaveLength(3);
      expect(path?.[0]).toBe('a');
      expect(path?.[path.length - 1]).toBe('e');
      // Verify path validity: every consecutive pair must have an edge
      for (let i = 0; i < path!.length - 1; i++) {
        const from = path![i]!;
        const to = path![i + 1]!;
        expect(graph.hasDirectedEdge(from, to)).toBe(true);
      }
    });

    it('returns null between disconnected components', () => {
      const disconnected = new DirectedGraph();
      disconnected.addNode('a');
      disconnected.addNode('b');
      disconnected.addNode('x');
      disconnected.addNode('y');
      disconnected.addDirectedEdge('a', 'b');
      disconnected.addDirectedEdge('x', 'y');

      expect(findPath(disconnected, 'a', 'x')).toBeNull();
      expect(findPath(disconnected, 'b', 'y')).toBeNull();
    });

    it('finds path within same component of disconnected graph', () => {
      const disconnected = new DirectedGraph();
      disconnected.addNode('a');
      disconnected.addNode('b');
      disconnected.addNode('x');
      disconnected.addNode('y');
      disconnected.addDirectedEdge('a', 'b');
      disconnected.addDirectedEdge('x', 'y');

      expect(findPath(disconnected, 'a', 'b')).toEqual(['a', 'b']);
      expect(findPath(disconnected, 'x', 'y')).toEqual(['x', 'y']);
    });

    it('returns single-node path for self-loop source=target', () => {
      const selfLoopGraph = new DirectedGraph();
      selfLoopGraph.addNode('loop');
      selfLoopGraph.addDirectedEdge('loop', 'loop');

      // Same source and target should return [source], not follow the self-loop
      const path = findPath(selfLoopGraph, 'loop', 'loop');
      expect(path).toEqual(['loop']);
    });

    it('returns null for path from isolated node', () => {
      const mixedGraph = new DirectedGraph();
      mixedGraph.addNode('island');
      mixedGraph.addNode('connected');
      mixedGraph.addNode('other');
      mixedGraph.addDirectedEdge('connected', 'other');

      expect(findPath(mixedGraph, 'island', 'other')).toBeNull();
      expect(findPath(mixedGraph, 'connected', 'island')).toBeNull();
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

    it('breaks ties deterministically by node ID (ascending)', () => {
      // Create graph with multiple nodes having equal degree
      const tiedGraph = new DirectedGraph();
      tiedGraph.addNode('zebra');
      tiedGraph.addNode('apple');
      tiedGraph.addNode('mango');
      tiedGraph.addNode('hub');
      // hub -> all others: hub has out_degree 3
      tiedGraph.addDirectedEdge('hub', 'zebra');
      tiedGraph.addDirectedEdge('hub', 'apple');
      tiedGraph.addDirectedEdge('hub', 'mango');
      // zebra, apple, mango all have in_degree 1

      const hubs = getHubs(tiedGraph, 'in_degree', 4);

      // hub has in_degree 0, should be last
      // zebra, apple, mango all have in_degree 1, should be sorted alphabetically
      expect(hubs[0][0]).toBe('apple'); // in_degree 1, alphabetically first
      expect(hubs[1][0]).toBe('mango'); // in_degree 1
      expect(hubs[2][0]).toBe('zebra'); // in_degree 1
      expect(hubs[3][0]).toBe('hub'); // in_degree 0
    });

    it('returns consistent order across multiple calls', () => {
      // Verify determinism by calling multiple times
      const tiedGraph = new DirectedGraph();
      tiedGraph.addNode('c');
      tiedGraph.addNode('a');
      tiedGraph.addNode('b');
      // All nodes have degree 0

      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(getHubs(tiedGraph, 'in_degree', 3).map(([id]) => id).join(','));
      }

      // All results should be identical
      expect(new Set(results).size).toBe(1);
      // And should be sorted alphabetically since all degrees are equal
      expect(results[0]).toBe('a,b,c');
    });
  });
});
