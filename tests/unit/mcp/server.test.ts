import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  McpServer,
  McpError,
  getToolDefinitions,
  createMcpServer,
} from '../../../src/mcp/index.js';
import type { GraphCore } from '../../../src/types/graphcore.js';
import type { Store } from '../../../src/types/provider.js';
import type { McpServerOptions, McpTransport } from '../../../src/mcp/server.js';

// Mock StdioServerTransport for testing default transport path
vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

function createMockStore(): Store {
  return {
    resolveTitles: vi.fn().mockResolvedValue(new Map()),
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
    listNodes: vi.fn().mockResolvedValue([]),
    resolveNodes: vi.fn().mockResolvedValue([]),
    nodesExist: vi.fn().mockImplementation(async (ids: string[]) => {
      // Default: all nodes reported as non-existing
      // Tests that need specific existence should override this mock
      const result = new Map<string, boolean>();
      for (const id of ids) {
        result.set(id, false);
      }
      return result;
    }),
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
    listNodes: vi.fn().mockResolvedValue([]),
    resolveNodes: vi.fn().mockResolvedValue([]),
  };
}

// Capture the handlers registered with the MCP SDK Server
const capturedHandlers = new Map<unknown, (...args: unknown[]) => unknown>();

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(() => ({
    setRequestHandler: vi.fn((schema: unknown, handler: (...args: unknown[]) => unknown) => {
      capturedHandlers.set(schema, handler);
    }),
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('McpServer', () => {
  let mockCore: GraphCore;
  let mockStore: Store;
  let options: McpServerOptions;

  beforeEach(() => {
    capturedHandlers.clear();
    mockCore = createMockCore();
    mockStore = createMockStore();
    options = {
      core: mockCore,
      store: mockStore,
      hasEmbedding: true,
    };
  });

  describe('constructor', () => {
    it('creates server with provided options', () => {
      const server = new McpServer(options);
      expect(server).toBeInstanceOf(McpServer);
    });

    it('works without embedding provider', () => {
      options.hasEmbedding = false;
      const server = new McpServer(options);
      expect(server).toBeInstanceOf(McpServer);
    });
  });

  describe('setupHandlers', () => {
    it('registers ListTools handler that returns tool definitions', async () => {
      const { ListToolsRequestSchema } = await import(
        '@modelcontextprotocol/sdk/types.js'
      );
      new McpServer(options);

      const handler = capturedHandlers.get(ListToolsRequestSchema);
      expect(handler).toBeDefined();

      const result = await handler!();
      expect((result as { tools: unknown[] }).tools).toBeDefined();
      expect((result as { tools: unknown[] }).tools.length).toBeGreaterThan(0);
    });

    it('registers CallTool handler that dispatches and formats result', async () => {
      const { CallToolRequestSchema } = await import(
        '@modelcontextprotocol/sdk/types.js'
      );
      const mockNode = {
        id: 'test.md',
        title: 'Test',
        content: 'Content',
        tags: [],
        outgoingLinks: [],
        properties: {},
      };
      (mockCore.getNode as ReturnType<typeof vi.fn>).mockResolvedValue(mockNode);
      new McpServer(options);

      const handler = capturedHandlers.get(CallToolRequestSchema);
      expect(handler).toBeDefined();

      const result = await handler!({
        params: { name: 'get_node', arguments: { id: 'test.md' } },
      });

      expect((result as { content: unknown[] }).content).toBeDefined();
      const text = (result as { content: Array<{ text: string }> }).content[0]?.text;
      expect(JSON.parse(text ?? '{}').id).toBe('test.md');
    });

    it('CallTool handler defaults undefined arguments to empty object', async () => {
      const { CallToolRequestSchema } = await import(
        '@modelcontextprotocol/sdk/types.js'
      );
      new McpServer(options);

      const handler = capturedHandlers.get(CallToolRequestSchema);
      expect(handler).toBeDefined();

      // Call with undefined arguments - should use empty object fallback
      const result = await handler!({
        params: { name: 'random_node', arguments: undefined },
      });

      // random_node with no args should work (returns null from mock)
      expect((result as { content: unknown[] }).content).toBeDefined();
    });
  });

  describe('close', () => {
    it('closes server without error', async () => {
      const server = new McpServer(options);
      await expect(server.close()).resolves.not.toThrow();
    });
  });

  describe('start', () => {
    it('starts with custom transport factory', async () => {
      const server = new McpServer(options);
      // Mock transport with required start method
      const mockTransport = {
        start: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const factory = vi.fn().mockReturnValue(mockTransport);

      await server.start(factory);

      expect(factory).toHaveBeenCalled();
    });

    it('uses StdioServerTransport when no factory provided', async () => {
      const { StdioServerTransport } = await import(
        '@modelcontextprotocol/sdk/server/stdio.js'
      );
      const server = new McpServer(options);

      await server.start(); // No factory = use default

      expect(StdioServerTransport).toHaveBeenCalled();
    });
  });
});

describe('createMcpServer', () => {
  let mockCore: GraphCore;
  let mockStore: Store;
  let options: McpServerOptions;

  beforeEach(() => {
    mockCore = createMockCore();
    mockStore = createMockStore();
    options = {
      core: mockCore,
      store: mockStore,
      hasEmbedding: true,
    };
  });

  it('creates and starts server with custom transport', async () => {
    const mockTransport = {
      start: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const factory = vi.fn().mockReturnValue(mockTransport);

    const server = await createMcpServer(options, factory);

    expect(server).toBeInstanceOf(McpServer);
    expect(factory).toHaveBeenCalled();
  });
});

describe('getToolDefinitions', () => {
  it('returns 12 tools without embedding', () => {
    const tools = getToolDefinitions(false);

    expect(tools).toHaveLength(12);
    expect(tools.map((t) => t.name)).not.toContain('search');
  });

  it('returns 13 tools with embedding', () => {
    const tools = getToolDefinitions(true);

    expect(tools).toHaveLength(13);
    expect(tools.map((t) => t.name)).toContain('search');
  });

  it('search tool is first when embedding enabled', () => {
    const tools = getToolDefinitions(true);

    expect(tools[0]?.name).toBe('search');
  });

  it('includes all expected tools', () => {
    const tools = getToolDefinitions(true);
    const names = tools.map((t) => t.name);

    expect(names).toContain('get_node');
    expect(names).toContain('get_neighbors');
    expect(names).toContain('find_path');
    expect(names).toContain('get_hubs');
    expect(names).toContain('search_by_tags');
    expect(names).toContain('random_node');
    expect(names).toContain('create_node');
    expect(names).toContain('update_node');
    expect(names).toContain('delete_node');
    expect(names).toContain('list_nodes');
    expect(names).toContain('resolve_nodes');
    expect(names).toContain('nodes_exist');
  });

  it('tools have descriptions', () => {
    const tools = getToolDefinitions(true);

    for (const tool of tools) {
      expect(tool.description).toBeTruthy();
      expect(typeof tool.description).toBe('string');
    }
  });

  it('tools have input schemas', () => {
    const tools = getToolDefinitions(true);

    for (const tool of tools) {
      expect(tool.inputSchema).toBeTruthy();
      expect(tool.inputSchema.type).toBe('object');
    }
  });
});

describe('formatToolResponse', () => {
  it('wraps result in MCP content format', async () => {
    const { formatToolResponse } = await import('../../../src/mcp/server.js');
    const result = { nodes: [{ id: 'test.md' }], total: 1 };

    const response = formatToolResponse(result);

    expect(response).toEqual({
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    });
  });

  it('handles null result', async () => {
    const { formatToolResponse } = await import('../../../src/mcp/server.js');

    const response = formatToolResponse(null);

    expect(response.content[0]?.text).toBe('null');
  });

  it('handles primitive results', async () => {
    const { formatToolResponse } = await import('../../../src/mcp/server.js');

    expect(formatToolResponse(true).content[0]?.text).toBe('true');
    expect(formatToolResponse(42).content[0]?.text).toBe('42');
    expect(formatToolResponse('hello').content[0]?.text).toBe('"hello"');
  });
});

describe('formatErrorResponse', () => {
  it('formats McpError with isError flag', async () => {
    const { formatErrorResponse } = await import('../../../src/mcp/server.js');
    const { McpError } = await import('../../../src/mcp/types.js');
    const error = new McpError('NODE_NOT_FOUND', 'Node test.md not found');

    const response = formatErrorResponse(error);

    expect(response.isError).toBe(true);
    expect(JSON.parse(response.content[0]?.text ?? '{}')).toEqual({
      error: {
        code: 'NODE_NOT_FOUND',
        message: 'Node test.md not found',
      },
    });
  });

  it('wraps generic Error as PROVIDER_ERROR', async () => {
    const { formatErrorResponse } = await import('../../../src/mcp/server.js');
    const error = new Error('Database connection failed');

    const response = formatErrorResponse(error);

    expect(response.isError).toBe(true);
    expect(JSON.parse(response.content[0]?.text ?? '{}')).toEqual({
      error: {
        code: 'PROVIDER_ERROR',
        message: 'Database connection failed',
      },
    });
  });

  it('handles non-Error thrown values with Unknown error', async () => {
    const { formatErrorResponse } = await import('../../../src/mcp/server.js');

    const response = formatErrorResponse('string error');

    expect(response.isError).toBe(true);
    expect(JSON.parse(response.content[0]?.text ?? '{}')).toEqual({
      error: {
        code: 'PROVIDER_ERROR',
        message: 'Unknown error',
      },
    });
  });

  it('handles null thrown value', async () => {
    const { formatErrorResponse } = await import('../../../src/mcp/server.js');

    const response = formatErrorResponse(null);

    expect(response.isError).toBe(true);
    expect(JSON.parse(response.content[0]?.text ?? '{}').error.message).toBe(
      'Unknown error'
    );
  });

  it('handles undefined thrown value', async () => {
    const { formatErrorResponse } = await import('../../../src/mcp/server.js');

    const response = formatErrorResponse(undefined);

    expect(response.isError).toBe(true);
    expect(JSON.parse(response.content[0]?.text ?? '{}').error.message).toBe(
      'Unknown error'
    );
  });
});

describe('executeToolCall', () => {
  let mockCore: GraphCore;
  let mockStore: Store;
  let ctx: { core: GraphCore; store: Store; hasEmbedding: boolean; naming: { filename: string; title: string } };

  beforeEach(() => {
    mockCore = createMockCore();
    mockStore = createMockStore();
    ctx = { core: mockCore, store: mockStore, hasEmbedding: true, naming: { filename: 'space', title: 'title' } };
  });

  it('dispatches tool and formats successful result', async () => {
    const { executeToolCall } = await import('../../../src/mcp/server.js');
    const mockNode = {
      id: 'test.md',
      title: 'Test',
      content: 'Content',
      tags: [],
      outgoingLinks: [],
      properties: {},
    };
    (mockCore.getNode as ReturnType<typeof vi.fn>).mockResolvedValue(mockNode);

    const response = await executeToolCall(ctx, 'get_node', { id: 'test.md' });

    expect(response.isError).toBeUndefined();
    expect(response.content[0]?.type).toBe('text');
    const parsed = JSON.parse(response.content[0]?.text ?? '{}');
    expect(parsed.id).toBe('test.md');
  });

  it('formats McpError from handler', async () => {
    const { executeToolCall } = await import('../../../src/mcp/server.js');
    // create_node throws NODE_EXISTS when node already exists (uses core.getNode)
    (mockCore.getNode as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'test.md',
      title: 'Test',
      content: '',
      tags: [],
      outgoingLinks: [],
      properties: {},
    });

    const response = await executeToolCall(ctx, 'create_node', {
      id: 'test.md',
      content: 'Content',
    });

    expect(response.isError).toBe(true);
    const parsed = JSON.parse(response.content[0]?.text ?? '{}');
    expect(parsed.error.code).toBe('NODE_EXISTS');
  });

  it('formats generic Error as PROVIDER_ERROR', async () => {
    const { executeToolCall } = await import('../../../src/mcp/server.js');
    (mockCore.getNode as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Database crashed')
    );

    const response = await executeToolCall(ctx, 'get_node', { id: 'test.md' });

    expect(response.isError).toBe(true);
    const parsed = JSON.parse(response.content[0]?.text ?? '{}');
    expect(parsed.error.code).toBe('PROVIDER_ERROR');
    expect(parsed.error.message).toBe('Database crashed');
  });

  it('handles unknown tool name', async () => {
    const { executeToolCall } = await import('../../../src/mcp/server.js');

    const response = await executeToolCall(ctx, 'nonexistent_tool', {});

    expect(response.isError).toBe(true);
    const parsed = JSON.parse(response.content[0]?.text ?? '{}');
    expect(parsed.error.code).toBe('INVALID_PARAMS');
  });
});

describe('McpError', () => {
  it('creates error with INVALID_PARAMS code', () => {
    const error = new McpError('INVALID_PARAMS', 'Missing query');
    expect(error.code).toBe('INVALID_PARAMS');
    expect(error.message).toBe('Missing query');
  });

  it('creates error with NODE_EXISTS code', () => {
    const error = new McpError('NODE_EXISTS', 'Node already exists');
    expect(error.code).toBe('NODE_EXISTS');
  });

  it('creates error with NODE_NOT_FOUND code', () => {
    const error = new McpError('NODE_NOT_FOUND', 'Node not found');
    expect(error.code).toBe('NODE_NOT_FOUND');
  });

  it('creates error with LINK_INTEGRITY code', () => {
    const error = new McpError('LINK_INTEGRITY', 'Cannot rename');
    expect(error.code).toBe('LINK_INTEGRITY');
  });

  it('creates error with PROVIDER_ERROR code', () => {
    const error = new McpError('PROVIDER_ERROR', 'Database error');
    expect(error.code).toBe('PROVIDER_ERROR');
  });

  it('converts to error response format', () => {
    const error = new McpError('NODE_NOT_FOUND', 'Not found');
    const response = error.toResponse();

    expect(response).toEqual({
      error: {
        code: 'NODE_NOT_FOUND',
        message: 'Not found',
      },
    });
  });
});
