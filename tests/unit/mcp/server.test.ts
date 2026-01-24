import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  McpServer,
  McpError,
  getToolDefinitions,
  createMcpServer,
} from '../../../src/mcp/index.js';
import type { GraphCore } from '../../../src/types/graphcore.js';
import type { StoreProvider } from '../../../src/types/provider.js';
import type { McpServerOptions, McpTransport } from '../../../src/mcp/server.js';

function createMockStore(): StoreProvider {
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

describe('McpServer', () => {
  let mockCore: GraphCore;
  let mockStore: StoreProvider;
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

    it('uses default stdio transport when no factory provided', () => {
      const server = new McpServer(options);
      // Verify start method exists and accepts optional factory
      expect(typeof server.start).toBe('function');
    });
  });
});

describe('createMcpServer', () => {
  let mockCore: GraphCore;
  let mockStore: StoreProvider;
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
  it('returns 9 tools without embedding', () => {
    const tools = getToolDefinitions(false);

    expect(tools).toHaveLength(9);
    expect(tools.map((t) => t.name)).not.toContain('search');
  });

  it('returns 10 tools with embedding', () => {
    const tools = getToolDefinitions(true);

    expect(tools).toHaveLength(10);
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
