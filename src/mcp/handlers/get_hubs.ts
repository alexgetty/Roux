import type { HandlerContext } from './types.js';
import type { Metric } from '../../types/provider.js';
import type { HubResponse } from '../types.js';
import { coerceLimit, validateEnum } from '../validation.js';
import { hubsToResponses } from '../transforms.js';

const VALID_METRICS = ['in_degree', 'out_degree'] as const;

export const schema = {
  type: 'object',
  properties: {
    metric: {
      type: 'string',
      enum: ['in_degree', 'out_degree'],
      default: 'in_degree',
      description: 'Centrality metric',
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 50,
      default: 10,
      description: 'Maximum results',
    },
  },
} as const;

export async function handler(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<HubResponse[]> {
  const limit = coerceLimit(args.limit, 10);
  const metric = validateEnum(args.metric, VALID_METRICS, 'metric', 'in_degree');

  const hubs = await ctx.core.getHubs(metric as Metric, limit);
  return hubsToResponses(hubs, ctx.store);
}
