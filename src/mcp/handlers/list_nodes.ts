import type { HandlerContext } from './types.js';
import type { ListFilter, NodeSummary, GhostFilter, OrphanFilter } from '../../types/provider.js';
import { coerceLimit, coerceOffset } from '../validation.js';

export interface ListNodesResponse {
  nodes: NodeSummary[];
  total: number;
}

const VALID_GHOST_FILTERS: GhostFilter[] = ['include', 'only', 'exclude'];
const VALID_ORPHAN_FILTERS: OrphanFilter[] = ['include', 'only', 'exclude'];

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
    ghosts: {
      type: 'string',
      enum: ['include', 'only', 'exclude'],
      default: 'include',
      description: 'Ghost node filtering: "include" (default), "only" (ghosts only), or "exclude" (no ghosts)',
    },
    orphans: {
      type: 'string',
      enum: ['include', 'only', 'exclude'],
      default: 'include',
      description: 'Orphan node filtering (nodes with no links): "include" (default), "only" (orphans only), or "exclude" (no orphans)',
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
  const ghostsArg = args.ghosts as string | undefined;
  const orphansArg = args.orphans as string | undefined;
  const limit = coerceLimit(args.limit, 100);
  const offset = coerceOffset(args.offset, 0);

  // Validate ghosts param
  const ghosts: GhostFilter = VALID_GHOST_FILTERS.includes(ghostsArg as GhostFilter)
    ? (ghostsArg as GhostFilter)
    : 'include';

  // Validate orphans param
  const orphans: OrphanFilter = VALID_ORPHAN_FILTERS.includes(orphansArg as OrphanFilter)
    ? (orphansArg as OrphanFilter)
    : 'include';

  const filter: ListFilter = { ghosts, orphans };
  if (tag) filter.tag = tag;
  if (path) filter.path = path;

  return ctx.core.listNodes(filter, { limit, offset });
}
