import type { HandlerContext } from './types.js';
import type { NodeResponse, NodeWithContextResponse } from '../types.js';
import { coerceDepth, validateRequiredString } from '../validation.js';
import { nodeToResponse, nodeToContextResponse } from '../transforms.js';

export const schema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description:
        'Node ID to retrieve. Accepts either a stable nanoid (e.g., "abc123XYZ789") or a file path for backwards compatibility (e.g., "recipes/bulgogi.md"). Paths are normalized to lowercase. Prefer nanoid for direct lookup; path requires index scan.',
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
} as const;

export async function handler(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<NodeResponse | NodeWithContextResponse | null> {
  const id = validateRequiredString(args.id, 'id');
  const depth = coerceDepth(args.depth);

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
