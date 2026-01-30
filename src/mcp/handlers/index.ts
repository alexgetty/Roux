import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { HandlerContext } from './types.js';
import type { ResolveResult } from '../../types/provider.js';
import type {
  NodeResponse,
  NodeWithContextResponse,
  SearchResultResponse,
  HubResponse,
  PathResponse,
  DeleteResponse,
} from '../types.js';
import { McpError } from '../types.js';
import type { ListNodesResponse } from './list_nodes.js';
import type { NodesExistResponse } from './nodes_exist.js';

import * as search from './search.js';
import * as getNode from './get_node.js';
import * as getNeighbors from './get_neighbors.js';
import * as findPath from './find_path.js';
import * as getHubs from './get_hubs.js';
import * as searchByTags from './search_by_tags.js';
import * as randomNode from './random_node.js';
import * as createNode from './create_node.js';
import * as updateNode from './update_node.js';
import * as deleteNode from './delete_node.js';
import * as listNodes from './list_nodes.js';
import * as resolveNodes from './resolve_nodes.js';
import * as nodesExist from './nodes_exist.js';

export type { HandlerContext } from './types.js';
export { normalizeCreateId, deriveTitle } from './create_node.js';
export { coerceInt } from '../validation.js';
export type { ListNodesResponse } from './list_nodes.js';
export type { NodesExistResponse } from './nodes_exist.js';

type Handler = {
  schema: object;
  handler: (ctx: HandlerContext, args: Record<string, unknown>) => Promise<unknown>;
};

const handlers: Record<string, Handler> = {
  search,
  get_node: getNode,
  get_neighbors: getNeighbors,
  find_path: findPath,
  get_hubs: getHubs,
  search_by_tags: searchByTags,
  random_node: randomNode,
  create_node: createNode,
  update_node: updateNode,
  delete_node: deleteNode,
  list_nodes: listNodes,
  resolve_nodes: resolveNodes,
  nodes_exist: nodesExist,
};

const TOOL_DESCRIPTIONS: Record<string, string> = {
  search: 'Semantic similarity search across all nodes',
  get_node: 'Retrieve a single node by ID with optional neighbor context',
  get_neighbors: 'Get nodes linked to or from a specific node',
  find_path: 'Find the shortest path between two nodes',
  get_hubs: 'Get the most central nodes by graph metric',
  search_by_tags: 'Filter nodes by tags (AND or OR matching)',
  random_node: 'Get a random node for discovery, optionally filtered by tags',
  create_node: 'Create a new node (writes file for DocStore)',
  update_node: 'Update an existing node. Title changes rejected if incoming links exist.',
  delete_node: 'Delete a node by ID',
  list_nodes: 'List nodes with optional filters and pagination. Tag filter searches the "tags" frontmatter array only. All IDs returned are lowercase.',
  resolve_nodes: 'Batch resolve names to existing node IDs. Strategy selection: "exact" for known titles, "fuzzy" for typos/misspellings (e.g., "chikken" -> "chicken"), "semantic" for synonyms/concepts (e.g., "poultry leg meat" -> "chicken thigh"). Semantic does NOT handle typos — misspellings produce garbage embeddings.',
  nodes_exist: 'Batch check if node IDs exist. IDs are normalized to lowercase before checking.',
};

/** Cast schema to Tool inputSchema type (readonly arrays → mutable) */
type InputSchema = Tool['inputSchema'];
const asSchema = (s: unknown): InputSchema => s as InputSchema;

export function getToolDefinitions(hasEmbedding: boolean): Tool[] {
  // Tool order: read operations first (get/find/search), then mutations (create/update/delete),
  // then batch utilities. Search is prepended only when embedding provider is available.
  const toolOrder = [
    'get_node',
    'get_neighbors',
    'find_path',
    'get_hubs',
    'search_by_tags',
    'random_node',
    'create_node',
    'update_node',
    'delete_node',
    'list_nodes',
    'resolve_nodes',
    'nodes_exist',
  ];

  const tools: Tool[] = toolOrder.map((name) => ({
    name,
    description: TOOL_DESCRIPTIONS[name]!,
    inputSchema: asSchema(handlers[name]!.schema),
  }));

  if (hasEmbedding) {
    tools.unshift({
      name: 'search',
      description: TOOL_DESCRIPTIONS.search!,
      inputSchema: asSchema(handlers.search!.schema),
    });
  }

  return tools;
}

export type ToolResult =
  | NodeResponse
  | NodeWithContextResponse
  | SearchResultResponse[]
  | NodeResponse[]
  | HubResponse[]
  | PathResponse
  | DeleteResponse
  | ListNodesResponse
  | ResolveResult[]
  | NodesExistResponse
  | null;

export async function dispatchTool(
  ctx: HandlerContext,
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const h = handlers[name];
  if (!h) {
    throw new McpError('INVALID_PARAMS', `Unknown tool: ${name}`);
  }
  return h.handler(ctx, args) as Promise<ToolResult>;
}
