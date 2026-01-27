/**
 * MarkdownReader - FormatReader implementation for Markdown files
 *
 * Handles .md and .markdown files, extracting:
 * - YAML frontmatter (title, tags, properties)
 * - Wiki-links from content
 * - Node ID from file path
 */

import type { Node } from '../../../types/node.js';
import type { FormatReader, FileContext } from '../types.js';
import {
  parseMarkdown,
  extractWikiLinks,
  normalizeId,
  titleFromPath,
} from '../parser.js';
import { normalizeWikiLink } from '../links.js';

export class MarkdownReader implements FormatReader {
  readonly extensions = ['.md', '.markdown'];

  parse(content: string, context: FileContext): Node {
    const parsed = parseMarkdown(content);

    const id = normalizeId(context.relativePath);

    // Derive title from path if not in frontmatter
    const title = parsed.title ?? titleFromPath(id);

    // Extract and normalize wiki links
    const rawLinks = extractWikiLinks(parsed.content);
    const outgoingLinks = rawLinks.map((link) => normalizeWikiLink(link));

    return {
      id,
      title,
      content: parsed.content,
      tags: parsed.tags,
      outgoingLinks,
      properties: parsed.properties,
      sourceRef: {
        type: 'file',
        path: context.absolutePath,
        lastModified: context.mtime,
      },
    };
  }
}
