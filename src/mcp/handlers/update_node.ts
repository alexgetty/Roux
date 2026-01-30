import type { HandlerContext } from './types.js';
import type { NodeUpdates } from '../../types/node.js';
import type { NodeResponse } from '../types.js';
import { McpError } from '../types.js';
import { validateRequiredString, validateOptionalTags } from '../validation.js';
import { nodeToResponse } from '../transforms.js';

export const schema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description:
        'Node ID to update. ID is normalized to lowercase (e.g., "Recipes/Bulgogi.md" becomes "recipes/bulgogi.md").',
    },
    title: {
      type: 'string',
      description: 'New title (renames file for DocStore)',
    },
    content: {
      type: 'string',
      description: 'New content (replaces entirely)',
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'New tags (replaces existing)',
    },
  },
  required: ['id'],
} as const;

export async function handler(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<NodeResponse> {
  const id = validateRequiredString(args.id, 'id');
  const title = args.title as string | undefined;
  const content = args.content as string | undefined;
  const tags = validateOptionalTags(args.tags);

  if (title === undefined && content === undefined && tags === undefined) {
    throw new McpError(
      'INVALID_PARAMS',
      'At least one of title, content, or tags must be provided'
    );
  }

  const existing = await ctx.core.getNode(id);
  if (!existing) {
    throw new McpError('NODE_NOT_FOUND', `Node not found: ${id}`);
  }

  if (title !== undefined && title !== existing.title) {
    const incomingNeighbors = await ctx.core.getNeighbors(id, { direction: 'in' });
    if (incomingNeighbors.length > 0) {
      throw new McpError(
        'LINK_INTEGRITY',
        `Cannot rename node with ${incomingNeighbors.length} incoming links`
      );
    }
  }

  const updates: NodeUpdates = {};
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (tags !== undefined) updates.tags = tags;

  const updated = await ctx.core.updateNode(id, updates);
  return nodeToResponse(updated, ctx.store, 'primary');
}
