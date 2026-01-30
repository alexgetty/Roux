import type { HandlerContext } from './types.js';
import type { PathResponse } from '../types.js';
import { validateRequiredString } from '../validation.js';
import { pathToResponse } from '../transforms.js';

export const schema = {
  type: 'object',
  properties: {
    source: {
      type: 'string',
      description:
        'Start node ID. ID is normalized to lowercase (e.g., "Recipes/Bulgogi.md" becomes "recipes/bulgogi.md").',
    },
    target: {
      type: 'string',
      description:
        'End node ID. ID is normalized to lowercase (e.g., "Recipes/Bulgogi.md" becomes "recipes/bulgogi.md").',
    },
  },
  required: ['source', 'target'],
} as const;

export async function handler(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<PathResponse | null> {
  const source = validateRequiredString(args.source, 'source');
  const target = validateRequiredString(args.target, 'target');

  const path = await ctx.core.findPath(source, target);
  if (!path) {
    return null;
  }

  return pathToResponse(path);
}
