import { describe, it, expect } from 'vitest';
import {
  normalizeWikiLink,
  hasFileExtension,
  buildFilenameIndex,
  resolveLinks,
} from '../../../src/providers/docstore/links.js';

describe('links', () => {
  describe('hasFileExtension', () => {
    it('returns true for common extensions', () => {
      expect(hasFileExtension('file.md')).toBe(true);
      expect(hasFileExtension('image.png')).toBe(true);
      expect(hasFileExtension('data.json')).toBe(true);
      expect(hasFileExtension('doc.txt')).toBe(true);
    });

    it('returns true for mixed case extensions', () => {
      expect(hasFileExtension('file.MD')).toBe(true);
      expect(hasFileExtension('image.PNG')).toBe(true);
    });

    it('returns false for no extension', () => {
      expect(hasFileExtension('filename')).toBe(false);
      expect(hasFileExtension('path/to/file')).toBe(false);
    });

    it('returns false for numeric-only extensions', () => {
      expect(hasFileExtension('file.2024')).toBe(false);
      expect(hasFileExtension('doc.123')).toBe(false);
    });

    it('returns false for dot-only paths', () => {
      expect(hasFileExtension('.')).toBe(false);
      expect(hasFileExtension('..')).toBe(false);
      expect(hasFileExtension('.hidden')).toBe(false);
    });

    it('returns false for extensions longer than 4 chars', () => {
      expect(hasFileExtension('file.typescript')).toBe(false);
    });

    it('returns true for alphanumeric extensions with at least one letter', () => {
      expect(hasFileExtension('file.mp3')).toBe(true);
      expect(hasFileExtension('file.h264')).toBe(true); // has letter 'h'
    });
  });

  describe('normalizeWikiLink', () => {
    it('lowercases the link', () => {
      expect(normalizeWikiLink('MyNote')).toBe('mynote.md');
      expect(normalizeWikiLink('UPPERCASE')).toBe('uppercase.md');
    });

    it('converts backslashes to forward slashes', () => {
      expect(normalizeWikiLink('folder\\note')).toBe('folder/note.md');
      expect(normalizeWikiLink('a\\b\\c')).toBe('a/b/c.md');
    });

    it('adds .md extension when missing', () => {
      expect(normalizeWikiLink('note')).toBe('note.md');
      expect(normalizeWikiLink('folder/note')).toBe('folder/note.md');
    });

    it('preserves existing file extensions', () => {
      expect(normalizeWikiLink('note.md')).toBe('note.md');
      expect(normalizeWikiLink('image.png')).toBe('image.png');
      expect(normalizeWikiLink('data.json')).toBe('data.json');
    });

    it('adds .md to numeric pseudo-extensions', () => {
      expect(normalizeWikiLink('report.2024')).toBe('report.2024.md');
    });

    it('handles combined transformations', () => {
      expect(normalizeWikiLink('Folder\\MyNote')).toBe('folder/mynote.md');
      expect(normalizeWikiLink('A\\B\\C.TXT')).toBe('a/b/c.txt');
    });
  });

  describe('buildFilenameIndex', () => {
    it('builds index from node IDs', () => {
      const nodes = [
        { id: 'notes/alpha.md' },
        { id: 'notes/beta.md' },
        { id: 'archive/gamma.md' },
      ];

      const index = buildFilenameIndex(nodes);

      expect(index.get('alpha.md')).toEqual(['notes/alpha.md']);
      expect(index.get('beta.md')).toEqual(['notes/beta.md']);
      expect(index.get('gamma.md')).toEqual(['archive/gamma.md']);
    });

    it('groups duplicate basenames and sorts alphabetically', () => {
      const nodes = [
        { id: 'z/readme.md' },
        { id: 'a/readme.md' },
        { id: 'm/readme.md' },
      ];

      const index = buildFilenameIndex(nodes);
      const readmes = index.get('readme.md');

      expect(readmes).toEqual(['a/readme.md', 'm/readme.md', 'z/readme.md']);
    });

    it('handles root-level files', () => {
      const nodes = [{ id: 'root.md' }];

      const index = buildFilenameIndex(nodes);

      expect(index.get('root.md')).toEqual(['root.md']);
    });

    it('returns empty map for empty input', () => {
      const index = buildFilenameIndex([]);
      expect(index.size).toBe(0);
    });
  });

  describe('resolveLinks', () => {
    const filenameIndex = new Map([
      ['alpha.md', ['notes/alpha.md']],
      ['beta.md', ['notes/beta.md']],
      ['readme.md', ['a/readme.md', 'z/readme.md']],
    ]);

    const validNodeIds = new Set([
      'notes/alpha.md',
      'notes/beta.md',
      'a/readme.md',
      'z/readme.md',
    ]);

    it('keeps links that already match valid node IDs', () => {
      const links = ['notes/alpha.md', 'notes/beta.md'];
      const resolved = resolveLinks(links, filenameIndex, validNodeIds);

      expect(resolved).toEqual(['notes/alpha.md', 'notes/beta.md']);
    });

    it('resolves bare filenames via basename lookup', () => {
      const links = ['alpha.md', 'beta.md'];
      const resolved = resolveLinks(links, filenameIndex, validNodeIds);

      expect(resolved).toEqual(['notes/alpha.md', 'notes/beta.md']);
    });

    it('returns first match alphabetically for duplicate basenames', () => {
      const links = ['readme.md'];
      const resolved = resolveLinks(links, filenameIndex, validNodeIds);

      expect(resolved).toEqual(['a/readme.md']);
    });

    it('keeps partial paths as-is (no resolution)', () => {
      const links = ['folder/missing.md'];
      const resolved = resolveLinks(links, filenameIndex, validNodeIds);

      expect(resolved).toEqual(['folder/missing.md']);
    });

    it('keeps unresolvable bare filenames as-is', () => {
      const links = ['nonexistent.md'];
      const resolved = resolveLinks(links, filenameIndex, validNodeIds);

      expect(resolved).toEqual(['nonexistent.md']);
    });

    it('handles mixed link types', () => {
      const links = [
        'notes/alpha.md', // exact match
        'beta.md', // basename resolution
        'folder/unknown.md', // partial path, no resolution
        'missing.md', // no match
      ];

      const resolved = resolveLinks(links, filenameIndex, validNodeIds);

      expect(resolved).toEqual([
        'notes/alpha.md',
        'notes/beta.md',
        'folder/unknown.md',
        'missing.md',
      ]);
    });

    it('returns empty array for empty input', () => {
      const resolved = resolveLinks([], filenameIndex, validNodeIds);
      expect(resolved).toEqual([]);
    });
  });
});
