import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Node } from '../../../src/types/node.js';
import type { StoreProvider } from '../../../src/types/provider.js';
import {
  nodeToResponse,
  nodesToResponses,
  nodeToContextResponse,
  nodesToSearchResults,
  hubsToResponses,
  pathToResponse,
  MAX_NEIGHBORS,
  MAX_LINKS_TO_RESOLVE,
} from '../../../src/mcp/transforms.js';
import { TRUNCATION_LIMITS } from '../../../src/mcp/truncate.js';

function createMockStore(
  titleMap: Map<string, string> = new Map()
): StoreProvider {
  return {
    resolveTitles: vi.fn().mockResolvedValue(titleMap),
    createNode: vi.fn(),
    updateNode: vi.fn(),
    deleteNode: vi.fn(),
    getNode: vi.fn(),
    getNodes: vi.fn(),
    getNeighbors: vi.fn(),
    findPath: vi.fn(),
    getHubs: vi.fn(),
    storeEmbedding: vi.fn(),
    searchByVector: vi.fn(),
    searchByTags: vi.fn(),
    getRandomNode: vi.fn(),
  };
}

function createNode(overrides: Partial<Node> = {}): Node {
  return {
    id: 'test.md',
    title: 'Test Node',
    content: 'Test content',
    tags: ['tag1'],
    outgoingLinks: [],
    properties: {},
    ...overrides,
  };
}

describe('nodeToResponse', () => {
  it('transforms node with resolved link titles', async () => {
    const node = createNode({
      outgoingLinks: ['linked.md', 'other.md'],
    });
    const titleMap = new Map([
      ['linked.md', 'Linked Node'],
      ['other.md', 'Other Node'],
    ]);
    const store = createMockStore(titleMap);

    const response = await nodeToResponse(node, store, 'primary');

    expect(response).toEqual({
      id: 'test.md',
      title: 'Test Node',
      content: 'Test content',
      tags: ['tag1'],
      links: [
        { id: 'linked.md', title: 'Linked Node' },
        { id: 'other.md', title: 'Other Node' },
      ],
      properties: {},
    });
    expect(store.resolveTitles).toHaveBeenCalledWith(['linked.md', 'other.md']);
  });

  it('falls back to ID when title not resolved', async () => {
    const node = createNode({
      outgoingLinks: ['missing.md'],
    });
    const store = createMockStore(new Map());

    const response = await nodeToResponse(node, store, 'primary');

    expect(response.links).toEqual([{ id: 'missing.md', title: 'missing.md' }]);
  });

  it('truncates content based on context', async () => {
    const longContent = 'x'.repeat(TRUNCATION_LIMITS.primary + 100);
    const node = createNode({ content: longContent });
    const store = createMockStore();

    const response = await nodeToResponse(node, store, 'primary');

    expect(response.content.length).toBe(TRUNCATION_LIMITS.primary);
    expect(response.content.endsWith('... [truncated]')).toBe(true);
  });

  it('uses list truncation when specified', async () => {
    const content = 'x'.repeat(TRUNCATION_LIMITS.list + 100);
    const node = createNode({ content });
    const store = createMockStore();

    const response = await nodeToResponse(node, store, 'list');

    expect(response.content.length).toBe(TRUNCATION_LIMITS.list);
  });

  it('includes properties in response', async () => {
    const node = createNode({
      properties: { author: 'Jane Doe', status: 'draft', priority: 1 },
    });
    const store = createMockStore();

    const response = await nodeToResponse(node, store, 'primary');

    expect(response.properties).toEqual({
      author: 'Jane Doe',
      status: 'draft',
      priority: 1,
    });
  });

  it('includes empty properties object when node has no properties', async () => {
    const node = createNode({ properties: {} });
    const store = createMockStore();

    const response = await nodeToResponse(node, store, 'primary');

    expect(response.properties).toEqual({});
  });
});

describe('nodesToResponses', () => {
  it('batch resolves all link titles', async () => {
    const nodes = [
      createNode({ id: 'a.md', outgoingLinks: ['x.md', 'y.md'] }),
      createNode({ id: 'b.md', outgoingLinks: ['y.md', 'z.md'] }),
    ];
    const titleMap = new Map([
      ['x.md', 'X'],
      ['y.md', 'Y'],
      ['z.md', 'Z'],
    ]);
    const store = createMockStore(titleMap);

    const responses = await nodesToResponses(nodes, store, 'list', true);

    // Should batch resolve unique IDs
    expect(store.resolveTitles).toHaveBeenCalledTimes(1);
    const resolvedIds = (store.resolveTitles as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(new Set(resolvedIds)).toEqual(new Set(['x.md', 'y.md', 'z.md']));

    expect(responses).toHaveLength(2);
    expect(responses[0]?.links).toEqual([
      { id: 'x.md', title: 'X' },
      { id: 'y.md', title: 'Y' },
    ]);
    expect(responses[1]?.links).toEqual([
      { id: 'y.md', title: 'Y' },
      { id: 'z.md', title: 'Z' },
    ]);
  });

  it('excludes content when includeContent is false', async () => {
    const nodes = [createNode({ id: 'a.md', content: 'Some content' })];
    const store = createMockStore();

    const responses = await nodesToResponses(nodes, store, 'list', false);

    expect(responses[0]).not.toHaveProperty('content');
    expect(responses[0]?.id).toBe('a.md');
    expect(responses[0]?.title).toBe('Test Node');
    expect(responses[0]?.tags).toEqual(['tag1']);
    expect(responses[0]?.links).toEqual([]);
    expect(responses[0]?.properties).toEqual({});
  });

  it('includes content when includeContent is true', async () => {
    const nodes = [createNode({ id: 'a.md', content: 'Some content' })];
    const store = createMockStore();

    const responses = await nodesToResponses(nodes, store, 'list', true);

    expect(responses[0]?.content).toBe('Some content');
  });

  it('handles empty nodes array', async () => {
    const store = createMockStore();
    const responses = await nodesToResponses([], store, 'list', true);

    expect(responses).toEqual([]);
    expect(store.resolveTitles).toHaveBeenCalledWith([]);
  });

  it('falls back to ID when title not resolved in batch', async () => {
    const nodes = [
      createNode({ id: 'a.md', outgoingLinks: ['resolved.md', 'missing.md'] }),
    ];
    const titleMap = new Map([['resolved.md', 'Resolved']]);
    const store = createMockStore(titleMap);

    const responses = await nodesToResponses(nodes, store, 'list', true);

    expect(responses[0]?.links).toEqual([
      { id: 'resolved.md', title: 'Resolved' },
      { id: 'missing.md', title: 'missing.md' },
    ]);
  });

  it('propagates error when resolveTitles rejects', async () => {
    const nodes = [createNode({ outgoingLinks: ['link.md'] })];
    const store = createMockStore();
    (store.resolveTitles as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Store unavailable')
    );

    await expect(nodesToResponses(nodes, store, 'list', true)).rejects.toThrow(
      'Store unavailable'
    );
  });

  it('limits links per node to MAX_LINKS_TO_RESOLVE', async () => {
    const manyLinks = Array.from({ length: 150 }, (_, i) => `link-${i}.md`);
    const nodes = [createNode({ outgoingLinks: manyLinks })];
    const store = createMockStore();

    const responses = await nodesToResponses(nodes, store, 'list', true);

    // Should only include first 100 links
    expect(responses[0]?.links).toHaveLength(100);
    expect(responses[0]?.links[0]?.id).toBe('link-0.md');
    expect(responses[0]?.links[99]?.id).toBe('link-99.md');
  });

  it('includes properties for each node', async () => {
    const nodes = [
      createNode({ id: 'a.md', properties: { category: 'recipe' } }),
      createNode({ id: 'b.md', properties: { category: 'note', reviewed: true } }),
    ];
    const store = createMockStore();

    const responses = await nodesToResponses(nodes, store, 'list', true);

    expect(responses[0]?.properties).toEqual({ category: 'recipe' });
    expect(responses[1]?.properties).toEqual({ category: 'note', reviewed: true });
  });
});

describe('nodeToContextResponse', () => {
  it('includes primary node with neighbors', async () => {
    const node = createNode({ id: 'main.md' });
    const incoming = [createNode({ id: 'in.md', title: 'Incoming' })];
    const outgoing = [createNode({ id: 'out.md', title: 'Outgoing' })];
    const store = createMockStore();

    const response = await nodeToContextResponse(
      node,
      incoming,
      outgoing,
      store
    );

    expect(response.id).toBe('main.md');
    expect(response.incomingNeighbors).toHaveLength(1);
    expect(response.incomingNeighbors[0]?.title).toBe('Incoming');
    expect(response.outgoingNeighbors).toHaveLength(1);
    expect(response.outgoingNeighbors[0]?.title).toBe('Outgoing');
    expect(response.incomingCount).toBe(1);
    expect(response.outgoingCount).toBe(1);
  });

  it('limits neighbors to MAX_NEIGHBORS', async () => {
    const node = createNode();
    const manyNeighbors = Array.from({ length: 30 }, (_, i) =>
      createNode({ id: `node-${i}.md`, title: `Node ${i}` })
    );
    const store = createMockStore();

    const response = await nodeToContextResponse(
      node,
      manyNeighbors,
      manyNeighbors,
      store
    );

    expect(response.incomingNeighbors).toHaveLength(MAX_NEIGHBORS);
    expect(response.outgoingNeighbors).toHaveLength(MAX_NEIGHBORS);
    // Counts reflect total, not limited
    expect(response.incomingCount).toBe(30);
    expect(response.outgoingCount).toBe(30);
  });

  it('uses neighbor truncation for neighbor content', async () => {
    const node = createNode();
    const neighborContent = 'x'.repeat(TRUNCATION_LIMITS.neighbor + 100);
    const neighbor = createNode({ id: 'n.md', content: neighborContent });
    const store = createMockStore();

    const response = await nodeToContextResponse(node, [neighbor], [], store);

    expect(response.incomingNeighbors[0]?.content.length).toBe(
      TRUNCATION_LIMITS.neighbor
    );
  });

  it('uses primary truncation for main node', async () => {
    const longContent = 'x'.repeat(TRUNCATION_LIMITS.primary + 100);
    const node = createNode({ content: longContent });
    const store = createMockStore();

    const response = await nodeToContextResponse(node, [], [], store);

    expect(response.content.length).toBe(TRUNCATION_LIMITS.primary);
  });
});

describe('nodesToSearchResults', () => {
  it('attaches scores to responses', async () => {
    const nodes = [
      createNode({ id: 'a.md' }),
      createNode({ id: 'b.md' }),
    ];
    const scores = new Map([
      ['a.md', 0.95],
      ['b.md', 0.80],
    ]);
    const store = createMockStore();

    const results = await nodesToSearchResults(nodes, scores, store, true);

    expect(results[0]?.score).toBe(0.95);
    expect(results[1]?.score).toBe(0.80);
  });

  it('excludes content when includeContent is false', async () => {
    const nodes = [createNode({ id: 'a.md', content: 'Some content' })];
    const scores = new Map([['a.md', 0.9]]);
    const store = createMockStore();

    const results = await nodesToSearchResults(nodes, scores, store, false);

    expect(results[0]).not.toHaveProperty('content');
    expect(results[0]?.id).toBe('a.md');
    expect(results[0]?.score).toBe(0.9);
  });

  it('includes content when includeContent is true', async () => {
    const nodes = [createNode({ id: 'a.md', content: 'Some content' })];
    const scores = new Map([['a.md', 0.9]]);
    const store = createMockStore();

    const results = await nodesToSearchResults(nodes, scores, store, true);

    expect(results[0]?.content).toBe('Some content');
  });

  it('defaults to 0 for missing scores', async () => {
    const nodes = [createNode({ id: 'no-score.md' })];
    const store = createMockStore();

    const results = await nodesToSearchResults(nodes, new Map(), store, true);

    expect(results[0]?.score).toBe(0);
  });

  it('uses list truncation when includeContent is true', async () => {
    const content = 'x'.repeat(TRUNCATION_LIMITS.list + 100);
    const nodes = [createNode({ content })];
    const store = createMockStore();

    const results = await nodesToSearchResults(nodes, new Map(), store, true);

    expect(results[0]?.content?.length).toBe(TRUNCATION_LIMITS.list);
  });
});

describe('hubsToResponses', () => {
  it('transforms hub tuples to responses with resolved titles', async () => {
    const hubs: Array<[string, number]> = [
      ['hub1.md', 45],
      ['hub2.md', 32],
    ];
    const titleMap = new Map([
      ['hub1.md', 'Main Hub'],
      ['hub2.md', 'Secondary Hub'],
    ]);
    const store = createMockStore(titleMap);

    const responses = await hubsToResponses(hubs, store);

    expect(responses).toEqual([
      { id: 'hub1.md', title: 'Main Hub', score: 45 },
      { id: 'hub2.md', title: 'Secondary Hub', score: 32 },
    ]);
  });

  it('falls back to ID for unresolved titles', async () => {
    const hubs: Array<[string, number]> = [['unknown.md', 10]];
    const store = createMockStore(new Map());

    const responses = await hubsToResponses(hubs, store);

    expect(responses[0]?.title).toBe('unknown.md');
  });
});

describe('pathToResponse', () => {
  it('transforms path array to PathResponse', () => {
    const path = ['a.md', 'b.md', 'c.md'];
    const response = pathToResponse(path);

    expect(response).toEqual({
      path: ['a.md', 'b.md', 'c.md'],
      length: 2,
    });
  });

  it('handles single-node path', () => {
    const response = pathToResponse(['only.md']);

    expect(response).toEqual({
      path: ['only.md'],
      length: 0,
    });
  });

  it('handles empty path', () => {
    const response = pathToResponse([]);

    expect(response).toEqual({
      path: [],
      length: -1,
    });
  });
});
