import { describe, it, expect } from 'vitest';
import { buildGraph } from '../../../src/graph/builder.js';
import type { Node } from '../../../src/types/node.js';

const createNode = (overrides: Partial<Node> = {}): Node => ({
  id: 'test.md',
  title: 'Test',
  content: '',
  tags: [],
  outgoingLinks: [],
  properties: {},
  ...overrides,
});

describe('buildGraph', () => {
  it('returns empty graph for empty node array', () => {
    const graph = buildGraph([]);

    expect(graph.order).toBe(0);
    expect(graph.size).toBe(0);
  });

  it('adds nodes to graph', () => {
    const nodes = [
      createNode({ id: 'a.md' }),
      createNode({ id: 'b.md' }),
      createNode({ id: 'c.md' }),
    ];

    const graph = buildGraph(nodes);

    expect(graph.order).toBe(3);
    expect(graph.hasNode('a.md')).toBe(true);
    expect(graph.hasNode('b.md')).toBe(true);
    expect(graph.hasNode('c.md')).toBe(true);
  });

  it('creates directed edges from outgoingLinks', () => {
    const nodes = [
      createNode({ id: 'a.md', outgoingLinks: ['b.md', 'c.md'] }),
      createNode({ id: 'b.md', outgoingLinks: ['c.md'] }),
      createNode({ id: 'c.md' }),
    ];

    const graph = buildGraph(nodes);

    expect(graph.size).toBe(3);
    expect(graph.hasDirectedEdge('a.md', 'b.md')).toBe(true);
    expect(graph.hasDirectedEdge('a.md', 'c.md')).toBe(true);
    expect(graph.hasDirectedEdge('b.md', 'c.md')).toBe(true);
    // No reverse edges
    expect(graph.hasDirectedEdge('b.md', 'a.md')).toBe(false);
  });

  it('ignores links to non-existent nodes', () => {
    const nodes = [
      createNode({ id: 'a.md', outgoingLinks: ['b.md', 'missing.md'] }),
      createNode({ id: 'b.md' }),
    ];

    const graph = buildGraph(nodes);

    expect(graph.size).toBe(1);
    expect(graph.hasDirectedEdge('a.md', 'b.md')).toBe(true);
    expect(graph.hasNode('missing.md')).toBe(false);
  });

  it('handles self-referencing links', () => {
    const nodes = [createNode({ id: 'a.md', outgoingLinks: ['a.md'] })];

    const graph = buildGraph(nodes);

    expect(graph.size).toBe(1);
    expect(graph.hasDirectedEdge('a.md', 'a.md')).toBe(true);
  });

  it('deduplicates multiple links to same target', () => {
    const nodes = [
      createNode({ id: 'a.md', outgoingLinks: ['b.md', 'b.md', 'b.md'] }),
      createNode({ id: 'b.md' }),
    ];

    const graph = buildGraph(nodes);

    expect(graph.size).toBe(1);
  });

  it('handles circular link structures without infinite loops', () => {
    // A → B → C → A (cycle)
    const nodes = [
      createNode({ id: 'a.md', outgoingLinks: ['b.md'] }),
      createNode({ id: 'b.md', outgoingLinks: ['c.md'] }),
      createNode({ id: 'c.md', outgoingLinks: ['a.md'] }),
    ];

    const graph = buildGraph(nodes);

    expect(graph.order).toBe(3);
    expect(graph.size).toBe(3);
    expect(graph.hasDirectedEdge('a.md', 'b.md')).toBe(true);
    expect(graph.hasDirectedEdge('b.md', 'c.md')).toBe(true);
    expect(graph.hasDirectedEdge('c.md', 'a.md')).toBe(true);
  });

  it('handles complex cycles with multiple entry points', () => {
    // A → B → C → B (cycle) and A → D → C
    const nodes = [
      createNode({ id: 'a.md', outgoingLinks: ['b.md', 'd.md'] }),
      createNode({ id: 'b.md', outgoingLinks: ['c.md'] }),
      createNode({ id: 'c.md', outgoingLinks: ['b.md'] }),
      createNode({ id: 'd.md', outgoingLinks: ['c.md'] }),
    ];

    const graph = buildGraph(nodes);

    expect(graph.order).toBe(4);
    expect(graph.size).toBe(5);
  });

  it('throws on duplicate node IDs', () => {
    const nodes = [
      createNode({ id: 'dupe.md', title: 'First' }),
      createNode({ id: 'dupe.md', title: 'Second' }),
    ];

    // graphology throws when adding duplicate node
    expect(() => buildGraph(nodes)).toThrow();
  });

  it('treats different-case IDs as distinct nodes', () => {
    // Node IDs are case-sensitive in graphology
    const nodes = [
      createNode({ id: 'Note.md', outgoingLinks: ['note.md'] }),
      createNode({ id: 'note.md', outgoingLinks: [] }),
    ];

    const graph = buildGraph(nodes);

    expect(graph.order).toBe(2);
    expect(graph.hasNode('Note.md')).toBe(true);
    expect(graph.hasNode('note.md')).toBe(true);
    expect(graph.hasDirectedEdge('Note.md', 'note.md')).toBe(true);
  });

  describe('edge cases for node IDs', () => {
    it('accepts empty string node ID (graphology allows it)', () => {
      // Note: This documents graphology behavior. Upstream validation
      // (DocStore, MCP handlers) should reject empty IDs before they reach here.
      const nodes = [createNode({ id: '' })];

      const graph = buildGraph(nodes);

      expect(graph.order).toBe(1);
      expect(graph.hasNode('')).toBe(true);
    });

    it('accepts whitespace-only node ID (graphology allows it)', () => {
      // Note: Upstream validation should reject whitespace-only IDs.
      const nodes = [createNode({ id: '   ' })];

      const graph = buildGraph(nodes);

      expect(graph.order).toBe(1);
      expect(graph.hasNode('   ')).toBe(true);
    });

    it('ignores links to empty string target when no empty node exists', () => {
      const nodes = [
        createNode({ id: 'a.md', outgoingLinks: [''] }),
      ];

      const graph = buildGraph(nodes);

      expect(graph.order).toBe(1);
      expect(graph.size).toBe(0);
    });

    it('creates edge to empty string target when empty node exists', () => {
      const nodes = [
        createNode({ id: 'a.md', outgoingLinks: [''] }),
        createNode({ id: '' }),
      ];

      const graph = buildGraph(nodes);

      expect(graph.order).toBe(2);
      expect(graph.size).toBe(1);
      expect(graph.hasDirectedEdge('a.md', '')).toBe(true);
    });
  });
});
