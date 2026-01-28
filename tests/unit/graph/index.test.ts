import { describe, it, expect } from 'vitest';
import {
  buildGraph,
  getNeighborIds,
  findPath,
  getHubs,
  computeCentrality,
  GraphManager,
  GraphNotReadyError,
} from '../../../src/graph/index.js';

describe('graph/index exports', () => {
  it('exports buildGraph', () => {
    expect(buildGraph).toBeDefined();
    expect(typeof buildGraph).toBe('function');
  });

  it('exports getNeighborIds', () => {
    expect(getNeighborIds).toBeDefined();
    expect(typeof getNeighborIds).toBe('function');
  });

  it('exports findPath', () => {
    expect(findPath).toBeDefined();
    expect(typeof findPath).toBe('function');
  });

  it('exports getHubs', () => {
    expect(getHubs).toBeDefined();
    expect(typeof getHubs).toBe('function');
  });

  it('exports computeCentrality', () => {
    expect(computeCentrality).toBeDefined();
    expect(typeof computeCentrality).toBe('function');
  });

  it('exports GraphManager', () => {
    expect(GraphManager).toBeDefined();
    expect(typeof GraphManager).toBe('function');
  });

  it('exports GraphNotReadyError', () => {
    expect(GraphNotReadyError).toBeDefined();
    expect(typeof GraphNotReadyError).toBe('function');
  });
});
