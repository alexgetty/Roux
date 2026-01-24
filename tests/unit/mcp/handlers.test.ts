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
  dispatchTool,
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
});

describe('handleCreateNode', () => {
  it('creates node and returns NodeResponse', async () => {
    const created = createNode({ id: 'new-node.md', title: 'New Node' });
    const ctx = createContext();
    (ctx.core.createNode as ReturnType<typeof vi.fn>).mockResolvedValue(created);

    const result = await handleCreateNode(ctx, {
      title: 'New Node',
      content: 'Content',
    });

    expect(result.id).toBe('new-node.md');
    expect(ctx.core.createNode).toHaveBeenCalledWith({
      id: 'new-node.md',
      title: 'New Node',
      content: 'Content',
      tags: [],
    });
  });

  it('includes directory in id', async () => {
    const created = createNode({ id: 'notes/new.md' });
    const ctx = createContext();
    (ctx.core.createNode as ReturnType<typeof vi.fn>).mockResolvedValue(created);

    await handleCreateNode(ctx, {
      title: 'New',
      content: 'Content',
      directory: 'notes',
    });

    expect(ctx.core.createNode).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'notes/new.md' })
    );
  });

  it('throws NODE_EXISTS when node exists', async () => {
    const existing = createNode();
    const ctx = createContext();
    (ctx.core.getNode as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

    await expect(
      handleCreateNode(ctx, { title: 'Test Node', content: 'Content' })
    ).rejects.toMatchObject({ code: 'NODE_EXISTS' });
  });

  it('throws INVALID_PARAMS when title missing', async () => {
    const ctx = createContext();

    await expect(
      handleCreateNode(ctx, { content: 'Content' })
    ).rejects.toMatchObject({ code: 'INVALID_PARAMS' });
  });

  it('throws INVALID_PARAMS when content missing', async () => {
    const ctx = createContext();

    await expect(
      handleCreateNode(ctx, { title: 'Title' })
    ).rejects.toMatchObject({ code: 'INVALID_PARAMS' });
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

  it('throws INVALID_PARAMS when no updates provided', async () => {
    const ctx = createContext();

    await expect(handleUpdateNode(ctx, { id: 'test.md' })).rejects.toMatchObject(
      { code: 'INVALID_PARAMS' }
    );
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

  it('returns empty string when only special characters', () => {
    expect(sanitizeFilename('!!!')).toBe('');
    expect(sanitizeFilename('@#$%')).toBe('');
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
      title: 'Test',
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
});
