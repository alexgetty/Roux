import type { GraphCore } from '../types/graphcore.js';
import type {
  StoreProvider,
  Metric,
  TagMode,
  ListFilter,
  ResolveOptions,
  ResolveStrategy,
  NodeSummary,
  ResolveResult,
} from '../types/provider.js';
import type { Node } from '../types/node.js';
import {
  McpError,
  type NodeResponse,
  type NodeMetadataResponse,
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

function coerceLimit(value: unknown, defaultValue: number): number {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    return defaultValue;
  }
  const floored = Math.floor(num);
  if (floored < 1) {
    throw new McpError('INVALID_PARAMS', 'limit must be at least 1');
  }
  return floored;
}

function coerceOffset(value: unknown, defaultValue: number): number {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    return defaultValue;
  }
  const floored = Math.floor(num);
  if (floored < 0) {
    throw new McpError('INVALID_PARAMS', 'offset must be at least 0');
  }
  return floored;
}

export interface ListNodesResponse {
  nodes: NodeSummary[];
  total: number;
}

export interface NodesExistResponse {
  [id: string]: boolean;
}

export type ToolResult =
  | NodeResponse
  | NodeMetadataResponse
  | NodeWithContextResponse
  | SearchResultResponse[]
  | NodeResponse[]
  | NodeMetadataResponse[]
  | HubResponse[]
  | PathResponse
  | DeleteResponse
  | ListNodesResponse
  | ResolveResult[]
  | NodesExistResponse
  | null;

export async function handleSearch(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<SearchResultResponse[]> {
  if (!ctx.hasEmbedding) {
    throw new McpError('PROVIDER_ERROR', 'Search requires embedding provider');
  }

  const query = args.query;
  const limit = coerceLimit(args.limit, 10);
  const includeContent = args.include_content === true;

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

  return nodesToSearchResults(nodes, scores, ctx.store, includeContent);
}

function coerceDepth(value: unknown): number {
  if (value === undefined || value === null) {
    return 0;
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    return 0;
  }
  return num >= 1 ? 1 : 0;
}

export async function handleGetNode(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<NodeResponse | NodeWithContextResponse | null> {
  const id = args.id as string;
  const depth = coerceDepth(args.depth);

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

const VALID_DIRECTIONS = ['in', 'out', 'both'] as const;

export async function handleGetNeighbors(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<NodeResponse[] | NodeMetadataResponse[]> {
  const id = args.id as string;
  const directionRaw = args.direction ?? 'both';
  const limit = coerceLimit(args.limit, 20);
  const includeContent = args.include_content === true;

  if (!id || typeof id !== 'string') {
    throw new McpError('INVALID_PARAMS', 'id is required and must be a string');
  }

  if (!VALID_DIRECTIONS.includes(directionRaw as (typeof VALID_DIRECTIONS)[number])) {
    throw new McpError(
      'INVALID_PARAMS',
      `direction must be one of: ${VALID_DIRECTIONS.join(', ')}`
    );
  }
  const direction = directionRaw as 'in' | 'out' | 'both';

  const neighbors = await ctx.core.getNeighbors(id, { direction, limit });
  return nodesToResponses(neighbors, ctx.store, 'list', includeContent);
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

const VALID_METRICS = ['in_degree', 'out_degree'] as const;

export async function handleGetHubs(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<HubResponse[]> {
  const metricRaw = args.metric ?? 'in_degree';
  const limit = coerceLimit(args.limit, 10);

  if (!VALID_METRICS.includes(metricRaw as Metric)) {
    throw new McpError(
      'INVALID_PARAMS',
      `metric must be one of: ${VALID_METRICS.join(', ')}`
    );
  }
  const metric = metricRaw as Metric;

  const hubs = await ctx.core.getHubs(metric, limit);
  return hubsToResponses(hubs, ctx.store);
}

const VALID_TAG_MODES = ['any', 'all'] as const;

export async function handleSearchByTags(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<NodeResponse[]> {
  const tags = args.tags;
  const modeRaw = args.mode ?? 'any';
  const limit = coerceLimit(args.limit, 20);

  if (!Array.isArray(tags) || tags.length === 0) {
    throw new McpError('INVALID_PARAMS', 'tags is required and must be a non-empty array');
  }

  // Validate all elements are strings
  if (!tags.every((t) => typeof t === 'string')) {
    throw new McpError('INVALID_PARAMS', 'tags must contain only strings');
  }

  if (!VALID_TAG_MODES.includes(modeRaw as TagMode)) {
    throw new McpError(
      'INVALID_PARAMS',
      `mode must be one of: ${VALID_TAG_MODES.join(', ')}`
    );
  }
  const mode = modeRaw as TagMode;

  const nodes = await ctx.core.searchByTags(tags, mode, limit);
  // searchByTags always includes content (not a browsing operation like search/get_neighbors)
  return nodesToResponses(nodes, ctx.store, 'list', true) as Promise<NodeResponse[]>;
}

export async function handleRandomNode(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<NodeResponse | null> {
  const tags = args.tags;

  if (tags !== undefined) {
    if (!Array.isArray(tags) || !tags.every((t) => typeof t === 'string')) {
      throw new McpError('INVALID_PARAMS', 'tags must contain only strings');
    }
  }

  const node = await ctx.core.getRandomNode(tags as string[] | undefined);
  if (!node) {
    return null;
  }

  return nodeToResponse(node, ctx.store, 'primary');
}

/**
 * Derive display title from node ID.
 * Extracts filename without extension.
 * Returns 'Untitled' for empty or all-special-char filenames.
 */
export function deriveTitle(id: string): string {
  const basename = id.split('/').pop() || '';
  const rawTitle = basename.replace(/\.md$/i, '');

  // If title is empty or contains no alphanumeric characters, fall back to Untitled
  if (!rawTitle || !/[a-zA-Z0-9]/.test(rawTitle)) {
    return 'Untitled';
  }

  return rawTitle;
}

export async function handleCreateNode(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<NodeResponse> {
  const idRaw = args.id as string;
  const titleRaw = args.title as string | undefined;
  const content = args.content as string;
  const tagsRaw = args.tags;

  // Validate id
  if (!idRaw || typeof idRaw !== 'string') {
    throw new McpError('INVALID_PARAMS', 'id is required and must be a string');
  }

  // Validate .md extension
  if (!idRaw.toLowerCase().endsWith('.md')) {
    throw new McpError('INVALID_PARAMS', 'id must end with .md extension');
  }

  // Validate content
  if (content === undefined || typeof content !== 'string') {
    throw new McpError('INVALID_PARAMS', 'content is required and must be a string');
  }

  // Validate tags
  let tags: string[] = [];
  if (tagsRaw !== undefined) {
    if (!Array.isArray(tagsRaw) || !tagsRaw.every((t) => typeof t === 'string')) {
      throw new McpError('INVALID_PARAMS', 'tags must contain only strings');
    }
    tags = tagsRaw;
  }

  // Normalize ID to lowercase
  const id = idRaw.toLowerCase();

  // Derive or use explicit title
  const title = titleRaw ?? deriveTitle(idRaw);

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
  const tagsRaw = args.tags;

  if (!id || typeof id !== 'string') {
    throw new McpError('INVALID_PARAMS', 'id is required and must be a string');
  }

  if (title === undefined && content === undefined && tagsRaw === undefined) {
    throw new McpError(
      'INVALID_PARAMS',
      'At least one of title, content, or tags must be provided'
    );
  }

  let tags: string[] | undefined;
  if (tagsRaw !== undefined) {
    if (!Array.isArray(tagsRaw) || !tagsRaw.every((t) => typeof t === 'string')) {
      throw new McpError('INVALID_PARAMS', 'tags must contain only strings');
    }
    tags = tagsRaw;
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

const VALID_STRATEGIES = ['exact', 'fuzzy', 'semantic'] as const;

export async function handleListNodes(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<ListNodesResponse> {
  const tag = args.tag as string | undefined;
  const path = args.path as string | undefined;
  const limit = coerceLimit(args.limit, 100);
  const offset = coerceOffset(args.offset, 0);

  const filter: ListFilter = {};
  if (tag) filter.tag = tag;
  if (path) filter.path = path;

  return ctx.core.listNodes(filter, { limit, offset });
}

export async function handleResolveNodes(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<ResolveResult[]> {
  const names = args.names;
  const strategy = args.strategy as ResolveStrategy | undefined;
  const threshold = args.threshold as number | undefined;
  const tag = args.tag as string | undefined;
  const path = args.path as string | undefined;

  if (!Array.isArray(names)) {
    throw new McpError('INVALID_PARAMS', 'names is required and must be an array');
  }

  if (strategy !== undefined && !VALID_STRATEGIES.includes(strategy as ResolveStrategy)) {
    throw new McpError(
      'INVALID_PARAMS',
      `strategy must be one of: ${VALID_STRATEGIES.join(', ')}`
    );
  }

  if (strategy === 'semantic' && !ctx.hasEmbedding) {
    throw new McpError('PROVIDER_ERROR', 'Semantic resolution requires embedding provider');
  }

  const options: ResolveOptions = {};
  if (strategy) options.strategy = strategy;
  if (threshold !== undefined) options.threshold = threshold;
  if (tag) options.tag = tag;
  if (path) options.path = path;

  return ctx.core.resolveNodes(names as string[], options);
}

export async function handleNodesExist(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<NodesExistResponse> {
  const ids = args.ids;

  if (!Array.isArray(ids)) {
    throw new McpError('INVALID_PARAMS', 'ids is required and must be an array');
  }

  const result = await ctx.store.nodesExist(ids as string[]);

  // Convert Map to plain object
  const response: NodesExistResponse = {};
  for (const [id, exists] of result) {
    response[id] = exists;
  }
  return response;
}

export function sanitizeFilename(title: string): string {
  const sanitized = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return sanitized || 'untitled';
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
    case 'list_nodes':
      return handleListNodes(ctx, args);
    case 'resolve_nodes':
      return handleResolveNodes(ctx, args);
    case 'nodes_exist':
      return handleNodesExist(ctx, args);
    default:
      throw new McpError('INVALID_PARAMS', `Unknown tool: ${name}`);
  }
}
