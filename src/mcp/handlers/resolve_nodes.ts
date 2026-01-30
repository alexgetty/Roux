import type { HandlerContext } from './types.js';
import type { ResolveOptions, ResolveStrategy, ResolveResult } from '../../types/provider.js';
import { McpError } from '../types.js';
import { validateEnum, validateStringArray } from '../validation.js';

const VALID_STRATEGIES = ['exact', 'fuzzy', 'semantic'] as const;

export const schema = {
  type: 'object',
  properties: {
    names: {
      type: 'array',
      items: { type: 'string' },
      description: 'Names to resolve to existing nodes',
    },
    strategy: {
      type: 'string',
      enum: ['exact', 'fuzzy', 'semantic'],
      default: 'fuzzy',
      description:
        'How to match names to nodes. "exact": case-insensitive title equality. "fuzzy": string similarity (Dice coefficient) — use for typos, misspellings, partial matches. "semantic": embedding cosine similarity — use for synonyms or related concepts (NOT typos). Misspellings embed poorly because they produce unrelated vectors.',
    },
    threshold: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      default: 0.7,
      description:
        'Minimum similarity score (0-1). Lower values match more loosely. For typo tolerance, use fuzzy with threshold 0.5-0.6. Ignored for exact strategy.',
    },
    tag: {
      type: 'string',
      description:
        'Filter candidates by tag from "tags" frontmatter array (case-insensitive)',
    },
    path: {
      type: 'string',
      description: 'Filter candidates by path prefix (case-insensitive)',
    },
  },
  required: ['names'],
} as const;

export async function handler(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<ResolveResult[]> {
  const names = validateStringArray(args.names, 'names');
  const threshold = args.threshold as number | undefined;
  const tag = args.tag as string | undefined;
  const path = args.path as string | undefined;

  const strategy = validateEnum(
    args.strategy,
    VALID_STRATEGIES,
    'strategy',
    'fuzzy'
  ) as ResolveStrategy;

  if (strategy === 'semantic' && !ctx.hasEmbedding) {
    throw new McpError('PROVIDER_ERROR', 'Semantic resolution requires embedding provider');
  }

  const options: ResolveOptions = { strategy };
  if (threshold !== undefined) options.threshold = threshold;
  if (tag) options.tag = tag;
  if (path) options.path = path;

  return ctx.core.resolveNodes(names, options);
}
