import type { HandlerContext } from './types.js';
import type { DeleteResponse } from '../types.js';
import { validateRequiredString } from '../validation.js';

export const schema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description:
        'Node ID to delete. Accepts either a stable nanoid (e.g., "abc123XYZ789") or a file path for backwards compatibility (e.g., "recipes/bulgogi.md"). Paths are normalized to lowercase. Prefer nanoid for direct lookup; path requires index scan.',
    },
  },
  required: ['id'],
} as const;

export async function handler(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<DeleteResponse> {
  const id = validateRequiredString(args.id, 'id');

  const deleted = await ctx.core.deleteNode(id);
  return { deleted };
}
