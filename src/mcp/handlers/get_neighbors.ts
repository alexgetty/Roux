import type { HandlerContext } from './types.js';
import type { NodeResponse, NodeMetadataResponse } from '../types.js';
import { coerceLimit, validateEnum, validateRequiredString } from '../validation.js';
import { nodesToResponses } from '../transforms.js';

const VALID_DIRECTIONS = ['in', 'out', 'both'] as const;

export const schema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description:
        'Source node ID. Accepts either a stable nanoid (e.g., "abc123XYZ789") or a file path for backwards compatibility (e.g., "recipes/bulgogi.md"). Paths are normalized to lowercase. Prefer nanoid for direct lookup; path requires index scan.',
    },
    direction: {
      type: 'string',
      enum: ['in', 'out', 'both'],
      default: 'both',
      description: 'in = nodes linking here, out = nodes linked to, both = all',
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 50,
      default: 20,
      description: 'Maximum neighbors to return',
    },
    include_content: {
      type: 'boolean',
      default: false,
      description:
        'Include node content in results. Default false returns metadata only (id, title, tags, properties, links). Set true to include truncated content.',
    },
  },
  required: ['id'],
} as const;

export async function handler(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<NodeResponse[] | NodeMetadataResponse[]> {
  const id = validateRequiredString(args.id, 'id');
  const limit = coerceLimit(args.limit, 20);
  const includeContent = args.include_content === true;

  const direction = validateEnum(args.direction, VALID_DIRECTIONS, 'direction', 'both');

  const neighbors = await ctx.core.getNeighbors(id, { direction, limit });
  return nodesToResponses(neighbors, ctx.store, 'list', includeContent);
}
