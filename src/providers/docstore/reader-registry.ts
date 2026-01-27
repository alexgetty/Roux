/**
 * FormatReader plugin architecture
 *
 * Provides a registry for file format readers, enabling multi-format support
 * in DocStore while keeping format-specific logic isolated.
 */

import type { Node } from '../../types/node.js';
import type { FormatReader, FileContext } from './types.js';

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
