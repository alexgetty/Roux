import type { HandlerContext } from './types.js';
import type { TagMode } from '../../types/provider.js';
import type { NodeResponse, NodeMetadataResponse } from '../types.js';
import { coerceLimit, validateEnum, validateRequiredTags } from '../validation.js';
import { nodesToResponses } from '../transforms.js';

const VALID_TAG_MODES = ['any', 'all'] as const;

export const schema = {
  type: 'object',
  properties: {
    tags: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      description: 'Tags to match',
    },
    mode: {
      type: 'string',
      enum: ['any', 'all'],
      default: 'any',
      description: 'any = OR matching, all = AND matching',
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 20,
      description: 'Maximum results',
    },
    include_content: {
      type: 'boolean',
      default: false,
      description:
        'Include node content in results. Default false returns metadata only.',
    },
  },
  required: ['tags'],
} as const;

export async function handler(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<NodeResponse[] | NodeMetadataResponse[]> {
  const tags = validateRequiredTags(args.tags);
  const limit = coerceLimit(args.limit, 20);
  const includeContent = args.include_content === true;

  const mode = validateEnum(args.mode, VALID_TAG_MODES, 'mode', 'any');

  const nodes = await ctx.core.searchByTags(tags, mode as TagMode, limit);
  return nodesToResponses(nodes, ctx.store, 'list', includeContent);
}
