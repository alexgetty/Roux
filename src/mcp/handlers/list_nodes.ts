import type { HandlerContext } from './types.js';
import type { ListFilter, NodeSummary } from '../../types/provider.js';
import { coerceLimit, coerceOffset } from '../validation.js';

export interface ListNodesResponse {
  nodes: NodeSummary[];
  total: number;
}

export const schema = {
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
} as const;

export async function handler(
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
