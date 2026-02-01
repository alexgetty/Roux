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
        'Start node ID. Accepts either a stable nanoid (e.g., "abc123XYZ789") or a file path for backwards compatibility (e.g., "recipes/bulgogi.md"). Paths are normalized to lowercase.',
    },
    target: {
      type: 'string',
      description:
        'End node ID. Accepts either a stable nanoid (e.g., "abc123XYZ789") or a file path for backwards compatibility (e.g., "recipes/bulgogi.md"). Paths are normalized to lowercase.',
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
