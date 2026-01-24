import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

import type { GraphCore } from '../types/graphcore.js';
import type { StoreProvider } from '../types/provider.js';
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
    },
    required: ['query'],
  },

  get_node: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Node ID (file path for DocStore)',
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
        description: 'Source node ID',
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
    },
    required: ['id'],
  },

  find_path: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        description: 'Start node ID',
      },
      target: {
        type: 'string',
        description: 'End node ID',
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
      title: {
        type: 'string',
        description: 'Node title (becomes filename for DocStore)',
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
      directory: {
        type: 'string',
        description: "Optional: subdirectory path (e.g., 'notes/drafts')",
      },
    },
    required: ['title', 'content'],
  },

  update_node: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Node ID to update',
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
        description: 'Node ID to delete',
      },
    },
    required: ['id'],
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
      { name: 'roux', version: '0.1.0' },
      { capabilities: { tools: {} } }
    );

    this.setupHandlers();
  }

  /* v8 ignore start - MCP SDK callbacks tested via integration in Phase 11 */
  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: getToolDefinitions(this.ctx.hasEmbedding),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const result = await dispatchTool(this.ctx, name, args ?? {});
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        if (error instanceof McpError) {
          return {
            content: [
              { type: 'text', text: JSON.stringify(error.toResponse()) },
            ],
            isError: true,
          };
        }
        const mcpError = new McpError(
          'PROVIDER_ERROR',
          error instanceof Error ? error.message : 'Unknown error'
        );
        return {
          content: [
            { type: 'text', text: JSON.stringify(mcpError.toResponse()) },
          ],
          isError: true,
        };
      }
    });
  }
  /* v8 ignore stop */

  /**
   * Start the server with optional transport factory.
   * @param transportFactory Factory to create transport. Defaults to StdioServerTransport.
   */
  async start(transportFactory?: TransportFactory): Promise<void> {
    /* v8 ignore start - Default stdio transport tested via integration */
    const transport = transportFactory
      ? transportFactory()
      : new StdioServerTransport();
    /* v8 ignore stop */
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
