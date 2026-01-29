import { describe, it, expect } from 'vitest';
import {
  normalizeWikiLink,
  hasFileExtension,
  buildFilenameIndex,
  resolveLinks,
  spaceDashVariant,
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

    it('returns false for empty string', () => {
      expect(hasFileExtension('')).toBe(false);
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

    it('trims leading whitespace', () => {
      expect(normalizeWikiLink('  note')).toBe('note.md');
      expect(normalizeWikiLink('\tnote')).toBe('note.md');
    });

    it('trims trailing whitespace', () => {
      expect(normalizeWikiLink('note  ')).toBe('note.md');
      expect(normalizeWikiLink('note\t')).toBe('note.md');
    });

    it('trims both leading and trailing whitespace', () => {
      expect(normalizeWikiLink('  note  ')).toBe('note.md');
      expect(normalizeWikiLink('  folder/note  ')).toBe('folder/note.md');
    });

    it('handles whitespace-only input', () => {
      // Whitespace-only should become empty + .md = ".md"
      // This is arguably invalid, but documenting current behavior
      expect(normalizeWikiLink('   ')).toBe('.md');
    });

    describe('unicode handling', () => {
      it('lowercases accented characters', () => {
        expect(normalizeWikiLink('Café')).toBe('café.md');
        expect(normalizeWikiLink('RÉSUMÉ')).toBe('résumé.md');
      });

      it('preserves CJK characters (no case change)', () => {
        expect(normalizeWikiLink('日本語')).toBe('日本語.md');
        expect(normalizeWikiLink('中文笔记')).toBe('中文笔记.md');
      });

      it('handles mixed scripts', () => {
        expect(normalizeWikiLink('Hello世界')).toBe('hello世界.md');
        expect(normalizeWikiLink('Café☕Notes')).toBe('café☕notes.md');
      });

      it('handles emoji in link names', () => {
        expect(normalizeWikiLink('🚀 Launch')).toBe('🚀 launch.md');
        expect(normalizeWikiLink('Ideas 💡')).toBe('ideas 💡.md');
      });

      it('handles combining characters', () => {
        // e + combining acute = é
        const withCombining = 'Note\u0301';
        const result = normalizeWikiLink(withCombining);
        expect(result).toBe('note\u0301.md');
      });

      it('handles Greek uppercase', () => {
        expect(normalizeWikiLink('ΩMEGA')).toBe('ωmega.md');
      });
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

    it('resolves space link to dashed file via fallback', () => {
      const index = new Map([
        ['sesame-oil.md', ['ingredients/sesame-oil.md']],
      ]);
      const ids = new Set(['ingredients/sesame-oil.md']);

      const resolved = resolveLinks(['sesame oil.md'], index, ids);
      expect(resolved).toEqual(['ingredients/sesame-oil.md']);
    });

    it('resolves dashed link to spaced file via fallback', () => {
      const index = new Map([
        ['sesame oil.md', ['ingredients/sesame oil.md']],
      ]);
      const ids = new Set(['ingredients/sesame oil.md']);

      const resolved = resolveLinks(['sesame-oil.md'], index, ids);
      expect(resolved).toEqual(['ingredients/sesame oil.md']);
    });

    it('prefers exact match over variant', () => {
      const index = new Map([
        ['sesame oil.md', ['ingredients/sesame oil.md']],
        ['sesame-oil.md', ['other/sesame-oil.md']],
      ]);
      const ids = new Set(['ingredients/sesame oil.md', 'other/sesame-oil.md']);

      const resolved = resolveLinks(['sesame oil.md'], index, ids);
      expect(resolved).toEqual(['ingredients/sesame oil.md']);
    });

    it('skips variant when filename has both spaces and dashes', () => {
      const index = new Map<string, string[]>();
      const ids = new Set<string>();

      const resolved = resolveLinks(['sesame oil-blend.md'], index, ids);
      expect(resolved).toEqual(['sesame oil-blend.md']);
    });

    it('resolves multi-word space-dash variants', () => {
      const index = new Map([
        ['cast-iron-pan.md', ['equipment/cast-iron-pan.md']],
      ]);
      const ids = new Set(['equipment/cast-iron-pan.md']);

      const resolved = resolveLinks(['cast iron pan.md'], index, ids);
      expect(resolved).toEqual(['equipment/cast-iron-pan.md']);
    });
  });

  describe('spaceDashVariant', () => {
    it('converts spaces to dashes', () => {
      expect(spaceDashVariant('sesame oil.md')).toBe('sesame-oil.md');
    });

    it('converts dashes to spaces', () => {
      expect(spaceDashVariant('sesame-oil.md')).toBe('sesame oil.md');
    });

    it('returns null when both spaces and dashes present', () => {
      expect(spaceDashVariant('sesame oil-blend.md')).toBeNull();
    });

    it('returns null when neither spaces nor dashes present', () => {
      expect(spaceDashVariant('sesameoil.md')).toBeNull();
    });

    it('handles multiple word boundaries', () => {
      expect(spaceDashVariant('cast iron pan.md')).toBe('cast-iron-pan.md');
    });

    it('handles multiple dashes', () => {
      expect(spaceDashVariant('cast-iron-pan.md')).toBe('cast iron pan.md');
    });
  });
});
