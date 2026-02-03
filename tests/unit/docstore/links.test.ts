import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    // All fixtures now use nanoid-based IDs with title and optional sourceRef

    it('indexes nodes by title (primary key)', () => {
      const nodes = [
        { id: 'abc123xyz789', title: 'Alpha', sourceRef: { path: '/vault/notes/alpha.md' } },
        { id: 'def456uvw012', title: 'Beta', sourceRef: { path: '/vault/notes/beta.md' } },
        { id: 'ghi789rst345', title: 'Gamma', sourceRef: { path: '/vault/archive/gamma.md' } },
      ];

      const index = buildFilenameIndex(nodes);

      // Titles are indexed lowercase
      expect(index.get('alpha')).toEqual(['abc123xyz789']);
      expect(index.get('beta')).toEqual(['def456uvw012']);
      expect(index.get('gamma')).toEqual(['ghi789rst345']);
    });

    it('indexes nodes by title case-insensitively', () => {
      const nodes = [
        { id: 'abc123xyz789', title: 'My Note', sourceRef: { path: '/vault/my note.md' } },
      ];

      const index = buildFilenameIndex(nodes);

      // Title lookup is case-insensitive
      expect(index.get('my note')).toEqual(['abc123xyz789']);
    });

    it('falls back to filename from sourceRef.path when title differs', () => {
      const nodes = [
        { id: 'abc123xyz789', title: 'Recipe: Bulgogi', sourceRef: { path: '/vault/recipes/bulgogi.md' } },
      ];

      const index = buildFilenameIndex(nodes);

      // Both title and filename indexed
      expect(index.get('recipe: bulgogi')).toEqual(['abc123xyz789']);
      expect(index.get('bulgogi')).toEqual(['abc123xyz789']); // filename fallback
    });

    it('does not duplicate filename index when title matches filename', () => {
      const nodes = [
        { id: 'abc123xyz789', title: 'Bulgogi', sourceRef: { path: '/vault/recipes/bulgogi.md' } },
      ];

      const index = buildFilenameIndex(nodes);

      // Only one entry since title === filename (case-insensitive)
      expect(index.get('bulgogi')).toEqual(['abc123xyz789']);
    });

    it('groups duplicate titles and sorts alphabetically', () => {
      const nodes = [
        { id: 'zzz999aaa111', title: 'README', sourceRef: { path: '/vault/z/readme.md' } },
        { id: 'aaa111bbb222', title: 'README', sourceRef: { path: '/vault/a/readme.md' } },
        { id: 'mmm555nnn666', title: 'README', sourceRef: { path: '/vault/m/readme.md' } },
      ];

      const index = buildFilenameIndex(nodes);
      const readmes = index.get('readme');

      // Sorted alphabetically by ID
      expect(readmes).toEqual(['aaa111bbb222', 'mmm555nnn666', 'zzz999aaa111']);
    });

    it('handles node with title but no sourceRef', () => {
      const nodes = [
        { id: 'abc123xyz789', title: 'Standalone Note' },
      ];

      const index = buildFilenameIndex(nodes);

      // Indexed by title only
      expect(index.get('standalone note')).toEqual(['abc123xyz789']);
    });

    it('handles node with sourceRef but no title (empty string)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const nodes = [
        { id: 'abc123xyz789', title: '', sourceRef: { path: '/vault/notes/orphan.md' } },
      ];

      const index = buildFilenameIndex(nodes);

      // Indexed by filename only
      expect(index.get('orphan')).toEqual(['abc123xyz789']);
      // No warning since filename provides indexability
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('warns when node has neither title nor path', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const nodes = [
        { id: 'abc123xyz789', title: '' },
      ];

      buildFilenameIndex(nodes);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('abc123xyz789')
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('no title or path')
      );

      warnSpy.mockRestore();
    });

    it('handles node with empty sourceRef.path', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const nodes = [
        { id: 'abc123xyz789', title: '', sourceRef: { path: '' } },
      ];

      buildFilenameIndex(nodes);

      // Should warn since both title and path are empty
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('no title or path')
      );

      warnSpy.mockRestore();
    });

    it('returns empty map for empty input', () => {
      const index = buildFilenameIndex([]);
      expect(index.size).toBe(0);
    });

    it('handles partial path in wikilink unchanged', () => {
      // This is a resolveLinks behavior, but verifying buildFilenameIndex
      // does not try to parse paths as keys
      const nodes = [
        { id: 'abc123xyz789', title: 'My Note', sourceRef: { path: '/vault/notes/my note.md' } },
      ];

      const index = buildFilenameIndex(nodes);

      // Partial paths are NOT indexed - they're resolved differently
      expect(index.has('notes/my note')).toBe(false);
    });
  });

  describe('resolveLinks', () => {
    // Fixtures using nanoid-based IDs with title-based index
    const filenameIndex = new Map([
      ['alpha', ['abc123xyz789']], // title-based
      ['beta', ['def456uvw012']], // title-based
      ['readme', ['aaa111bbb222', 'zzz999ccc333']], // collision
    ]);

    const validNodeIds = new Set([
      'abc123xyz789',
      'def456uvw012',
      'aaa111bbb222',
      'zzz999ccc333',
    ]);

    it('keeps links that already match valid node IDs', () => {
      const links = ['abc123xyz789', 'def456uvw012'];
      const resolved = resolveLinks(links, filenameIndex, validNodeIds);

      expect(resolved).toEqual(['abc123xyz789', 'def456uvw012']);
    });

    it('resolves bare titles via index lookup', () => {
      // [[Alpha]] normalized to alpha.md, lookup finds abc123xyz789
      const links = ['alpha.md', 'beta.md'];
      const resolved = resolveLinks(links, filenameIndex, validNodeIds);

      expect(resolved).toEqual(['abc123xyz789', 'def456uvw012']);
    });

    it('returns first match alphabetically for duplicate titles', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const links = ['readme.md'];
      const resolved = resolveLinks(links, filenameIndex, validNodeIds);

      expect(resolved).toEqual(['aaa111bbb222']);
      warnSpy.mockRestore();
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
        'abc123xyz789', // exact match (valid ID)
        'beta.md', // title resolution
        'folder/unknown.md', // partial path, no resolution
        'missing.md', // no match
      ];

      const resolved = resolveLinks(links, filenameIndex, validNodeIds);

      expect(resolved).toEqual([
        'abc123xyz789',
        'def456uvw012',
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
        ['sesame-oil', ['abc123xyz789']],
      ]);
      const ids = new Set(['abc123xyz789']);

      const resolved = resolveLinks(['sesame oil.md'], index, ids);
      expect(resolved).toEqual(['abc123xyz789']);
    });

    it('resolves dashed link to spaced file via fallback', () => {
      const index = new Map([
        ['sesame oil', ['abc123xyz789']],
      ]);
      const ids = new Set(['abc123xyz789']);

      const resolved = resolveLinks(['sesame-oil.md'], index, ids);
      expect(resolved).toEqual(['abc123xyz789']);
    });

    it('prefers exact match over variant', () => {
      const index = new Map([
        ['sesame oil', ['abc123xyz789']],
        ['sesame-oil', ['def456uvw012']],
      ]);
      const ids = new Set(['abc123xyz789', 'def456uvw012']);

      const resolved = resolveLinks(['sesame oil.md'], index, ids);
      expect(resolved).toEqual(['abc123xyz789']);
    });

    it('skips variant when filename has both spaces and dashes', () => {
      const index = new Map<string, string[]>();
      const ids = new Set<string>();

      const resolved = resolveLinks(['sesame oil-blend.md'], index, ids);
      expect(resolved).toEqual(['sesame oil-blend.md']);
    });

    it('resolves multi-word space-dash variants', () => {
      const index = new Map([
        ['cast-iron-pan', ['abc123xyz789']],
      ]);
      const ids = new Set(['abc123xyz789']);

      const resolved = resolveLinks(['cast iron pan.md'], index, ids);
      expect(resolved).toEqual(['abc123xyz789']);
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

    // Fix #9: Space-dash edge case tests
    describe('edge cases', () => {
      it('handles multiple consecutive spaces', () => {
        // Document current behavior: multiple spaces become multiple dashes
        expect(spaceDashVariant('a  b')).toBe('a--b');
      });

      it('handles leading/trailing spaces', () => {
        // Document current behavior: leading/trailing spaces become leading/trailing dashes
        expect(spaceDashVariant(' note ')).toBe('-note-');
      });

      it('handles mixed separators', () => {
        // Has both space AND dash, should return null
        expect(spaceDashVariant('a - b')).toBeNull();
      });
    });
  });

  // Fix #1: Title collision warning at resolution time
  describe('resolveLinks collision warning', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('logs warning when resolving ambiguous wikilink with multiple matches', () => {
      const filenameIndex = new Map([
        ['readme', ['aaa111bbb222', 'zzz999ccc333']], // Two nodes with same title
      ]);
      const validNodeIds = new Set(['aaa111bbb222', 'zzz999ccc333']);

      const resolved = resolveLinks(['readme.md'], filenameIndex, validNodeIds);

      // Should still resolve to first match
      expect(resolved).toEqual(['aaa111bbb222']);

      // Should log warning about ambiguity
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('readme')
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('2')
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('aaa111bbb222')
      );
    });

    it('does not log warning for unique wikilink resolution', () => {
      const filenameIndex = new Map([
        ['unique', ['abc123xyz789']], // Only one node with this title
      ]);
      const validNodeIds = new Set(['abc123xyz789']);

      resolveLinks(['unique.md'], filenameIndex, validNodeIds);

      // No warning for single match
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('logs warning when variant match has multiple nodes (lines 141-144)', () => {
      // Test the variant fallback ambiguity warning
      // When exact match fails but space-dash variant has multiple matches
      const filenameIndex = new Map([
        // No direct 'sesame oil' entry, but 'sesame-oil' has multiple nodes
        ['sesame-oil', ['abc123xyz789', 'def456uvw012']],
      ]);
      const validNodeIds = new Set(['abc123xyz789', 'def456uvw012']);

      // Link with spaces falls back to variant (dashes)
      const resolved = resolveLinks(['sesame oil.md'], filenameIndex, validNodeIds);

      // Should resolve to first match alphabetically
      expect(resolved).toEqual(['abc123xyz789']);

      // Should log warning about variant ambiguity
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('sesame oil')
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('2')
      );
    });

    it('does not log warning for unique variant match', () => {
      const filenameIndex = new Map([
        // Only one node matches via variant
        ['sesame-oil', ['abc123xyz789']],
      ]);
      const validNodeIds = new Set(['abc123xyz789']);

      resolveLinks(['sesame oil.md'], filenameIndex, validNodeIds);

      // No warning for single variant match
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  // Fix #10: Fragment links not stripped
  describe('fragment link handling', () => {
    it('strips fragment before resolution', () => {
      const filenameIndex = new Map([
        ['note', ['abc123xyz789']],
      ]);
      const validNodeIds = new Set(['abc123xyz789']);

      // [[Note#Section]] should resolve to node "Note"
      const resolved = resolveLinks(['note#section.md'], filenameIndex, validNodeIds);
      expect(resolved).toEqual(['abc123xyz789']);
    });

    it('strips fragment with complex heading', () => {
      const filenameIndex = new Map([
        ['getting started', ['def456uvw012']],
      ]);
      const validNodeIds = new Set(['def456uvw012']);

      // [[Getting Started#Installation Guide]] should resolve to "Getting Started"
      const resolved = resolveLinks(['getting started#installation guide.md'], filenameIndex, validNodeIds);
      expect(resolved).toEqual(['def456uvw012']);
    });

    it('handles multiple fragments gracefully', () => {
      const filenameIndex = new Map([
        ['note', ['abc123xyz789']],
      ]);
      const validNodeIds = new Set(['abc123xyz789']);

      // Unusual but possible: [[Note#One#Two]]
      // Should strip everything after first #
      const resolved = resolveLinks(['note#one#two.md'], filenameIndex, validNodeIds);
      expect(resolved).toEqual(['abc123xyz789']);
    });

    it('keeps fragment link as-is when no match found', () => {
      const filenameIndex = new Map<string, string[]>();
      const validNodeIds = new Set<string>();

      // No match for "missing", should keep the original with fragment
      const resolved = resolveLinks(['missing#section.md'], filenameIndex, validNodeIds);
      expect(resolved).toEqual(['missing#section.md']);
    });
  });
});
