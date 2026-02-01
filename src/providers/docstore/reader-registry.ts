/**
 * FormatReader plugin architecture
 *
 * Provides a registry for file format readers, enabling multi-format support
 * in DocStore while keeping format-specific logic isolated.
 */

import type { FormatReader, FileContext, ParseResult } from './types.js';
import { isValidId } from './id.js';

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
   * Validates frontmatter ID and signals if writeback is needed.
   * Throws if no reader is registered for the extension.
   *
   * Note: Does NOT generate new IDs here - that happens in Phase 3's writeback.
   * Files without valid frontmatter IDs keep their path-based ID for now,
   * with needsIdWrite: true signaling that an ID should be generated and written.
   */
  parse(content: string, context: FileContext): ParseResult {
    const reader = this.getReader(context.extension);
    if (!reader) {
      throw new Error(`No reader registered for extension: ${context.extension}`);
    }
    const node = reader.parse(content, context);

    // Check if node has a valid stable frontmatter ID
    const needsIdWrite = !isValidId(node.id);

    return { node, needsIdWrite };
  }
}
