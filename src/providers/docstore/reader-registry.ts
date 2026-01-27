/**
 * FormatReader plugin architecture
 *
 * Provides a registry for file format readers, enabling multi-format support
 * in DocStore while keeping format-specific logic isolated.
 */

import type { Node } from '../../types/node.js';
import { MarkdownReader } from './readers/markdown.js';

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

/**
 * Registry for FormatReader implementations
 */
export class ReaderRegistry {
  private readers: Map<string, FormatReader> = new Map();

  /**
   * Register a reader for its declared extensions.
   * Throws if any extension is already registered (atomic - no partial registration).
   */
  register(reader: FormatReader): void {
    // Check for conflicts first (atomic)
    for (const ext of reader.extensions) {
      const normalizedExt = ext.toLowerCase();
      if (this.readers.has(normalizedExt)) {
        throw new Error(`Extension already registered: ${ext}`);
      }
    }

    // All clear - register all extensions
    for (const ext of reader.extensions) {
      const normalizedExt = ext.toLowerCase();
      this.readers.set(normalizedExt, reader);
    }
  }

  /**
   * Get reader for an extension, or null if none registered.
   * Case-insensitive.
   */
  getReader(extension: string): FormatReader | null {
    return this.readers.get(extension.toLowerCase()) ?? null;
  }

  /**
   * Get all registered extensions
   */
  getExtensions(): ReadonlySet<string> {
    return new Set(this.readers.keys());
  }

  /**
   * Check if an extension has a registered reader.
   * Case-insensitive.
   */
  hasReader(extension: string): boolean {
    return this.readers.has(extension.toLowerCase());
  }

  /**
   * Parse content using the appropriate reader for the file's extension.
   * Throws if no reader is registered for the extension.
   */
  parse(content: string, context: FileContext): Node {
    const reader = this.getReader(context.extension);
    if (!reader) {
      throw new Error(`No reader registered for extension: ${context.extension}`);
    }
    return reader.parse(content, context);
  }
}

/**
 * Create a registry with default readers pre-registered.
 * Returns a new instance each call.
 */
export function createDefaultRegistry(): ReaderRegistry {
  const registry = new ReaderRegistry();
  registry.register(new MarkdownReader());
  return registry;
}
