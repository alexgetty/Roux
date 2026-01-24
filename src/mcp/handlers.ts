import type { GraphCore } from '../types/graphcore.js';
import type { StoreProvider, Metric, TagMode } from '../types/provider.js';
import type { Node } from '../types/node.js';
import {
  McpError,
  type NodeResponse,
  type NodeWithContextResponse,
  type SearchResultResponse,
  type HubResponse,
  type PathResponse,
  type DeleteResponse,
} from './types.js';
import {
  nodeToResponse,
  nodesToResponses,
  nodeToContextResponse,
  nodesToSearchResults,
  hubsToResponses,
  pathToResponse,
} from './transforms.js';

export interface HandlerContext {
  core: GraphCore;
  store: StoreProvider;
  hasEmbedding: boolean;
}

export type ToolResult =
  | NodeResponse
  | NodeWithContextResponse
  | SearchResultResponse[]
  | NodeResponse[]
  | HubResponse[]
  | PathResponse
  | DeleteResponse
  | null;

export async function handleSearch(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<SearchResultResponse[]> {
  if (!ctx.hasEmbedding) {
    throw new McpError('PROVIDER_ERROR', 'Search requires embedding provider');
  }

  const query = args.query;
  const limit = (args.limit as number) ?? 10;

  if (typeof query !== 'string' || query.trim() === '') {
    throw new McpError('INVALID_PARAMS', 'query is required and must be a non-empty string');
  }

  const nodes = await ctx.core.search(query, { limit });

  // Approximate scores for display. Results are sorted by actual similarity (distance-based).
  // Score is a UI hint (higher = better match), not the raw similarity metric.
  const scores = new Map<string, number>();
  nodes.forEach((node, index) => {
    scores.set(node.id, Math.max(0, 1 - index * 0.05));
  });

  return nodesToSearchResults(nodes, scores, ctx.store);
}

export async function handleGetNode(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<NodeResponse | NodeWithContextResponse | null> {
  const id = args.id as string;
  const depth = (args.depth as number) ?? 0;

  if (!id || typeof id !== 'string') {
    throw new McpError('INVALID_PARAMS', 'id is required and must be a string');
  }

  const node = await ctx.core.getNode(id, depth);
  if (!node) {
    return null;
  }

  if (depth === 0) {
    return nodeToResponse(node, ctx.store, 'primary');
  }

  const [incomingNeighbors, outgoingNeighbors] = await Promise.all([
    ctx.core.getNeighbors(id, { direction: 'in' }),
    ctx.core.getNeighbors(id, { direction: 'out' }),
  ]);

  return nodeToContextResponse(node, incomingNeighbors, outgoingNeighbors, ctx.store);
}

export async function handleGetNeighbors(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<NodeResponse[]> {
  const id = args.id as string;
  const direction = (args.direction as 'in' | 'out' | 'both') ?? 'both';
  const limit = (args.limit as number) ?? 20;

  if (!id || typeof id !== 'string') {
    throw new McpError('INVALID_PARAMS', 'id is required and must be a string');
  }

  const neighbors = await ctx.core.getNeighbors(id, { direction, limit });
  return nodesToResponses(neighbors, ctx.store, 'list');
}

export async function handleFindPath(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<PathResponse | null> {
  const source = args.source as string;
  const target = args.target as string;

  if (!source || typeof source !== 'string') {
    throw new McpError('INVALID_PARAMS', 'source is required and must be a string');
  }
  if (!target || typeof target !== 'string') {
    throw new McpError('INVALID_PARAMS', 'target is required and must be a string');
  }

  const path = await ctx.core.findPath(source, target);
  if (!path) {
    return null;
  }

  return pathToResponse(path);
}

export async function handleGetHubs(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<HubResponse[]> {
  const metric = (args.metric as Metric) ?? 'in_degree';
  const limit = (args.limit as number) ?? 10;

  const hubs = await ctx.core.getHubs(metric, limit);
  return hubsToResponses(hubs, ctx.store);
}

export async function handleSearchByTags(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<NodeResponse[]> {
  const tags = args.tags;
  const mode = (args.mode as TagMode) ?? 'any';
  const limit = (args.limit as number) ?? 20;

  if (!Array.isArray(tags) || tags.length === 0) {
    throw new McpError('INVALID_PARAMS', 'tags is required and must be a non-empty array');
  }

  // Validate all elements are strings
  if (!tags.every((t) => typeof t === 'string')) {
    throw new McpError('INVALID_PARAMS', 'tags must contain only strings');
  }

  const nodes = await ctx.core.searchByTags(tags, mode, limit);
  return nodesToResponses(nodes, ctx.store, 'list');
}

export async function handleRandomNode(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<NodeResponse | null> {
  const tags = args.tags as string[] | undefined;

  const node = await ctx.core.getRandomNode(tags);
  if (!node) {
    return null;
  }

  return nodeToResponse(node, ctx.store, 'primary');
}

export async function handleCreateNode(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<NodeResponse> {
  const title = args.title as string;
  const content = args.content as string;
  const tags = (args.tags as string[]) ?? [];
  const directory = args.directory as string | undefined;

  if (!title || typeof title !== 'string') {
    throw new McpError('INVALID_PARAMS', 'title is required and must be a string');
  }
  if (!content || typeof content !== 'string') {
    throw new McpError('INVALID_PARAMS', 'content is required and must be a string');
  }

  const filename = sanitizeFilename(title) + '.md';
  const id = directory ? `${directory}/${filename}` : filename;

  const existing = await ctx.core.getNode(id);
  if (existing) {
    throw new McpError('NODE_EXISTS', `Node already exists: ${id}`);
  }

  const node = await ctx.core.createNode({
    id,
    title,
    content,
    tags,
  });

  return nodeToResponse(node, ctx.store, 'primary');
}

export async function handleUpdateNode(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<NodeResponse> {
  const id = args.id as string;
  const title = args.title as string | undefined;
  const content = args.content as string | undefined;
  const tags = args.tags as string[] | undefined;

  if (!id || typeof id !== 'string') {
    throw new McpError('INVALID_PARAMS', 'id is required and must be a string');
  }

  if (title === undefined && content === undefined && tags === undefined) {
    throw new McpError(
      'INVALID_PARAMS',
      'At least one of title, content, or tags must be provided'
    );
  }

  const existing = await ctx.core.getNode(id);
  if (!existing) {
    throw new McpError('NODE_NOT_FOUND', `Node not found: ${id}`);
  }

  if (title !== undefined && title !== existing.title) {
    const incomingNeighbors = await ctx.core.getNeighbors(id, { direction: 'in' });
    if (incomingNeighbors.length > 0) {
      throw new McpError(
        'LINK_INTEGRITY',
        `Cannot rename node with ${incomingNeighbors.length} incoming links`
      );
    }
  }

  const updates: Partial<Node> = {};
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (tags !== undefined) updates.tags = tags;

  const updated = await ctx.core.updateNode(id, updates);
  return nodeToResponse(updated, ctx.store, 'primary');
}

export async function handleDeleteNode(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<DeleteResponse> {
  const id = args.id as string;

  if (!id || typeof id !== 'string') {
    throw new McpError('INVALID_PARAMS', 'id is required and must be a string');
  }

  const deleted = await ctx.core.deleteNode(id);
  return { deleted };
}

export function sanitizeFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export async function dispatchTool(
  ctx: HandlerContext,
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  switch (name) {
    case 'search':
      return handleSearch(ctx, args);
    case 'get_node':
      return handleGetNode(ctx, args);
    case 'get_neighbors':
      return handleGetNeighbors(ctx, args);
    case 'find_path':
      return handleFindPath(ctx, args);
    case 'get_hubs':
      return handleGetHubs(ctx, args);
    case 'search_by_tags':
      return handleSearchByTags(ctx, args);
    case 'random_node':
      return handleRandomNode(ctx, args);
    case 'create_node':
      return handleCreateNode(ctx, args);
    case 'update_node':
      return handleUpdateNode(ctx, args);
    case 'delete_node':
      return handleDeleteNode(ctx, args);
    default:
      throw new McpError('INVALID_PARAMS', `Unknown tool: ${name}`);
  }
}
