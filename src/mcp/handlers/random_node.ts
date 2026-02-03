import type { HandlerContext } from './types.js';
import type { NodeResponse } from '../types.js';
import type { OrphanFilter } from '../../types/provider.js';
import { validateOptionalTags } from '../validation.js';
import { nodeToResponse } from '../transforms.js';

const VALID_ORPHAN_FILTERS: OrphanFilter[] = ['include', 'only', 'exclude'];

export const schema = {
  type: 'object',
  properties: {
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Optional: limit to nodes with these tags (any match)',
    },
    ghosts: {
      type: 'string',
      enum: ['include', 'only', 'exclude'],
      default: 'exclude',
      description: 'Ghost node filtering: "exclude" (default), "include", or "only" (ghosts only)',
    },
    orphans: {
      type: 'string',
      enum: ['include', 'only', 'exclude'],
      default: 'exclude',
      description: 'Orphan node filtering (nodes with no links): "exclude" (default), "include", or "only" (orphans only)',
    },
  },
} as const;

export async function handler(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<NodeResponse | null> {
  const tags = validateOptionalTags(args.tags);
  const ghostsArg = args.ghosts as string | undefined;
  const orphansArg = args.orphans as string | undefined;

  // Map ghosts param to options
  // 'exclude' (default): includeGhosts=false, ghostsOnly=false
  // 'include': includeGhosts=true, ghostsOnly=false
  // 'only': includeGhosts=true, ghostsOnly=true
  const includeGhosts = ghostsArg === 'include' || ghostsArg === 'only';
  const ghostsOnly = ghostsArg === 'only';

  // Map orphans param to options
  // 'exclude' (default): excludeOrphans=true
  // 'include': excludeOrphans=false
  // 'only': orphansOnly=true
  const validOrphanArg = VALID_ORPHAN_FILTERS.includes(orphansArg as OrphanFilter) ? orphansArg : 'exclude';
  const orphansOnly = validOrphanArg === 'only';
  const excludeOrphans = !orphansOnly && validOrphanArg !== 'include';

  const node = await ctx.core.getRandomNode(tags, { includeGhosts, ghostsOnly, excludeOrphans, orphansOnly });
  if (!node) {
    return null;
  }

  return nodeToResponse(node, ctx.store, 'primary');
}
