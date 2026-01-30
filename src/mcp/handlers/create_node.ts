import type { HandlerContext } from './types.js';
import type { NodeResponse } from '../types.js';
import { McpError } from '../types.js';
import { validateRequiredString, validateOptionalTags } from '../validation.js';
import { DEFAULT_NAMING, type NamingConventions } from '../../types/config.js';
import { nodeToResponse } from '../transforms.js';

export const schema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description:
        'Full path for new node (must end in .md). Will be lowercased (spaces and special characters preserved). Example: "notes/My Note.md" creates "notes/my note.md"',
    },
    title: {
      type: 'string',
      description:
        'Optional display title. Defaults to filename without .md extension.',
    },
    content: {
      type: 'string',
      description: 'Full text content (markdown)',
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      default: [],
      description: 'Classification tags',
    },
  },
  required: ['id', 'content'],
} as const;

/**
 * Normalize a raw ID for node creation.
 * Applies filename separator convention (space↔dash), then lowercases.
 */
export function normalizeCreateId(
  rawId: string,
  naming: NamingConventions = DEFAULT_NAMING
): string {
  let normalized = rawId.replace(/\\/g, '/').toLowerCase();

  if (naming.filename === 'space') {
    normalized = normalized.replace(/-/g, ' ');
  } else {
    normalized = normalized.replace(/ /g, '-');
  }

  return normalized;
}

/**
 * Derive display title from node ID.
 * Extracts filename without extension, applies naming conventions.
 * Returns 'Untitled' for empty or all-special-char filenames.
 */
export function deriveTitle(id: string, naming?: NamingConventions): string {
  const basename = id.split('/').pop() || '';
  const rawTitle = basename.replace(/\.md$/i, '');

  if (!rawTitle || !/[a-zA-Z0-9]/.test(rawTitle)) {
    return 'Untitled';
  }

  if (!naming) {
    return rawTitle;
  }

  const spaced = naming.filename === 'dash'
    ? rawTitle.replace(/-/g, ' ')
    : rawTitle;

  switch (naming.title) {
    case 'title':
      return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
    case 'sentence':
      return spaced.charAt(0).toUpperCase() + spaced.slice(1);
    case 'as-is':
      return rawTitle;
  }
}

export async function handler(
  ctx: HandlerContext,
  args: Record<string, unknown>
): Promise<NodeResponse> {
  const idRaw = validateRequiredString(args.id, 'id');

  if (!idRaw.toLowerCase().endsWith('.md')) {
    throw new McpError('INVALID_PARAMS', 'id must end with .md extension');
  }

  const content = validateRequiredString(args.content, 'content');
  const titleRaw = args.title as string | undefined;
  const tags = validateOptionalTags(args.tags) ?? [];

  const id = normalizeCreateId(idRaw, ctx.naming);
  const title = titleRaw ?? deriveTitle(id, ctx.naming);

  const existing = await ctx.core.getNode(id);
  if (existing) {
    throw new McpError('NODE_EXISTS', `Node already exists: ${id}`);
  }

  const node = await ctx.core.createNode({
    id,
    title,
    content,
    tags,
  });

  return nodeToResponse(node, ctx.store, 'primary');
}
