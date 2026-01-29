import { describe, it, expect, beforeEach } from 'vitest';
import { GraphManager, GraphNotReadyError } from '../../../src/graph/manager.js';
import { createTestNode } from './fixtures.js';

describe('GraphManager', () => {
  let manager: GraphManager;

  // Create nodes that form the standard 5-node test graph:
  //   a -> b -> c
  //   |    |
  //   v    v
  //   d -> e
  const testNodes = [
    createTestNode('a', ['b', 'd']),
    createTestNode('b', ['c', 'e']),
    createTestNode('c', []),
    createTestNode('d', ['e']),
    createTestNode('e', []),
  ];

  beforeEach(() => {
    manager = new GraphManager();
  });

  describe('empty graph handling', () => {
    it('builds empty centrality map from empty nodes array', () => {
      const metrics = manager.build([]);

      expect(metrics).toBeInstanceOf(Map);
      expect(metrics.size).toBe(0);
    });

    it('handles getHubs on empty graph', () => {
      manager.build([]);

      const hubs = manager.getHubs('in_degree', 10);

      expect(hubs).toEqual([]);
    });

    it('handles getHubs out_degree on empty graph', () => {
      manager.build([]);

      const hubs = manager.getHubs('out_degree', 10);

      expect(hubs).toEqual([]);
    });
  });

  describe('build', () => {
    it('returns centrality Map with all nodes', () => {
      const metrics = manager.build(testNodes);

      expect(metrics).toBeInstanceOf(Map);
      expect(metrics.size).toBe(5);
      expect(metrics.has('a')).toBe(true);
      expect(metrics.has('e')).toBe(true);
    });

    it('returns correct centrality metrics', () => {
      const metrics = manager.build(testNodes);

      // Node 'e' has in_degree 2 (from b and d)
      expect(metrics.get('e')).toEqual({ inDegree: 2, outDegree: 0 });
      // Node 'a' has out_degree 2 (to b and d)
      expect(metrics.get('a')).toEqual({ inDegree: 0, outDegree: 2 });
    });

    it('makes graph ready', () => {
      expect(manager.isReady()).toBe(false);
      manager.build(testNodes);
      expect(manager.isReady()).toBe(true);
    });
  });

  describe('isReady', () => {
    it('returns false initially', () => {
      expect(manager.isReady()).toBe(false);
    });

    it('returns true after build', () => {
      manager.build(testNodes);
      expect(manager.isReady()).toBe(true);
    });
  });

  describe('assertReady', () => {
    it('throws GraphNotReadyError when not built', () => {
      expect(() => manager.assertReady()).toThrow(GraphNotReadyError);
      expect(() => manager.assertReady()).toThrow('Graph not built. Call build() before querying.');
    });

    it('returns graph when built', () => {
      manager.build(testNodes);
      const graph = manager.assertReady();

      expect(graph).toBeDefined();
      expect(graph.order).toBe(5); // 5 nodes
    });
  });

  describe('GraphNotReadyError', () => {
    it('has correct name', () => {
      const error = new GraphNotReadyError();
      expect(error.name).toBe('GraphNotReadyError');
    });

    it('has correct message', () => {
      const error = new GraphNotReadyError();
      expect(error.message).toBe('Graph not built. Call build() before querying.');
    });

    it('is instance of Error', () => {
      const error = new GraphNotReadyError();
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('query methods when not ready', () => {
    it('getNeighborIds throws GraphNotReadyError', () => {
      expect(() => manager.getNeighborIds('a', { direction: 'out' })).toThrow(GraphNotReadyError);
    });

    it('findPath throws GraphNotReadyError', () => {
      expect(() => manager.findPath('a', 'b')).toThrow(GraphNotReadyError);
    });

    it('getHubs throws GraphNotReadyError', () => {
      expect(() => manager.getHubs('in_degree', 5)).toThrow(GraphNotReadyError);
    });
  });

  describe('getNeighborIds', () => {
    beforeEach(() => {
      manager.build(testNodes);
    });

    it('delegates to traversal function with correct args', () => {
      const result = manager.getNeighborIds('a', { direction: 'out' });
      expect(result.sort()).toEqual(['b', 'd']);
    });

    it('returns incoming neighbors', () => {
      const result = manager.getNeighborIds('e', { direction: 'in' });
      expect(result.sort()).toEqual(['b', 'd']);
    });

    it('respects limit option', () => {
      const result = manager.getNeighborIds('a', { direction: 'out', limit: 1 });
      expect(result).toHaveLength(1);
    });
  });

  describe('findPath', () => {
    beforeEach(() => {
      manager.build(testNodes);
    });

    it('delegates to traversal function', () => {
      const path = manager.findPath('a', 'c');
      expect(path).toEqual(['a', 'b', 'c']);
    });

    it('returns null when no path exists', () => {
      const path = manager.findPath('c', 'a');
      expect(path).toBeNull();
    });

    it('returns single node for same source and target', () => {
      const path = manager.findPath('a', 'a');
      expect(path).toEqual(['a']);
    });
  });

  describe('getHubs', () => {
    beforeEach(() => {
      manager.build(testNodes);
    });

    it('delegates to traversal function for in_degree', () => {
      const hubs = manager.getHubs('in_degree', 3);
      expect(hubs[0]).toEqual(['e', 2]);
    });

    it('delegates to traversal function for out_degree', () => {
      const hubs = manager.getHubs('out_degree', 2);
      expect(hubs[0]).toEqual(['a', 2]);
      expect(hubs[1]).toEqual(['b', 2]);
    });

    it('respects limit', () => {
      const hubs = manager.getHubs('in_degree', 1);
      expect(hubs).toHaveLength(1);
    });

    it('returns empty array when limit is 0', () => {
      const hubs = manager.getHubs('in_degree', 0);
      expect(hubs).toEqual([]);
    });

    it('returns empty array when limit is negative', () => {
      const hubs = manager.getHubs('out_degree', -5);
      expect(hubs).toEqual([]);
    });
  });
});
