import { describe, it, expect, beforeEach } from 'vitest';
import { ReaderRegistry } from '../../../src/providers/docstore/reader-registry.js';
import {
  createDefaultRegistry,
  type FormatReader,
  type FileContext,
} from '../../../src/providers/docstore/index.js';
import type { Node } from '../../../src/types/node.js';
import * as typesModule from '../../../src/providers/docstore/types.js';

describe('ReaderRegistry', () => {
  let registry: ReaderRegistry;

  // Mock reader for testing
  const createMockReader = (exts: string[]): FormatReader => ({
    extensions: exts,
    parse: (content: string, context: FileContext): Node => ({
      id: context.relativePath.toLowerCase(),
      title: `Mock: ${context.relativePath}`,
      content,
      tags: [],
      outgoingLinks: [],
      properties: {},
      sourceRef: {
        type: 'file',
        path: context.absolutePath,
        lastModified: context.mtime,
      },
    }),
  });

  beforeEach(() => {
    registry = new ReaderRegistry();
  });

  describe('register', () => {
    it('succeeds for new extensions', () => {
      const reader = createMockReader(['.md']);
      expect(() => registry.register(reader)).not.toThrow();
    });

    it('throws for duplicate extension', () => {
      const reader1 = createMockReader(['.md']);
      const reader2 = createMockReader(['.md']);

      registry.register(reader1);
      expect(() => registry.register(reader2)).toThrow(/already registered.*\.md/i);
    });

    it('atomic rejection for multi-extension conflict', () => {
      const reader1 = createMockReader(['.md']);
      const reader2 = createMockReader(['.txt', '.md']); // .md conflicts

      registry.register(reader1);
      expect(() => registry.register(reader2)).toThrow(/already registered.*\.md/i);

      // .txt should NOT have been registered (atomic rollback)
      expect(registry.hasReader('.txt')).toBe(false);
    });

    it('registers multiple extensions from single reader', () => {
      const reader = createMockReader(['.md', '.markdown']);
      registry.register(reader);

      expect(registry.hasReader('.md')).toBe(true);
      expect(registry.hasReader('.markdown')).toBe(true);
    });
  });

  describe('getReader', () => {
    it('returns reader for registered extension', () => {
      const reader = createMockReader(['.md']);
      registry.register(reader);

      expect(registry.getReader('.md')).toBe(reader);
    });

    it('returns null for unknown extension', () => {
      expect(registry.getReader('.unknown')).toBeNull();
    });

    it('is case-insensitive', () => {
      const reader = createMockReader(['.md']);
      registry.register(reader);

      expect(registry.getReader('.MD')).toBe(reader);
      expect(registry.getReader('.Md')).toBe(reader);
    });
  });

  describe('getExtensions', () => {
    it('returns empty Set when no readers registered', () => {
      const exts = registry.getExtensions();
      expect(exts.size).toBe(0);
    });

    it('returns Set of all registered extensions', () => {
      registry.register(createMockReader(['.md', '.markdown']));
      registry.register(createMockReader(['.txt']));

      const exts = registry.getExtensions();
      expect(exts).toEqual(new Set(['.md', '.markdown', '.txt']));
    });
  });

  describe('hasReader', () => {
    it('returns false for unregistered extension', () => {
      expect(registry.hasReader('.unknown')).toBe(false);
    });

    it('returns true for registered extension', () => {
      registry.register(createMockReader(['.md']));
      expect(registry.hasReader('.md')).toBe(true);
    });

    it('is case-insensitive', () => {
      registry.register(createMockReader(['.md']));
      expect(registry.hasReader('.MD')).toBe(true);
    });
  });

  describe('parse', () => {
    it('dispatches to correct reader and returns ParseResult with complete node structure', () => {
      const mdReader = createMockReader(['.md']);
      const txtReader = createMockReader(['.txt']);
      registry.register(mdReader);
      registry.register(txtReader);

      const mtime = new Date('2024-01-15T12:00:00Z');
      const context: FileContext = {
        absolutePath: '/root/notes/test.md',
        relativePath: 'notes/test.md',
        extension: '.md',
        mtime,
      };

      const result = registry.parse('# Content', context);

      // Returns ParseResult, node needs ID written since mock uses path-based ID
      expect(result.needsIdWrite).toBe(true);

      // Verify complete node structure
      const node = result.node;
      // Path-based ID preserved (Phase 3 writeback will assign stable ID)
      expect(node.id).toBe('notes/test.md');
      expect(node.title).toBe('Mock: notes/test.md');
      expect(node.content).toBe('# Content');
      expect(node.tags).toEqual([]);
      expect(node.outgoingLinks).toEqual([]);
      expect(node.properties).toEqual({});
      expect(node.sourceRef).toEqual({
        type: 'file',
        path: '/root/notes/test.md',
        lastModified: mtime,
      });
    });

    it('throws for unknown extension', () => {
      const context: FileContext = {
        absolutePath: '/root/file.unknown',
        relativePath: 'file.unknown',
        extension: '.unknown',
        mtime: new Date(),
      };

      expect(() => registry.parse('content', context)).toThrow(/no reader.*\.unknown/i);
    });

    it('extension matching is case-insensitive', () => {
      registry.register(createMockReader(['.md']));

      const context: FileContext = {
        absolutePath: '/root/TEST.MD',
        relativePath: 'TEST.MD',
        extension: '.MD',
        mtime: new Date(),
      };

      expect(() => registry.parse('content', context)).not.toThrow();
    });
  });

  describe('createDefaultRegistry', () => {
    it('has .md registered', () => {
      const defaultRegistry = createDefaultRegistry();
      expect(defaultRegistry.hasReader('.md')).toBe(true);
    });

    it('has .markdown registered', () => {
      const defaultRegistry = createDefaultRegistry();
      expect(defaultRegistry.hasReader('.markdown')).toBe(true);
    });

    it('returns extensions Set containing both', () => {
      const defaultRegistry = createDefaultRegistry();
      const exts = defaultRegistry.getExtensions();
      expect(exts.has('.md')).toBe(true);
      expect(exts.has('.markdown')).toBe(true);
    });
  });

  describe('types.ts contract', () => {
    it('exports only types (no runtime exports)', () => {
      // types.ts should contain only TypeScript interfaces/types
      // which compile away to nothing at runtime
      const runtimeExports = Object.keys(typesModule);
      expect(runtimeExports).toEqual([]);
    });
  });

  describe('parse() ID handling', () => {
    const createReaderWithId = (frontmatterId?: string): FormatReader => ({
      extensions: ['.md'],
      parse: (content: string, context: FileContext): Node => ({
        id: frontmatterId ?? context.relativePath.toLowerCase(),
        title: `Test: ${context.relativePath}`,
        content,
        tags: [],
        outgoingLinks: [],
        properties: frontmatterId ? { _frontmatterId: frontmatterId } : {},
        sourceRef: {
          type: 'file',
          path: context.absolutePath,
          lastModified: context.mtime,
        },
      }),
    });

    const baseContext: FileContext = {
      absolutePath: '/root/notes/test.md',
      relativePath: 'notes/test.md',
      extension: '.md',
      mtime: new Date('2024-01-15T12:00:00Z'),
    };

    it('uses valid frontmatter ID, needsIdWrite: false', () => {
      // Valid 12-char nanoid
      const validId = 'Ab3_Xy-9Qz1w';
      const reader = createReaderWithId(validId);
      registry.register(reader);

      const result = registry.parse('# Content', baseContext);

      expect(result.node.id).toBe(validId);
      expect(result.needsIdWrite).toBe(false);
    });

    it('keeps path-based ID when missing frontmatter ID, needsIdWrite: true', () => {
      // Reader returns path-based ID (no frontmatter ID)
      const reader = createReaderWithId(undefined);
      registry.register(reader);

      const result = registry.parse('# Content', baseContext);

      // Path-based ID is preserved (Phase 3 writeback will assign stable ID)
      expect(result.node.id).toBe('notes/test.md');
      expect(result.needsIdWrite).toBe(true);
    });

    it('keeps invalid path-style ID, needsIdWrite: true', () => {
      // Path-style ID is invalid (contains slash)
      const reader = createReaderWithId('notes/foo.md');
      registry.register(reader);

      const result = registry.parse('# Content', baseContext);

      // ID preserved, but flagged for writeback
      expect(result.node.id).toBe('notes/foo.md');
      expect(result.needsIdWrite).toBe(true);
    });

    it('keeps empty string ID, needsIdWrite: true', () => {
      const reader = createReaderWithId('');
      registry.register(reader);

      const result = registry.parse('# Content', baseContext);

      expect(result.node.id).toBe('');
      expect(result.needsIdWrite).toBe(true);
    });

    it('keeps too-short ID, needsIdWrite: true', () => {
      // 6 chars instead of 12
      const reader = createReaderWithId('abc123');
      registry.register(reader);

      const result = registry.parse('# Content', baseContext);

      // ID preserved, flagged for writeback
      expect(result.node.id).toBe('abc123');
      expect(result.needsIdWrite).toBe(true);
    });
  });
});
