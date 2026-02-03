import type { HandlerContext } from './types.js';
import { validateStringArray } from '../validation.js';

export interface NodesExistResponse {
  [id: string]: boolean;
}

export const schema = {
  type: 'object',
  properties: {
    ids: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Node IDs to check existence. Accepts either stable nanoids (e.g., "abc123XYZ789") or file paths for backwards compatibility (e.g., "recipes/bulgogi.md"). Paths are normalized to lowercase. Prefer nanoid for direct lookup; path requires index scan.',
    },
  },
  required: ['ids'],
} as const;

export async function handler(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<NodesExistResponse> {
  const ids = validateStringArray(args.ids, 'ids');

  const result = await ctx.store.nodesExist(ids);

  const response: NodesExistResponse = {};
  for (const [id, exists] of result) {
    response[id] = exists;
  }
  return response;
}
