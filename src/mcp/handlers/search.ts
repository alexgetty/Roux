import type { HandlerContext } from './types.js';
import type { SearchResultResponse } from '../types.js';
import { McpError } from '../types.js';
import { coerceLimit } from '../validation.js';
import { nodesToSearchResults } from '../transforms.js';

export const schema = {
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
} as const;

export async function handler(
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

  const scores = new Map<string, number>();
  nodes.forEach((node, index) => {
    scores.set(node.id, Math.max(0, 1 - index * 0.05));
  });

  return nodesToSearchResults(nodes, scores, ctx.store, includeContent);
}
