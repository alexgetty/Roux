import { describe, it, expect } from 'vitest';
import { MarkdownReader } from '../../../../src/providers/docstore/readers/markdown.js';
import type { FileContext } from '../../../../src/providers/docstore/types.js';

describe('MarkdownReader', () => {
  const reader = new MarkdownReader();

  const createContext = (relativePath: string, absolutePath?: string): FileContext => ({
    absolutePath: absolutePath ?? `/root/${relativePath}`,
    relativePath,
    extension: '.md',
    mtime: new Date('2024-01-15T10:00:00Z'),
  });

  describe('extensions', () => {
    it('handles .md and .markdown', () => {
      expect(reader.extensions).toContain('.md');
      expect(reader.extensions).toContain('.markdown');
    });
  });

  describe('parse', () => {
    it('parses frontmatter title', () => {
      const content = `---
title: My Note
---
Body content`;
      const context = createContext('notes/test.md');
      const node = reader.parse(content, context);

      expect(node.title).toBe('My Note');
    });

    it('parses frontmatter tags', () => {
      const content = `---
tags:
  - tag1
  - tag2
---
Content`;
      const context = createContext('test.md');
      const node = reader.parse(content, context);

      expect(node.tags).toEqual(['tag1', 'tag2']);
    });

    it('parses frontmatter properties', () => {
      const content = `---
title: Test
custom: value
count: 42
---
Content`;
      const context = createContext('test.md');
      const node = reader.parse(content, context);

      expect(node.properties['custom']).toBe('value');
      expect(node.properties['count']).toBe(42);
    });

    it('derives title from path when missing from frontmatter', () => {
      const content = `---
tags: [test]
---
No title in frontmatter`;
      const context = createContext('my-derived-title.md');
      const node = reader.parse(content, context);

      expect(node.title).toBe('My Derived Title');
    });

    it('normalizes ID to lowercase', () => {
      const content = '# Simple content';
      const context = createContext('Folder/CamelCase.md');
      const node = reader.parse(content, context);

      expect(node.id).toBe('folder/camelcase.md');
    });

    it('extracts wiki-links from content', () => {
      const content = 'Links to [[Note A]] and [[Note B]]';
      const context = createContext('source.md');
      const node = reader.parse(content, context);

      expect(node.outgoingLinks).toContain('note a.md');
      expect(node.outgoingLinks).toContain('note b.md');
    });

    it('normalizes wiki-links (lowercase, adds .md)', () => {
      const content = 'Link to [[Target Note]]';
      const context = createContext('source.md');
      const node = reader.parse(content, context);

      expect(node.outgoingLinks).toContain('target note.md');
    });

    it('handles aliased wiki-links', () => {
      const content = 'Link to [[target|Display Text]]';
      const context = createContext('source.md');
      const node = reader.parse(content, context);

      expect(node.outgoingLinks).toContain('target.md');
    });

    it('populates sourceRef from context', () => {
      const content = '# Content';
      const mtime = new Date('2024-01-15T10:00:00Z');
      const context: FileContext = {
        absolutePath: '/root/notes/test.md',
        relativePath: 'notes/test.md',
        extension: '.md',
        mtime,
      };
      const node = reader.parse(content, context);

      expect(node.sourceRef).toEqual({
        type: 'file',
        path: '/root/notes/test.md',
        lastModified: mtime,
      });
    });

    it('handles file without frontmatter', () => {
      const content = '# Just Markdown\n\nNo frontmatter here.';
      const context = createContext('plain.md');
      const node = reader.parse(content, context);

      expect(node.title).toBe('Plain'); // derived from path
      expect(node.tags).toEqual([]);
      expect(node.content).toContain('Just Markdown');
    });

    it('handles malformed frontmatter gracefully (does not throw)', () => {
      const content = `---
malformed: [unclosed
  - list
---
Body`;
      const context = createContext('broken.md');

      // Should not throw
      expect(() => reader.parse(content, context)).not.toThrow();

      const node = reader.parse(content, context);
      expect(node.id).toBe('broken.md');
    });

    it('preserves content after frontmatter', () => {
      const content = `---
title: Test
---
# Heading

Body paragraph with **bold** text.`;
      const context = createContext('test.md');
      const node = reader.parse(content, context);

      expect(node.content).toContain('Heading');
      expect(node.content).toContain('bold');
    });

    it('handles empty content', () => {
      const content = '';
      const context = createContext('empty.md');
      const node = reader.parse(content, context);

      expect(node.id).toBe('empty.md');
      expect(node.title).toBe('Empty');
      expect(node.content).toBe('');
    });

    it('handles deeply nested paths', () => {
      const content = '# Deep';
      const context = createContext('a/b/c/d/deep.md', '/root/a/b/c/d/deep.md');
      const node = reader.parse(content, context);

      expect(node.id).toBe('a/b/c/d/deep.md');
      expect(node.sourceRef?.path).toBe('/root/a/b/c/d/deep.md');
    });

    it('does not add .md to links with existing extensions', () => {
      const content = 'Links: [[file.md]] and [[doc.txt]]';
      const context = createContext('source.md');
      const node = reader.parse(content, context);

      expect(node.outgoingLinks).toContain('file.md');
      expect(node.outgoingLinks).toContain('doc.txt');
      expect(node.outgoingLinks).not.toContain('file.md.md');
    });
  });
});
