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
        'Node IDs to check existence. IDs are normalized to lowercase (e.g., "Recipes/Bulgogi.md" becomes "recipes/bulgogi.md").',
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
