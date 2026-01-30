import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';

import type { GraphCore } from '../types/graphcore.js';
import type { Store } from '../types/provider.js';
import { DEFAULT_NAMING, type NamingConventions } from '../types/config.js';
import { VERSION } from '../index.js';
import { McpError } from './types.js';
import { dispatchTool, getToolDefinitions, type HandlerContext } from './handlers/index.js';

export interface McpServerOptions {
  /** GraphCore instance for operations */
  core: GraphCore;
  /** Store for link resolution and direct store access */
  store: Store;
  /** Whether embedding provider is available (enables search tool) */
  hasEmbedding: boolean;
  /** Naming conventions for file creation */
  naming?: NamingConventions;
}

/** MCP Transport interface for server connection. */
export interface McpTransport {
  start?(): Promise<void>;
  close?(): Promise<void>;
}

/** Factory function to create a transport. Defaults to StdioServerTransport. */
export type TransportFactory = () => McpTransport;

/** Response format for MCP tool calls. Extends SDK's CallToolResult. */
export type McpToolResponse = CallToolResult;

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
      naming: options.naming ?? DEFAULT_NAMING,
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
