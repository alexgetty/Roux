import type { HandlerContext } from './types.js';
import type { NodeResponse } from '../types.js';
import { validateOptionalTags } from '../validation.js';
import { nodeToResponse } from '../transforms.js';

export const schema = {
  type: 'object',
  properties: {
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Optional: limit to nodes with these tags (any match)',
    },
  },
} as const;

export async function handler(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<NodeResponse | null> {
  const tags = validateOptionalTags(args.tags);

  const node = await ctx.core.getRandomNode(tags);
  if (!node) {
    return null;
  }

  return nodeToResponse(node, ctx.store, 'primary');
}
