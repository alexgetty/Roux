import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

import type { GraphCore } from '../types/graphcore.js';
import type { StoreProvider } from '../types/provider.js';
import { VERSION } from '../index.js';
import { McpError } from './types.js';
import { dispatchTool, type HandlerContext } from './handlers.js';

export interface McpServerOptions {
  /** GraphCore instance for operations */
  core: GraphCore;
  /** StoreProvider for link resolution and direct store access */
  store: StoreProvider;
  /** Whether embedding provider is available (enables search tool) */
  hasEmbedding: boolean;
}

/** MCP Transport interface for server connection. */
export interface McpTransport {
  start?(): Promise<void>;
  close?(): Promise<void>;
}

/** Factory function to create a transport. Defaults to StdioServerTransport. */
export type TransportFactory = () => McpTransport;

/** Tool input schemas as JSON Schema objects */
const TOOL_SCHEMAS = {
  search: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 50,
        default: 10,
        description: 'Maximum results to return',
      },
      include_content: {
        type: 'boolean',
        default: false,
        description:
          'Include node content in results. Default false returns metadata only (id, title, tags, properties, links). Set true to include truncated content.',
      },
    },
    required: ['query'],
  },

  get_node: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description:
          'Node ID (file path for DocStore). ID is normalized to lowercase (e.g., "Recipes/Bulgogi.md" becomes "recipes/bulgogi.md").',
      },
      depth: {
        type: 'integer',
        minimum: 0,
        maximum: 1,
        default: 0,
        description: '0 = node only, 1 = include neighbors',
      },
    },
    required: ['id'],
  },

  get_neighbors: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description:
          'Source node ID. ID is normalized to lowercase (e.g., "Recipes/Bulgogi.md" becomes "recipes/bulgogi.md").',
      },
      direction: {
        type: 'string',
        enum: ['in', 'out', 'both'],
        default: 'both',
        description: 'in = nodes linking here, out = nodes linked to, both = all',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 50,
        default: 20,
        description: 'Maximum neighbors to return',
      },
      include_content: {
        type: 'boolean',
        default: false,
        description:
          'Include node content in results. Default false returns metadata only (id, title, tags, properties, links). Set true to include truncated content.',
      },
    },
    required: ['id'],
  },

  find_path: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        description:
          'Start node ID. ID is normalized to lowercase (e.g., "Recipes/Bulgogi.md" becomes "recipes/bulgogi.md").',
      },
      target: {
        type: 'string',
        description:
          'End node ID. ID is normalized to lowercase (e.g., "Recipes/Bulgogi.md" becomes "recipes/bulgogi.md").',
      },
    },
    required: ['source', 'target'],
  },

  get_hubs: {
    type: 'object',
    properties: {
      metric: {
        type: 'string',
        enum: ['in_degree', 'out_degree'],
        default: 'in_degree',
        description: 'Centrality metric',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 50,
        default: 10,
        description: 'Maximum results',
      },
    },
  },

  search_by_tags: {
    type: 'object',
    properties: {
      tags: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        description: 'Tags to match',
      },
      mode: {
        type: 'string',
        enum: ['any', 'all'],
        default: 'any',
        description: 'any = OR matching, all = AND matching',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 20,
        description: 'Maximum results',
      },
    },
    required: ['tags'],
  },

  random_node: {
    type: 'object',
    properties: {
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional: limit to nodes with these tags (any match)',
      },
    },
  },

  create_node: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description:
          'Full path for new node (must end in .md). Will be lowercased (spaces and special characters preserved). Example: "notes/My Note.md" creates "notes/my note.md"',
      },
      title: {
        type: 'string',
        description:
          'Optional display title. Defaults to filename without .md extension.',
      },
      content: {
        type: 'string',
        description: 'Full text content (markdown)',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        default: [],
        description: 'Classification tags',
      },
    },
    required: ['id', 'content'],
  },

  update_node: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description:
          'Node ID to update. ID is normalized to lowercase (e.g., "Recipes/Bulgogi.md" becomes "recipes/bulgogi.md").',
      },
      title: {
        type: 'string',
        description: 'New title (renames file for DocStore)',
      },
      content: {
        type: 'string',
        description: 'New content (replaces entirely)',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'New tags (replaces existing)',
      },
    },
    required: ['id'],
  },

  delete_node: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description:
          'Node ID to delete. ID is normalized to lowercase (e.g., "Recipes/Bulgogi.md" becomes "recipes/bulgogi.md").',
      },
    },
    required: ['id'],
  },

  list_nodes: {
    type: 'object',
    properties: {
      tag: {
        type: 'string',
        description:
          'Filter by tag from the "tags" frontmatter array (case-insensitive). Does NOT search other frontmatter fields like "type" or "category".',
      },
      path: {
        type: 'string',
        description: 'Filter by path prefix (startsWith, case-insensitive)',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 1000,
        default: 100,
        description: 'Maximum results to return',
      },
      offset: {
        type: 'integer',
        minimum: 0,
        default: 0,
        description: 'Skip this many results (for pagination)',
      },
    },
  },

  resolve_nodes: {
    type: 'object',
    properties: {
      names: {
        type: 'array',
        items: { type: 'string' },
        description: 'Names to resolve to existing nodes',
      },
      strategy: {
        type: 'string',
        enum: ['exact', 'fuzzy', 'semantic'],
        default: 'fuzzy',
        description:
          'How to match names to nodes. "exact": case-insensitive title equality. "fuzzy": string similarity (Dice coefficient) — use for typos, misspellings, partial matches. "semantic": embedding cosine similarity — use for synonyms or related concepts (NOT typos). Misspellings embed poorly because they produce unrelated vectors.',
      },
      threshold: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        default: 0.7,
        description:
          'Minimum similarity score (0-1). Lower values match more loosely. For typo tolerance, use fuzzy with threshold 0.5-0.6. Ignored for exact strategy.',
      },
      tag: {
        type: 'string',
        description:
          'Filter candidates by tag from "tags" frontmatter array (case-insensitive)',
      },
      path: {
        type: 'string',
        description: 'Filter candidates by path prefix (case-insensitive)',
      },
    },
    required: ['names'],
  },

  nodes_exist: {
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Node IDs to check existence. IDs are normalized to lowercase (e.g., "Recipes/Bulgogi.md" becomes "recipes/bulgogi.md").',
      },
    },
    required: ['ids'],
  },
} as const;

/** Tool definitions for MCP protocol */
export function getToolDefinitions(hasEmbedding: boolean): Tool[] {
  const tools: Tool[] = [
    {
      name: 'get_node',
      description:
        'Retrieve a single node by ID with optional neighbor context',
      inputSchema: TOOL_SCHEMAS.get_node,
    },
    {
      name: 'get_neighbors',
      description: 'Get nodes linked to or from a specific node',
      inputSchema: TOOL_SCHEMAS.get_neighbors,
    },
    {
      name: 'find_path',
      description: 'Find the shortest path between two nodes',
      inputSchema: TOOL_SCHEMAS.find_path,
    },
    {
      name: 'get_hubs',
      description: 'Get the most central nodes by graph metric',
      inputSchema: TOOL_SCHEMAS.get_hubs,
    },
    {
      name: 'search_by_tags',
      description: 'Filter nodes by tags (AND or OR matching)',
      inputSchema: TOOL_SCHEMAS.search_by_tags,
    },
    {
      name: 'random_node',
      description: 'Get a random node for discovery, optionally filtered by tags',
      inputSchema: TOOL_SCHEMAS.random_node,
    },
    {
      name: 'create_node',
      description: 'Create a new node (writes file for DocStore)',
      inputSchema: TOOL_SCHEMAS.create_node,
    },
    {
      name: 'update_node',
      description:
        'Update an existing node. Title changes rejected if incoming links exist.',
      inputSchema: TOOL_SCHEMAS.update_node,
    },
    {
      name: 'delete_node',
      description: 'Delete a node by ID',
      inputSchema: TOOL_SCHEMAS.delete_node,
    },
    {
      name: 'list_nodes',
      description:
        'List nodes with optional filters and pagination. Tag filter searches the "tags" frontmatter array only. All IDs returned are lowercase.',
      inputSchema: TOOL_SCHEMAS.list_nodes,
    },
    {
      name: 'resolve_nodes',
      description:
        'Batch resolve names to existing node IDs. Strategy selection: "exact" for known titles, "fuzzy" for typos/misspellings (e.g., "chikken" -> "chicken"), "semantic" for synonyms/concepts (e.g., "poultry leg meat" -> "chicken thigh"). Semantic does NOT handle typos — misspellings produce garbage embeddings.',
      inputSchema: TOOL_SCHEMAS.resolve_nodes,
    },
    {
      name: 'nodes_exist',
      description:
        'Batch check if node IDs exist. IDs are normalized to lowercase before checking.',
      inputSchema: TOOL_SCHEMAS.nodes_exist,
    },
  ];

  if (hasEmbedding) {
    tools.unshift({
      name: 'search',
      description: 'Semantic similarity search across all nodes',
      inputSchema: TOOL_SCHEMAS.search,
    });
  }

  return tools;
}

/** Response format for MCP tool calls */
export interface McpToolResponse {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/**
 * Format a successful tool result for MCP response.
 */
export function formatToolResponse(result: unknown): McpToolResponse {
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
}

/**
 * Format an error for MCP response.
 * Handles McpError, generic Error, and non-Error thrown values.
 */
export function formatErrorResponse(error: unknown): McpToolResponse {
  if (error instanceof McpError) {
    return {
      content: [{ type: 'text', text: JSON.stringify(error.toResponse()) }],
      isError: true,
    };
  }
  const mcpError = new McpError(
    'PROVIDER_ERROR',
    error instanceof Error ? error.message : 'Unknown error'
  );
  return {
    content: [{ type: 'text', text: JSON.stringify(mcpError.toResponse()) }],
    isError: true,
  };
}

/**
 * Execute a tool call and return formatted MCP response.
 * Handles dispatching to the appropriate handler and error formatting.
 */
export async function executeToolCall(
  ctx: HandlerContext,
  name: string,
  args: Record<string, unknown>
): Promise<McpToolResponse> {
  try {
    const result = await dispatchTool(ctx, name, args);
    return formatToolResponse(result);
  } catch (error) {
    return formatErrorResponse(error);
  }
}

export class McpServer {
  private server: Server;
  private ctx: HandlerContext;

  constructor(options: McpServerOptions) {
    this.ctx = {
      core: options.core,
      store: options.store,
      hasEmbedding: options.hasEmbedding,
    };

    this.server = new Server(
      { name: 'roux', version: VERSION },
      { capabilities: { tools: {} } }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: getToolDefinitions(this.ctx.hasEmbedding),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      return executeToolCall(this.ctx, name, args ?? {});
    });
  }

  /**
   * Start the server with optional transport factory.
   * @param transportFactory Factory to create transport. Defaults to StdioServerTransport.
   */
  async start(transportFactory?: TransportFactory): Promise<void> {
    const transport = transportFactory
      ? transportFactory()
      : new StdioServerTransport();
    await this.server.connect(transport as Parameters<typeof this.server.connect>[0]);
  }

  async close(): Promise<void> {
    await this.server.close();
  }
}

/**
 * Create and start an MCP server.
 * @param options Server configuration
 * @param transportFactory Optional transport factory for testing
 */
export async function createMcpServer(
  options: McpServerOptions,
  transportFactory?: TransportFactory
): Promise<McpServer> {
  const server = new McpServer(options);
  await server.start(transportFactory);
  return server;
}
