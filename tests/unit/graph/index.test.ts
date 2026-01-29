import { describe, it, expect } from 'vitest';
import { DirectedGraph } from 'graphology';
import {
  buildGraph,
  getNeighborIds,
  findPath,
  getHubs,
  computeCentrality,
  GraphManager,
  GraphNotReadyError,
} from '../../../src/graph/index.js';
import { createTestGraph, createTestNode } from './fixtures.js';

describe('graph/index exports', () => {
  it('buildGraph creates graph from nodes', () => {
    const nodes = [
      createTestNode('a', ['b']),
      createTestNode('b', []),
    ];
    const graph = buildGraph(nodes);
    expect(graph).toBeInstanceOf(DirectedGraph);
    expect(graph.hasNode('a')).toBe(true);
    expect(graph.hasNode('b')).toBe(true);
    expect(graph.hasDirectedEdge('a', 'b')).toBe(true);
  });

  it('getNeighborIds returns correct neighbors', () => {
    const graph = createTestGraph();
    const neighbors = getNeighborIds(graph, 'a', { direction: 'out' });
    expect(neighbors.sort()).toEqual(['b', 'd']);
  });

  it('findPath returns valid path', () => {
    const graph = createTestGraph();
    const path = findPath(graph, 'a', 'c');
    expect(path).toEqual(['a', 'b', 'c']);
  });

  it('getHubs returns nodes sorted by degree', () => {
    const graph = createTestGraph();
    const hubs = getHubs(graph, 'in_degree', 1);
    expect(hubs).toHaveLength(1);
    expect(hubs[0]![0]).toBe('e'); // e has in_degree 2, highest
    expect(hubs[0]![1]).toBe(2);
  });

  it('computeCentrality returns centrality metrics for each node', () => {
    const graph = createTestGraph();
    const centrality = computeCentrality(graph);
    // e has in_degree 2, out_degree 0
    expect(centrality.get('e')?.inDegree).toBe(2);
    expect(centrality.get('e')?.outDegree).toBe(0);
    // a has in_degree 0, out_degree 2
    expect(centrality.get('a')?.inDegree).toBe(0);
    expect(centrality.get('a')?.outDegree).toBe(2);
  });

  it('GraphManager can be instantiated', () => {
    const manager = new GraphManager();
    expect(manager).toBeInstanceOf(GraphManager);
  });

  it('GraphNotReadyError has fixed message', () => {
    const error = new GraphNotReadyError();
    expect(error).toBeInstanceOf(GraphNotReadyError);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Graph not built. Call build() before querying.');
    expect(error.name).toBe('GraphNotReadyError');
  });
});
