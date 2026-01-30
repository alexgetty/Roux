import type { HandlerContext } from './types.js';
import type { DeleteResponse } from '../types.js';
import { validateRequiredString } from '../validation.js';

export const schema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description:
        'Node ID to delete. ID is normalized to lowercase (e.g., "Recipes/Bulgogi.md" becomes "recipes/bulgogi.md").',
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
