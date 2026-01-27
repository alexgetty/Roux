import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Node } from '../../../src/types/node.js';
import type { GraphCore } from '../../../src/types/graphcore.js';
import type { StoreProvider } from '../../../src/types/provider.js';
import {
  handleSearch,
  handleGetNode,
  handleGetNeighbors,
  handleFindPath,
  handleGetHubs,
  handleSearchByTags,
  handleRandomNode,
  handleCreateNode,
  handleUpdateNode,
  handleDeleteNode,
  sanitizeFilename,
  deriveTitle,
  dispatchTool,
  coerceInt,
  type HandlerContext,
} from '../../../src/mcp/handlers.js';
import { McpError } from '../../../src/mcp/types.js';

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
    listNodes: vi.fn().mockResolvedValue({ nodes: [], total: 0 }),
    resolveNodes: vi.fn().mockResolvedValue([]),
    nodesExist: vi.fn().mockResolvedValue(new Map()),
  };
}

function createMockCore(): GraphCore {
  return {
    registerStore: vi.fn(),
    registerEmbedding: vi.fn(),
    search: vi.fn().mockResolvedValue([]),
    getNode: vi.fn().mockResolvedValue(null),
    createNode: vi.fn(),
    updateNode: vi.fn(),
    deleteNode: vi.fn().mockResolvedValue(false),
    getNeighbors: vi.fn().mockResolvedValue([]),
    findPath: vi.fn().mockResolvedValue(null),
    getHubs: vi.fn().mockResolvedValue([]),
    searchByTags: vi.fn().mockResolvedValue([]),
    getRandomNode: vi.fn().mockResolvedValue(null),
    listNodes: vi.fn().mockResolvedValue({ nodes: [], total: 0 }),
    resolveNodes: vi.fn().mockResolvedValue([]),
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

function createContext(overrides: Partial<HandlerContext> = {}): HandlerContext {
  return {
    core: createMockCore(),
    store: createMockStore(),
    hasEmbedding: true,
    ...overrides,
  };
}

describe('handleSearch', () => {
  it('returns search results with scores', async () => {
    const nodes = [
      createNode({ id: 'a.md', title: 'First' }),
      createNode({ id: 'b.md', title: 'Second' }),
    ];
    const ctx = createContext();
    (ctx.core.search as ReturnType<typeof vi.fn>).mockResolvedValue(nodes);

    const result = await handleSearch(ctx, { query: 'test', limit: 10 });

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe('a.md');
    expect(result[0]?.score).toBe(1);
    expect(result[1]?.score).toBe(0.95);
  });

  it('excludes content by default (metadata-only)', async () => {
    const nodes = [createNode({ id: 'a.md', content: 'Should not appear' })];
    const ctx = createContext();
    (ctx.core.search as ReturnType<typeof vi.fn>).mockResolvedValue(nodes);

    const result = await handleSearch(ctx, { query: 'test' });

    expect(result[0]).not.toHaveProperty('content');
    expect(result[0]?.id).toBe('a.md');
    expect(result[0]?.score).toBeDefined();
  });

  it('includes content when include_content is true', async () => {
    const nodes = [createNode({ id: 'a.md', content: 'This should appear' })];
    const ctx = createContext();
    (ctx.core.search as ReturnType<typeof vi.fn>).mockResolvedValue(nodes);

    const result = await handleSearch(ctx, { query: 'test', include_content: true });

    expect(result[0]?.content).toBe('This should appear');
  });

  it('throws PROVIDER_ERROR when embedding not available', async () => {
    const ctx = createContext({ hasEmbedding: false });

    await expect(handleSearch(ctx, { query: 'test' })).rejects.toThrow(McpError);
    await expect(handleSearch(ctx, { query: 'test' })).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
    });
  });

  it('throws INVALID_PARAMS when query missing', async () => {
    const ctx = createContext();

    await expect(handleSearch(ctx, {})).rejects.toThrow(McpError);
    await expect(handleSearch(ctx, {})).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
    });
  });

  it('throws INVALID_PARAMS when query is empty string', async () => {
    const ctx = createContext();

    await expect(handleSearch(ctx, { query: '' })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('non-empty'),
    });
  });

  it('throws INVALID_PARAMS when query is whitespace only', async () => {
    const ctx = createContext();

    await expect(handleSearch(ctx, { query: '   ' })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
    });
  });

  it('propagates unexpected errors from core.search', async () => {
    const ctx = createContext();
    (ctx.core.search as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Database connection failed')
    );

    await expect(handleSearch(ctx, { query: 'test' })).rejects.toThrow(
      'Database connection failed'
    );
  });

  it('uses default limit of 10', async () => {
    const ctx = createContext();
    (ctx.core.search as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await handleSearch(ctx, { query: 'test' });

    expect(ctx.core.search).toHaveBeenCalledWith('test', { limit: 10 });
  });

  it('coerces string limit to number', async () => {
    const ctx = createContext();
    (ctx.core.search as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await handleSearch(ctx, { query: 'test', limit: '5' });

    expect(ctx.core.search).toHaveBeenCalledWith('test', { limit: 5 });
  });

  it('floors float limit to integer', async () => {
    const ctx = createContext();
    (ctx.core.search as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await handleSearch(ctx, { query: 'test', limit: 5.7 });

    expect(ctx.core.search).toHaveBeenCalledWith('test', { limit: 5 });
  });

  it('uses default limit for non-numeric string', async () => {
    const ctx = createContext();
    (ctx.core.search as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await handleSearch(ctx, { query: 'test', limit: 'abc' });

    expect(ctx.core.search).toHaveBeenCalledWith('test', { limit: 10 });
  });

  it('throws INVALID_PARAMS for negative limit', async () => {
    const ctx = createContext();

    await expect(handleSearch(ctx, { query: 'test', limit: -5 })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('limit'),
    });
  });

  it('throws INVALID_PARAMS for zero limit', async () => {
    const ctx = createContext();

    await expect(handleSearch(ctx, { query: 'test', limit: 0 })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('limit'),
    });
  });

  it('throws INVALID_PARAMS for negative string limit', async () => {
    const ctx = createContext();

    await expect(handleSearch(ctx, { query: 'test', limit: '-5' })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('limit'),
    });
  });
});

describe('handleGetNode', () => {
  it('returns null for missing node', async () => {
    const ctx = createContext();

    const result = await handleGetNode(ctx, { id: 'missing.md' });

    expect(result).toBeNull();
  });

  it('returns NodeResponse for depth 0', async () => {
    const node = createNode();
    const ctx = createContext();
    (ctx.core.getNode as ReturnType<typeof vi.fn>).mockResolvedValue(node);

    const result = await handleGetNode(ctx, { id: 'test.md', depth: 0 });

    expect(result).toMatchObject({
      id: 'test.md',
      title: 'Test Node',
    });
    expect(result).not.toHaveProperty('incomingNeighbors');
  });

  it('returns NodeWithContextResponse for depth 1', async () => {
    const node = createNode();
    const incoming = [createNode({ id: 'in.md', title: 'Incoming' })];
    const outgoing = [createNode({ id: 'out.md', title: 'Outgoing' })];
    const ctx = createContext();
    (ctx.core.getNode as ReturnType<typeof vi.fn>).mockResolvedValue(node);
    (ctx.core.getNeighbors as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(incoming)
      .mockResolvedValueOnce(outgoing);

    const result = await handleGetNode(ctx, { id: 'test.md', depth: 1 });

    expect(result).toHaveProperty('incomingNeighbors');
    expect(result).toHaveProperty('outgoingNeighbors');
    expect((result as { incomingCount: number }).incomingCount).toBe(1);
    expect((result as { outgoingCount: number }).outgoingCount).toBe(1);
  });

  it('throws INVALID_PARAMS when id missing', async () => {
    const ctx = createContext();

    await expect(handleGetNode(ctx, {})).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
    });
  });

  it('defaults to depth 0', async () => {
    const node = createNode();
    const ctx = createContext();
    (ctx.core.getNode as ReturnType<typeof vi.fn>).mockResolvedValue(node);

    const result = await handleGetNode(ctx, { id: 'test.md' });

    expect(result).not.toHaveProperty('incomingNeighbors');
  });

  it('coerces string depth "1" to number 1', async () => {
    const node = createNode();
    const incoming = [createNode({ id: 'in.md', title: 'Incoming' })];
    const outgoing = [createNode({ id: 'out.md', title: 'Outgoing' })];
    const ctx = createContext();
    (ctx.core.getNode as ReturnType<typeof vi.fn>).mockResolvedValue(node);
    (ctx.core.getNeighbors as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(incoming)
      .mockResolvedValueOnce(outgoing);

    const result = await handleGetNode(ctx, { id: 'test.md', depth: '1' });

    expect(result).toHaveProperty('incomingNeighbors');
    expect(result).toHaveProperty('outgoingNeighbors');
  });

  it('coerces string depth "0" to number 0', async () => {
    const node = createNode();
    const ctx = createContext();
    (ctx.core.getNode as ReturnType<typeof vi.fn>).mockResolvedValue(node);

    const result = await handleGetNode(ctx, { id: 'test.md', depth: '0' });

    expect(result).not.toHaveProperty('incomingNeighbors');
  });

  it('uses default depth 0 for NaN input', async () => {
    const node = createNode();
    const ctx = createContext();
    (ctx.core.getNode as ReturnType<typeof vi.fn>).mockResolvedValue(node);

    const result = await handleGetNode(ctx, { id: 'test.md', depth: 'abc' });

    expect(result).not.toHaveProperty('incomingNeighbors');
  });

  it('throws INVALID_PARAMS for non-string id', async () => {
    const ctx = createContext();

    await expect(handleGetNode(ctx, { id: 123 })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('string'),
    });
  });

  it('truncates neighbors to max 20 in context response', async () => {
    const node = createNode();
    // Create 25 incoming and 30 outgoing neighbors
    const incoming = Array.from({ length: 25 }, (_, i) =>
      createNode({ id: `in-${i}.md`, title: `Incoming ${i}` })
    );
    const outgoing = Array.from({ length: 30 }, (_, i) =>
      createNode({ id: `out-${i}.md`, title: `Outgoing ${i}` })
    );
    const ctx = createContext();
    (ctx.core.getNode as ReturnType<typeof vi.fn>).mockResolvedValue(node);
    (ctx.core.getNeighbors as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(incoming)
      .mockResolvedValueOnce(outgoing);

    const result = await handleGetNode(ctx, { id: 'test.md', depth: 1 });

    // Response should truncate neighbors to 20 but report full counts
    const contextResult = result as {
      incomingNeighbors: unknown[];
      outgoingNeighbors: unknown[];
      incomingCount: number;
      outgoingCount: number;
    };
    expect(contextResult.incomingNeighbors).toHaveLength(20);
    expect(contextResult.outgoingNeighbors).toHaveLength(20);
    expect(contextResult.incomingCount).toBe(25);
    expect(contextResult.outgoingCount).toBe(30);
  });
});

describe('handleGetNeighbors', () => {
  it('returns neighbors as NodeResponse[]', async () => {
    const neighbors = [createNode({ id: 'n.md' })];
    const ctx = createContext();
    (ctx.core.getNeighbors as ReturnType<typeof vi.fn>).mockResolvedValue(neighbors);

    const result = await handleGetNeighbors(ctx, { id: 'test.md' });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('n.md');
  });

  it('excludes content by default (metadata-only)', async () => {
    const neighbors = [createNode({ id: 'n.md', content: 'Should not appear' })];
    const ctx = createContext();
    (ctx.core.getNeighbors as ReturnType<typeof vi.fn>).mockResolvedValue(neighbors);

    const result = await handleGetNeighbors(ctx, { id: 'test.md' });

    expect(result[0]).not.toHaveProperty('content');
    expect(result[0]?.id).toBe('n.md');
    expect(result[0]?.title).toBe('Test Node');
    expect(result[0]?.tags).toEqual(['tag1']);
  });

  it('includes content when include_content is true', async () => {
    const neighbors = [createNode({ id: 'n.md', content: 'This should appear' })];
    const ctx = createContext();
    (ctx.core.getNeighbors as ReturnType<typeof vi.fn>).mockResolvedValue(neighbors);

    const result = await handleGetNeighbors(ctx, { id: 'test.md', include_content: true });

    expect(result[0]?.content).toBe('This should appear');
  });

  it('uses default direction both and limit 20', async () => {
    const ctx = createContext();
    (ctx.core.getNeighbors as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await handleGetNeighbors(ctx, { id: 'test.md' });

    expect(ctx.core.getNeighbors).toHaveBeenCalledWith('test.md', {
      direction: 'both',
      limit: 20,
    });
  });

  it('passes direction and limit', async () => {
    const ctx = createContext();
    (ctx.core.getNeighbors as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await handleGetNeighbors(ctx, { id: 'test.md', direction: 'in', limit: 5 });

    expect(ctx.core.getNeighbors).toHaveBeenCalledWith('test.md', {
      direction: 'in',
      limit: 5,
    });
  });

  it('throws INVALID_PARAMS when id missing', async () => {
    const ctx = createContext();

    await expect(handleGetNeighbors(ctx, {})).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
    });
  });

  it('throws INVALID_PARAMS for non-string id', async () => {
    const ctx = createContext();

    await expect(handleGetNeighbors(ctx, { id: 123 })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('string'),
    });
  });

  it('throws INVALID_PARAMS for invalid direction', async () => {
    const ctx = createContext();

    await expect(
      handleGetNeighbors(ctx, { id: 'test.md', direction: 'sideways' })
    ).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('direction'),
    });
  });

  it('propagates unexpected errors from core.getNeighbors', async () => {
    const ctx = createContext();
    (ctx.core.getNeighbors as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Database connection failed')
    );

    await expect(handleGetNeighbors(ctx, { id: 'test.md' })).rejects.toThrow(
      'Database connection failed'
    );
  });

  it('throws INVALID_PARAMS for negative limit', async () => {
    const ctx = createContext();

    await expect(
      handleGetNeighbors(ctx, { id: 'test.md', limit: -1 })
    ).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('limit'),
    });
  });

  it('throws INVALID_PARAMS for zero limit', async () => {
    const ctx = createContext();

    await expect(
      handleGetNeighbors(ctx, { id: 'test.md', limit: 0 })
    ).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('limit'),
    });
  });
});

describe('handleFindPath', () => {
  it('returns PathResponse when path exists', async () => {
    const ctx = createContext();
    (ctx.core.findPath as ReturnType<typeof vi.fn>).mockResolvedValue([
      'a.md',
      'b.md',
      'c.md',
    ]);

    const result = await handleFindPath(ctx, { source: 'a.md', target: 'c.md' });

    expect(result).toEqual({
      path: ['a.md', 'b.md', 'c.md'],
      length: 2,
    });
  });

  it('returns null when no path exists', async () => {
    const ctx = createContext();

    const result = await handleFindPath(ctx, { source: 'a.md', target: 'z.md' });

    expect(result).toBeNull();
  });

  it('throws INVALID_PARAMS when source missing', async () => {
    const ctx = createContext();

    await expect(handleFindPath(ctx, { target: 'b.md' })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
    });
  });

  it('throws INVALID_PARAMS when target missing', async () => {
    const ctx = createContext();

    await expect(handleFindPath(ctx, { source: 'a.md' })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
    });
  });

  it('throws INVALID_PARAMS for non-string source', async () => {
    const ctx = createContext();

    await expect(handleFindPath(ctx, { source: 123, target: 'b.md' })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('string'),
    });
  });

  it('throws INVALID_PARAMS for non-string target', async () => {
    const ctx = createContext();

    await expect(handleFindPath(ctx, { source: 'a.md', target: 456 })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('string'),
    });
  });

  it('propagates unexpected errors from core.findPath', async () => {
    const ctx = createContext();
    (ctx.core.findPath as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Graph traversal failed')
    );

    await expect(
      handleFindPath(ctx, { source: 'a.md', target: 'b.md' })
    ).rejects.toThrow('Graph traversal failed');
  });
});

describe('handleGetHubs', () => {
  it('returns HubResponse[]', async () => {
    const hubs: Array<[string, number]> = [
      ['hub.md', 45],
      ['other.md', 30],
    ];
    const titleMap = new Map([
      ['hub.md', 'Hub Node'],
      ['other.md', 'Other Node'],
    ]);
    const ctx = createContext({ store: createMockStore(titleMap) });
    (ctx.core.getHubs as ReturnType<typeof vi.fn>).mockResolvedValue(hubs);

    const result = await handleGetHubs(ctx, {});

    expect(result).toEqual([
      { id: 'hub.md', title: 'Hub Node', score: 45 },
      { id: 'other.md', title: 'Other Node', score: 30 },
    ]);
  });

  it('uses default metric in_degree and limit 10', async () => {
    const ctx = createContext();
    (ctx.core.getHubs as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await handleGetHubs(ctx, {});

    expect(ctx.core.getHubs).toHaveBeenCalledWith('in_degree', 10);
  });

  it('passes metric and limit', async () => {
    const ctx = createContext();
    (ctx.core.getHubs as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await handleGetHubs(ctx, { metric: 'out_degree', limit: 5 });

    expect(ctx.core.getHubs).toHaveBeenCalledWith('out_degree', 5);
  });

  it('throws INVALID_PARAMS for invalid metric', async () => {
    const ctx = createContext();

    await expect(
      handleGetHubs(ctx, { metric: 'betweenness' })
    ).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('metric'),
    });
  });

  it('propagates unexpected errors from core.getHubs', async () => {
    const ctx = createContext();
    (ctx.core.getHubs as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Hub calculation failed')
    );

    await expect(handleGetHubs(ctx, {})).rejects.toThrow('Hub calculation failed');
  });

  it('throws INVALID_PARAMS for negative limit', async () => {
    const ctx = createContext();

    await expect(handleGetHubs(ctx, { limit: -10 })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('limit'),
    });
  });

  it('throws INVALID_PARAMS for zero limit', async () => {
    const ctx = createContext();

    await expect(handleGetHubs(ctx, { limit: 0 })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('limit'),
    });
  });
});

describe('handleSearchByTags', () => {
  it('returns NodeResponse[]', async () => {
    const nodes = [createNode({ tags: ['match'] })];
    const ctx = createContext();
    (ctx.core.searchByTags as ReturnType<typeof vi.fn>).mockResolvedValue(nodes);

    const result = await handleSearchByTags(ctx, { tags: ['match'] });

    expect(result).toHaveLength(1);
  });

  it('uses default mode any and limit 20', async () => {
    const ctx = createContext();
    (ctx.core.searchByTags as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await handleSearchByTags(ctx, { tags: ['tag'] });

    expect(ctx.core.searchByTags).toHaveBeenCalledWith(['tag'], 'any', 20);
  });

  it('passes mode and limit', async () => {
    const ctx = createContext();
    (ctx.core.searchByTags as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await handleSearchByTags(ctx, { tags: ['a', 'b'], mode: 'all', limit: 5 });

    expect(ctx.core.searchByTags).toHaveBeenCalledWith(['a', 'b'], 'all', 5);
  });

  it('throws INVALID_PARAMS when tags missing', async () => {
    const ctx = createContext();

    await expect(handleSearchByTags(ctx, {})).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
    });
  });

  it('throws INVALID_PARAMS when tags empty', async () => {
    const ctx = createContext();

    await expect(handleSearchByTags(ctx, { tags: [] })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
    });
  });

  it('throws INVALID_PARAMS when tags contain non-strings', async () => {
    const ctx = createContext();

    await expect(
      handleSearchByTags(ctx, { tags: [123, null, 'valid'] })
    ).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('only strings'),
    });
  });

  it('throws INVALID_PARAMS for invalid mode', async () => {
    const ctx = createContext();

    await expect(
      handleSearchByTags(ctx, { tags: ['test'], mode: 'none' })
    ).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('mode'),
    });
  });

  it('throws INVALID_PARAMS for negative limit', async () => {
    const ctx = createContext();

    await expect(
      handleSearchByTags(ctx, { tags: ['test'], limit: -5 })
    ).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('limit'),
    });
  });

  it('throws INVALID_PARAMS for zero limit', async () => {
    const ctx = createContext();

    await expect(
      handleSearchByTags(ctx, { tags: ['test'], limit: 0 })
    ).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('limit'),
    });
  });
});

describe('handleRandomNode', () => {
  it('returns NodeResponse when found', async () => {
    const node = createNode();
    const ctx = createContext();
    (ctx.core.getRandomNode as ReturnType<typeof vi.fn>).mockResolvedValue(node);

    const result = await handleRandomNode(ctx, {});

    expect(result).toMatchObject({ id: 'test.md' });
  });

  it('returns null when no nodes exist', async () => {
    const ctx = createContext();

    const result = await handleRandomNode(ctx, {});

    expect(result).toBeNull();
  });

  it('passes tags filter', async () => {
    const ctx = createContext();
    (ctx.core.getRandomNode as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await handleRandomNode(ctx, { tags: ['idea'] });

    expect(ctx.core.getRandomNode).toHaveBeenCalledWith(['idea']);
  });

  it('throws INVALID_PARAMS when tags contain non-strings', async () => {
    const ctx = createContext();

    await expect(
      handleRandomNode(ctx, { tags: [123, 'valid'] })
    ).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('only strings'),
    });
  });
});

describe('handleCreateNode', () => {
  // Core behavior tests
  it('creates node at exact ID path (lowercased)', async () => {
    const created = createNode({ id: 'notes/my note.md', title: 'My Note' });
    const ctx = createContext();
    (ctx.core.createNode as ReturnType<typeof vi.fn>).mockResolvedValue(created);

    const result = await handleCreateNode(ctx, {
      id: 'notes/My Note.md',
      content: 'Hello',
    });

    expect(result.id).toBe('notes/my note.md');
    expect(ctx.core.createNode).toHaveBeenCalledWith({
      id: 'notes/my note.md',
      title: 'My Note',
      content: 'Hello',
      tags: [],
    });
  });

  it('derives title from filename when not provided', async () => {
    const created = createNode({
      id: 'graph/ingredients/sesame oil.md',
      title: 'Sesame Oil',
    });
    const ctx = createContext();
    (ctx.core.createNode as ReturnType<typeof vi.fn>).mockResolvedValue(created);

    const result = await handleCreateNode(ctx, {
      id: 'graph/Ingredients/Sesame Oil.md',
      content: 'A fragrant oil',
    });

    expect(result.title).toBe('Sesame Oil');
    expect(ctx.core.createNode).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Sesame Oil' })
    );
  });

  it('uses explicit title when provided', async () => {
    const created = createNode({
      id: 'notes/abbrev.md',
      title: 'Full Descriptive Title',
    });
    const ctx = createContext();
    (ctx.core.createNode as ReturnType<typeof vi.fn>).mockResolvedValue(created);

    const result = await handleCreateNode(ctx, {
      id: 'notes/abbrev.md',
      title: 'Full Descriptive Title',
      content: 'Content here',
    });

    expect(result.title).toBe('Full Descriptive Title');
    expect(ctx.core.createNode).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Full Descriptive Title' })
    );
  });

  it('normalizes ID case consistently', async () => {
    const created = createNode({ id: 'folder/note.md', title: 'NOTE' });
    const ctx = createContext();
    (ctx.core.createNode as ReturnType<typeof vi.fn>).mockResolvedValue(created);

    await handleCreateNode(ctx, { id: 'FOLDER/NOTE.MD', content: '' });

    expect(ctx.core.createNode).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'folder/note.md' })
    );
  });

  it('passes valid tags to core.createNode', async () => {
    const created = createNode({
      id: 'tagged.md',
      title: 'tagged',
      tags: ['idea', 'important'],
    });
    const ctx = createContext();
    (ctx.core.createNode as ReturnType<typeof vi.fn>).mockResolvedValue(created);

    const result = await handleCreateNode(ctx, {
      id: 'tagged.md',
      content: 'Content',
      tags: ['idea', 'important'],
    });

    expect(result.tags).toEqual(['idea', 'important']);
    expect(ctx.core.createNode).toHaveBeenCalledWith({
      id: 'tagged.md',
      title: 'tagged',
      content: 'Content',
      tags: ['idea', 'important'],
    });
  });

  it('creates nested directories that do not exist', async () => {
    const created = createNode({
      id: 'deep/nested/path/note.md',
      title: 'note',
    });
    const ctx = createContext();
    (ctx.core.createNode as ReturnType<typeof vi.fn>).mockResolvedValue(created);

    const result = await handleCreateNode(ctx, {
      id: 'deep/nested/path/note.md',
      content: '',
    });

    expect(result.id).toBe('deep/nested/path/note.md');
  });

  it('throws NODE_EXISTS when node exists', async () => {
    const existing = createNode({ id: 'existing.md' });
    const ctx = createContext();
    (ctx.core.getNode as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

    await expect(
      handleCreateNode(ctx, { id: 'existing.md', content: 'Content' })
    ).rejects.toMatchObject({ code: 'NODE_EXISTS' });
  });

  // Validation tests
  it('rejects empty id', async () => {
    const ctx = createContext();

    await expect(
      handleCreateNode(ctx, { id: '', content: 'Content' })
    ).rejects.toMatchObject({ code: 'INVALID_PARAMS' });
  });

  it('rejects missing id', async () => {
    const ctx = createContext();

    await expect(
      handleCreateNode(ctx, { content: 'Content' })
    ).rejects.toMatchObject({ code: 'INVALID_PARAMS' });
  });

  it('rejects id without .md extension', async () => {
    const ctx = createContext();

    await expect(
      handleCreateNode(ctx, { id: 'notes/file', content: '' })
    ).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringMatching(/must end with \.md/i),
    });
  });

  it('rejects id with wrong extension (.txt)', async () => {
    const ctx = createContext();

    await expect(
      handleCreateNode(ctx, { id: 'notes/file.txt', content: '' })
    ).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringMatching(/must end with \.md/i),
    });
  });

  it('throws INVALID_PARAMS when content missing', async () => {
    const ctx = createContext();

    await expect(
      handleCreateNode(ctx, { id: 'test.md' })
    ).rejects.toMatchObject({ code: 'INVALID_PARAMS' });
  });

  it('throws INVALID_PARAMS when tags contain non-strings', async () => {
    const ctx = createContext();

    await expect(
      handleCreateNode(ctx, { id: 'test.md', content: 'x', tags: [123, 'valid'] })
    ).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('only strings'),
    });
  });

  it('throws INVALID_PARAMS when tags contain null', async () => {
    const ctx = createContext();

    await expect(
      handleCreateNode(ctx, { id: 'test.md', content: 'x', tags: [null, 'valid'] })
    ).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('only strings'),
    });
  });

  it('propagates path traversal error from core', async () => {
    const ctx = createContext();
    (ctx.core.createNode as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Path traversal detected: ../escape/test.md resolves outside source root')
    );

    await expect(
      handleCreateNode(ctx, { id: '../escape/test.md', content: 'x' })
    ).rejects.toThrow(/outside.*source/i);
  });

  it('derives title from original case, not lowercased ID', async () => {
    const created = createNode({
      id: 'notes/my title here.md',
      title: 'My Title Here',
    });
    const ctx = createContext();
    (ctx.core.createNode as ReturnType<typeof vi.fn>).mockResolvedValue(created);

    const result = await handleCreateNode(ctx, {
      id: 'notes/My Title Here.md',
      content: '',
    });

    // ID is lowercased
    expect(result.id).toBe('notes/my title here.md');
    // Title preserves original case
    expect(result.title).toBe('My Title Here');
  });
});

describe('handleUpdateNode', () => {
  it('updates node and returns NodeResponse', async () => {
    const existing = createNode();
    const updated = { ...existing, content: 'Updated' };
    const ctx = createContext();
    (ctx.core.getNode as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
    (ctx.core.updateNode as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

    const result = await handleUpdateNode(ctx, {
      id: 'test.md',
      content: 'Updated',
    });

    expect(result.content).toBe('Updated');
  });

  it('throws NODE_NOT_FOUND when node missing', async () => {
    const ctx = createContext();

    await expect(
      handleUpdateNode(ctx, { id: 'missing.md', content: 'Updated' })
    ).rejects.toMatchObject({ code: 'NODE_NOT_FOUND' });
  });

  it('throws LINK_INTEGRITY when title change with incoming links', async () => {
    const existing = createNode();
    const incoming = [createNode({ id: 'linker.md' })];
    const ctx = createContext();
    (ctx.core.getNode as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
    (ctx.core.getNeighbors as ReturnType<typeof vi.fn>).mockResolvedValue(incoming);

    await expect(
      handleUpdateNode(ctx, { id: 'test.md', title: 'New Title' })
    ).rejects.toMatchObject({ code: 'LINK_INTEGRITY' });
  });

  it('allows title change without incoming links', async () => {
    const existing = createNode();
    const updated = { ...existing, title: 'New Title' };
    const ctx = createContext();
    (ctx.core.getNode as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
    (ctx.core.getNeighbors as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (ctx.core.updateNode as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

    const result = await handleUpdateNode(ctx, {
      id: 'test.md',
      title: 'New Title',
    });

    expect(result.title).toBe('New Title');
  });

  it('allows same title (no actual change)', async () => {
    const existing = createNode({ title: 'Same' });
    const ctx = createContext();
    (ctx.core.getNode as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
    (ctx.core.updateNode as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

    const result = await handleUpdateNode(ctx, {
      id: 'test.md',
      title: 'Same',
    });

    expect(result.title).toBe('Same');
    expect(ctx.core.getNeighbors).not.toHaveBeenCalled();
  });

  it('updates only tags', async () => {
    const existing = createNode({ tags: ['old'] });
    const updated = { ...existing, tags: ['new'] };
    const ctx = createContext();
    (ctx.core.getNode as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
    (ctx.core.updateNode as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

    const result = await handleUpdateNode(ctx, {
      id: 'test.md',
      tags: ['new'],
    });

    expect(result.tags).toEqual(['new']);
    expect(ctx.core.updateNode).toHaveBeenCalledWith('test.md', { tags: ['new'] });
  });

  it('throws INVALID_PARAMS when id missing', async () => {
    const ctx = createContext();

    await expect(
      handleUpdateNode(ctx, { content: 'Updated' })
    ).rejects.toMatchObject({ code: 'INVALID_PARAMS' });
  });

  it('throws INVALID_PARAMS for non-string id', async () => {
    const ctx = createContext();

    await expect(
      handleUpdateNode(ctx, { id: 123, content: 'Updated' })
    ).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('string'),
    });
  });

  it('throws INVALID_PARAMS when no updates provided', async () => {
    const ctx = createContext();

    await expect(handleUpdateNode(ctx, { id: 'test.md' })).rejects.toMatchObject(
      { code: 'INVALID_PARAMS' }
    );
  });

  it('throws INVALID_PARAMS when tags contain non-strings', async () => {
    const existing = createNode();
    const ctx = createContext();
    (ctx.core.getNode as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

    await expect(
      handleUpdateNode(ctx, { id: 'test.md', tags: [123, null] })
    ).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('only strings'),
    });
  });

  it('accepts valid string tags array', async () => {
    const existing = createNode({ tags: ['old'] });
    const updated = { ...existing, tags: ['valid', 'tags'] };
    const ctx = createContext();
    (ctx.core.getNode as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
    (ctx.core.updateNode as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

    const result = await handleUpdateNode(ctx, {
      id: 'test.md',
      tags: ['valid', 'tags'],
    });

    expect(result.tags).toEqual(['valid', 'tags']);
  });

  it('propagates error when core.updateNode throws after validation', async () => {
    const existing = createNode();
    const ctx = createContext();
    (ctx.core.getNode as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
    (ctx.core.updateNode as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Database write failed')
    );

    await expect(
      handleUpdateNode(ctx, { id: 'test.md', content: 'Updated' })
    ).rejects.toThrow('Database write failed');
  });
});

describe('handleDeleteNode', () => {
  it('returns deleted: true on success', async () => {
    const ctx = createContext();
    (ctx.core.deleteNode as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const result = await handleDeleteNode(ctx, { id: 'test.md' });

    expect(result).toEqual({ deleted: true });
  });

  it('returns deleted: false when not found', async () => {
    const ctx = createContext();

    const result = await handleDeleteNode(ctx, { id: 'missing.md' });

    expect(result).toEqual({ deleted: false });
  });

  it('throws INVALID_PARAMS when id missing', async () => {
    const ctx = createContext();

    await expect(handleDeleteNode(ctx, {})).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
    });
  });

  it('throws INVALID_PARAMS for non-string id', async () => {
    const ctx = createContext();

    await expect(handleDeleteNode(ctx, { id: 123 })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('string'),
    });
  });
});

describe('sanitizeFilename', () => {
  it('converts to lowercase', () => {
    expect(sanitizeFilename('Hello World')).toBe('hello-world');
  });

  it('replaces spaces with hyphens', () => {
    expect(sanitizeFilename('one two three')).toBe('one-two-three');
  });

  it('removes special characters', () => {
    expect(sanitizeFilename('Hello! World?')).toBe('hello-world');
  });

  it('collapses multiple hyphens', () => {
    expect(sanitizeFilename('hello   world')).toBe('hello-world');
  });

  it('handles numbers', () => {
    expect(sanitizeFilename('Note 123')).toBe('note-123');
  });

  it('returns untitled when only special characters', () => {
    expect(sanitizeFilename('!!!')).toBe('untitled');
    expect(sanitizeFilename('@#$%')).toBe('untitled');
  });

  it('returns untitled for empty string', () => {
    expect(sanitizeFilename('')).toBe('untitled');
  });

  it('returns untitled for whitespace-only input', () => {
    expect(sanitizeFilename('   ')).toBe('untitled');
  });

  it('returns untitled for unicode-only input', () => {
    expect(sanitizeFilename('\u4e2d\u6587')).toBe('untitled');
    expect(sanitizeFilename('\u{1F600}')).toBe('untitled');
  });
});

describe('deriveTitle', () => {
  it('extracts filename without .md extension', () => {
    expect(deriveTitle('notes/My Note.md')).toBe('My Note');
  });

  it('handles deeply nested paths', () => {
    expect(deriveTitle('a/b/c/d/File Name.md')).toBe('File Name');
  });

  it('handles root-level files', () => {
    expect(deriveTitle('Simple.md')).toBe('Simple');
  });

  it('is case-insensitive for .md extension', () => {
    expect(deriveTitle('Note.MD')).toBe('Note');
    expect(deriveTitle('Note.Md')).toBe('Note');
  });

  it('returns Untitled for empty path', () => {
    expect(deriveTitle('')).toBe('Untitled');
  });

  it('preserves spaces and special characters in filename', () => {
    expect(deriveTitle("notes/Tom's Recipe (Draft).md")).toBe("Tom's Recipe (Draft)");
  });

  it('handles double extension gracefully', () => {
    expect(deriveTitle('notes/file.md.md')).toBe('file.md');
  });

  it('handles dot-prefixed filename', () => {
    expect(deriveTitle('notes/.hidden.md')).toBe('.hidden');
  });

  it('returns Untitled for all-special-char filename', () => {
    expect(deriveTitle('notes/!!!.md')).toBe('Untitled');
  });

  it('returns Untitled for empty filename', () => {
    expect(deriveTitle('notes/.md')).toBe('Untitled');
  });
});

describe('handleListNodes', () => {
  it('returns array of NodeSummary objects', async () => {
    const summaries = [
      { id: 'a.md', title: 'A' },
      { id: 'b.md', title: 'B' },
    ];
    const ctx = createContext();
    (ctx.core.listNodes as ReturnType<typeof vi.fn>).mockResolvedValue({
      nodes: summaries,
      total: 2,
    });

    const { handleListNodes } = await import('../../../src/mcp/handlers.js');
    const result = await handleListNodes(ctx, {});

    expect(result).toEqual({
      nodes: summaries,
      total: 2,
    });
  });

  it('returns total count of all matching nodes, not just returned slice', async () => {
    const returnedPage = [
      { id: 'a.md', title: 'A' },
      { id: 'b.md', title: 'B' },
    ];
    const ctx = createContext();
    // 50 total matching nodes, but only 2 returned due to limit
    (ctx.core.listNodes as ReturnType<typeof vi.fn>).mockResolvedValue({
      nodes: returnedPage,
      total: 50,
    });

    const { handleListNodes } = await import('../../../src/mcp/handlers.js');
    const result = await handleListNodes(ctx, { limit: 2 });

    expect(result.nodes).toHaveLength(2);
    expect(result.total).toBe(50); // Total matching, not slice length
  });

  it('passes filter and options to core', async () => {
    const ctx = createContext();
    (ctx.core.listNodes as ReturnType<typeof vi.fn>).mockResolvedValue({
      nodes: [],
      total: 0,
    });

    const { handleListNodes } = await import('../../../src/mcp/handlers.js');
    await handleListNodes(ctx, {
      tag: 'recipe',
      path: 'notes/',
      limit: 50,
      offset: 10,
    });

    expect(ctx.core.listNodes).toHaveBeenCalledWith(
      { tag: 'recipe', path: 'notes/' },
      { limit: 50, offset: 10 }
    );
  });

  it('uses default limit 100', async () => {
    const ctx = createContext();
    (ctx.core.listNodes as ReturnType<typeof vi.fn>).mockResolvedValue({
      nodes: [],
      total: 0,
    });

    const { handleListNodes } = await import('../../../src/mcp/handlers.js');
    await handleListNodes(ctx, {});

    expect(ctx.core.listNodes).toHaveBeenCalledWith({}, { limit: 100, offset: 0 });
  });

  it('throws INVALID_PARAMS for negative limit', async () => {
    const ctx = createContext();

    const { handleListNodes } = await import('../../../src/mcp/handlers.js');
    await expect(handleListNodes(ctx, { limit: -10 })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('limit'),
    });
  });

  it('throws INVALID_PARAMS for zero limit', async () => {
    const ctx = createContext();

    const { handleListNodes } = await import('../../../src/mcp/handlers.js');
    await expect(handleListNodes(ctx, { limit: 0 })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('limit'),
    });
  });

  it('throws INVALID_PARAMS for negative offset', async () => {
    const ctx = createContext();

    const { handleListNodes } = await import('../../../src/mcp/handlers.js');
    await expect(handleListNodes(ctx, { offset: -1 })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('offset'),
    });
  });

  it('throws INVALID_PARAMS for large negative offset', async () => {
    const ctx = createContext();

    const { handleListNodes } = await import('../../../src/mcp/handlers.js');
    await expect(handleListNodes(ctx, { offset: -100 })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('offset'),
    });
  });

  it('accepts zero offset explicitly', async () => {
    const ctx = createContext();
    (ctx.core.listNodes as ReturnType<typeof vi.fn>).mockResolvedValue({
      nodes: [],
      total: 0,
    });

    const { handleListNodes } = await import('../../../src/mcp/handlers.js');
    await handleListNodes(ctx, { offset: 0 });

    expect(ctx.core.listNodes).toHaveBeenCalledWith({}, { limit: 100, offset: 0 });
  });

  it('uses default offset 0 for NaN input', async () => {
    const ctx = createContext();
    (ctx.core.listNodes as ReturnType<typeof vi.fn>).mockResolvedValue({
      nodes: [],
      total: 0,
    });

    const { handleListNodes } = await import('../../../src/mcp/handlers.js');
    await handleListNodes(ctx, { offset: 'abc' });

    expect(ctx.core.listNodes).toHaveBeenCalledWith({}, { limit: 100, offset: 0 });
  });
});

describe('handleResolveNodes', () => {
  it('returns array of ResolveResult', async () => {
    const results = [
      { query: 'beef', match: 'ingredients/beef.md', score: 1 },
    ];
    const ctx = createContext();
    (ctx.core.resolveNodes as ReturnType<typeof vi.fn>).mockResolvedValue(results);

    const { handleResolveNodes } = await import('../../../src/mcp/handlers.js');
    const result = await handleResolveNodes(ctx, { names: ['beef'] });

    expect(result).toEqual(results);
  });

  it('throws INVALID_PARAMS when names missing', async () => {
    const ctx = createContext();

    const { handleResolveNodes } = await import('../../../src/mcp/handlers.js');
    await expect(handleResolveNodes(ctx, {})).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
    });
  });

  it('throws INVALID_PARAMS when names is not array', async () => {
    const ctx = createContext();

    const { handleResolveNodes } = await import('../../../src/mcp/handlers.js');
    await expect(handleResolveNodes(ctx, { names: 'beef' })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
    });
  });

  it('throws INVALID_PARAMS for invalid strategy', async () => {
    const ctx = createContext();

    const { handleResolveNodes } = await import('../../../src/mcp/handlers.js');
    await expect(
      handleResolveNodes(ctx, { names: ['beef'], strategy: 'magic' })
    ).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('strategy'),
    });
  });

  it('throws PROVIDER_ERROR for semantic without embedding', async () => {
    const ctx = createContext({ hasEmbedding: false });

    const { handleResolveNodes } = await import('../../../src/mcp/handlers.js');
    await expect(
      handleResolveNodes(ctx, { names: ['beef'], strategy: 'semantic' })
    ).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
    });
  });

  it('passes options to core', async () => {
    const ctx = createContext();
    (ctx.core.resolveNodes as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { handleResolveNodes } = await import('../../../src/mcp/handlers.js');
    await handleResolveNodes(ctx, {
      names: ['beef'],
      strategy: 'fuzzy',
      threshold: 0.8,
      tag: 'ingredient',
      path: 'food/',
    });

    expect(ctx.core.resolveNodes).toHaveBeenCalledWith(['beef'], {
      strategy: 'fuzzy',
      threshold: 0.8,
      tag: 'ingredient',
      path: 'food/',
    });
  });

  it('allows empty names array', async () => {
    const ctx = createContext();
    (ctx.core.resolveNodes as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { handleResolveNodes } = await import('../../../src/mcp/handlers.js');
    const result = await handleResolveNodes(ctx, { names: [] });

    expect(result).toEqual([]);
  });
});

describe('handleNodesExist', () => {
  it('returns object with boolean values', async () => {
    const map = new Map([
      ['a.md', true],
      ['b.md', false],
    ]);
    const ctx = createContext();
    (ctx.store.nodesExist as ReturnType<typeof vi.fn>).mockResolvedValue(map);

    const { handleNodesExist } = await import('../../../src/mcp/handlers.js');
    const result = await handleNodesExist(ctx, { ids: ['a.md', 'b.md'] });

    expect(result).toEqual({ 'a.md': true, 'b.md': false });
  });

  it('throws INVALID_PARAMS when ids missing', async () => {
    const ctx = createContext();

    const { handleNodesExist } = await import('../../../src/mcp/handlers.js');
    await expect(handleNodesExist(ctx, {})).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
    });
  });

  it('throws INVALID_PARAMS when ids is not array', async () => {
    const ctx = createContext();

    const { handleNodesExist } = await import('../../../src/mcp/handlers.js');
    await expect(handleNodesExist(ctx, { ids: 'a.md' })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
    });
  });

  it('allows empty ids array', async () => {
    const ctx = createContext();
    (ctx.store.nodesExist as ReturnType<typeof vi.fn>).mockResolvedValue(new Map());

    const { handleNodesExist } = await import('../../../src/mcp/handlers.js');
    const result = await handleNodesExist(ctx, { ids: [] });

    expect(result).toEqual({});
  });
});

describe('dispatchTool', () => {
  it('dispatches search tool', async () => {
    const ctx = createContext();
    (ctx.core.search as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await dispatchTool(ctx, 'search', { query: 'test' });

    expect(Array.isArray(result)).toBe(true);
  });

  it('dispatches get_node tool', async () => {
    const ctx = createContext();

    const result = await dispatchTool(ctx, 'get_node', { id: 'test.md' });

    expect(result).toBeNull();
  });

  it('dispatches get_neighbors tool', async () => {
    const ctx = createContext();
    (ctx.core.getNeighbors as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await dispatchTool(ctx, 'get_neighbors', { id: 'test.md' });

    expect(Array.isArray(result)).toBe(true);
  });

  it('dispatches find_path tool', async () => {
    const ctx = createContext();

    const result = await dispatchTool(ctx, 'find_path', {
      source: 'a.md',
      target: 'b.md',
    });

    expect(result).toBeNull();
  });

  it('dispatches get_hubs tool', async () => {
    const ctx = createContext();
    (ctx.core.getHubs as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await dispatchTool(ctx, 'get_hubs', {});

    expect(Array.isArray(result)).toBe(true);
  });

  it('dispatches search_by_tags tool', async () => {
    const ctx = createContext();
    (ctx.core.searchByTags as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await dispatchTool(ctx, 'search_by_tags', { tags: ['tag'] });

    expect(Array.isArray(result)).toBe(true);
  });

  it('dispatches random_node tool', async () => {
    const ctx = createContext();

    const result = await dispatchTool(ctx, 'random_node', {});

    expect(result).toBeNull();
  });

  it('dispatches create_node tool', async () => {
    const created = createNode();
    const ctx = createContext();
    (ctx.core.createNode as ReturnType<typeof vi.fn>).mockResolvedValue(created);

    const result = await dispatchTool(ctx, 'create_node', {
      id: 'test.md',
      content: 'Content',
    });

    expect(result).toMatchObject({ id: 'test.md' });
  });

  it('dispatches update_node tool', async () => {
    const existing = createNode();
    const ctx = createContext();
    (ctx.core.getNode as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
    (ctx.core.updateNode as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

    const result = await dispatchTool(ctx, 'update_node', {
      id: 'test.md',
      content: 'Updated',
    });

    expect(result).toMatchObject({ id: 'test.md' });
  });

  it('dispatches delete_node tool', async () => {
    const ctx = createContext();
    (ctx.core.deleteNode as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const result = await dispatchTool(ctx, 'delete_node', { id: 'test.md' });

    expect(result).toEqual({ deleted: true });
  });

  it('throws INVALID_PARAMS for unknown tool', async () => {
    const ctx = createContext();

    await expect(dispatchTool(ctx, 'unknown', {})).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
    });
  });

  it('dispatches list_nodes tool', async () => {
    const ctx = createContext();
    (ctx.core.listNodes as ReturnType<typeof vi.fn>).mockResolvedValue({
      nodes: [],
      total: 0,
    });

    const result = await dispatchTool(ctx, 'list_nodes', {});

    expect(result).toEqual({ nodes: [], total: 0 });
  });

  it('dispatches resolve_nodes tool', async () => {
    const ctx = createContext();
    (ctx.core.resolveNodes as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await dispatchTool(ctx, 'resolve_nodes', { names: [] });

    expect(Array.isArray(result)).toBe(true);
  });

  it('dispatches nodes_exist tool', async () => {
    const ctx = createContext();
    (ctx.store.nodesExist as ReturnType<typeof vi.fn>).mockResolvedValue(new Map());

    const result = await dispatchTool(ctx, 'nodes_exist', { ids: [] });

    expect(result).toEqual({});
  });
});

describe('coerceInt', () => {
  it('returns default for undefined', () => {
    expect(coerceInt(undefined, 10, 1, 'limit')).toBe(10);
  });

  it('returns default for null', () => {
    expect(coerceInt(null, 10, 1, 'limit')).toBe(10);
  });

  it('returns default for NaN string', () => {
    expect(coerceInt('abc', 10, 1, 'limit')).toBe(10);
  });

  it('coerces string to number', () => {
    expect(coerceInt('5', 10, 1, 'limit')).toBe(5);
  });

  it('floors float values', () => {
    expect(coerceInt(5.9, 10, 1, 'limit')).toBe(5);
  });

  it('throws McpError when below minimum', () => {
    expect(() => coerceInt(0, 10, 1, 'limit')).toThrow(McpError);
    expect(() => coerceInt(0, 10, 1, 'limit')).toThrow(/limit must be at least 1/);
  });

  it('throws McpError with field name in message', () => {
    expect(() => coerceInt(-5, 0, 0, 'offset')).toThrow(/offset must be at least 0/);
  });

  it('accepts value equal to minimum', () => {
    expect(coerceInt(1, 10, 1, 'limit')).toBe(1);
    expect(coerceInt(0, 10, 0, 'offset')).toBe(0);
  });

  it('accepts value greater than minimum', () => {
    expect(coerceInt(50, 10, 1, 'limit')).toBe(50);
  });
});
