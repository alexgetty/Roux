/**
 * FormatReader plugin types
 *
 * Extracted to break circular dependency between reader-registry and readers.
 */

import type { Node } from '../../types/node.js';

/**
 * Context provided to readers during parsing
 */
export interface FileContext {
  /** Full absolute path to the file */
  absolutePath: string;
  /** Path relative to source root (becomes node ID) */
  relativePath: string;
  /** File extension including dot (e.g., '.md') */
  extension: string;
  /** File modification time */
  mtime: Date;
}

/**
 * Interface for format-specific file readers
 */
export interface FormatReader {
  /** Extensions this reader handles (e.g., ['.md', '.markdown']) */
  readonly extensions: string[];
  /** Parse file content into a Node */
  parse(content: string, context: FileContext): Node;
}
