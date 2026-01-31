import { describe, it, expect } from 'vitest';
import {
  hasFileExtension,
  normalizePath,
  normalizeLinkTarget,
} from '../../../src/providers/docstore/normalize.js';

describe('normalize', () => {
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
      expect(hasFileExtension('file.h264')).toBe(true);
    });
  });

  describe('normalizePath', () => {
    it('lowercases the path', () => {
      expect(normalizePath('Notes/Research.md')).toBe('notes/research.md');
    });

    it('preserves extensions', () => {
      expect(normalizePath('file.md')).toBe('file.md');
      expect(normalizePath('file.txt')).toBe('file.txt');
    });

    it('handles nested paths', () => {
      expect(normalizePath('A/B/C/Deep.md')).toBe('a/b/c/deep.md');
    });

    it('normalizes mixed case', () => {
      expect(normalizePath('MyFolder/MyFile.MD')).toBe('myfolder/myfile.md');
    });

    it('handles paths without extension', () => {
      expect(normalizePath('folder/file')).toBe('folder/file');
    });

    it('handles single file names', () => {
      expect(normalizePath('README.md')).toBe('readme.md');
    });

    it('normalizes backslashes to forward slashes', () => {
      expect(normalizePath('folder\\subfolder\\file.md')).toBe(
        'folder/subfolder/file.md'
      );
    });
  });

  describe('normalizeLinkTarget', () => {
    it('lowercases the link', () => {
      expect(normalizeLinkTarget('MyNote')).toBe('mynote.md');
      expect(normalizeLinkTarget('UPPERCASE')).toBe('uppercase.md');
    });

    it('converts backslashes to forward slashes', () => {
      expect(normalizeLinkTarget('folder\\note')).toBe('folder/note.md');
      expect(normalizeLinkTarget('a\\b\\c')).toBe('a/b/c.md');
    });

    it('adds .md extension when missing', () => {
      expect(normalizeLinkTarget('note')).toBe('note.md');
      expect(normalizeLinkTarget('folder/note')).toBe('folder/note.md');
    });

    it('preserves existing file extensions', () => {
      expect(normalizeLinkTarget('note.md')).toBe('note.md');
      expect(normalizeLinkTarget('image.png')).toBe('image.png');
      expect(normalizeLinkTarget('data.json')).toBe('data.json');
    });

    it('adds .md to numeric pseudo-extensions', () => {
      expect(normalizeLinkTarget('report.2024')).toBe('report.2024.md');
    });

    it('handles combined transformations', () => {
      expect(normalizeLinkTarget('Folder\\MyNote')).toBe('folder/mynote.md');
      expect(normalizeLinkTarget('A\\B\\C.TXT')).toBe('a/b/c.txt');
    });

    it('trims leading whitespace', () => {
      expect(normalizeLinkTarget('  note')).toBe('note.md');
      expect(normalizeLinkTarget('\tnote')).toBe('note.md');
    });

    it('trims trailing whitespace', () => {
      expect(normalizeLinkTarget('note  ')).toBe('note.md');
      expect(normalizeLinkTarget('note\t')).toBe('note.md');
    });

    it('trims both leading and trailing whitespace', () => {
      expect(normalizeLinkTarget('  note  ')).toBe('note.md');
      expect(normalizeLinkTarget('  folder/note  ')).toBe('folder/note.md');
    });

    it('handles whitespace-only input', () => {
      expect(normalizeLinkTarget('   ')).toBe('.md');
    });

    describe('unicode handling', () => {
      it('lowercases accented characters', () => {
        expect(normalizeLinkTarget('Café')).toBe('café.md');
        expect(normalizeLinkTarget('RÉSUMÉ')).toBe('résumé.md');
      });

      it('preserves CJK characters (no case change)', () => {
        expect(normalizeLinkTarget('日本語')).toBe('日本語.md');
        expect(normalizeLinkTarget('中文笔记')).toBe('中文笔记.md');
      });

      it('handles mixed scripts', () => {
        expect(normalizeLinkTarget('Hello世界')).toBe('hello世界.md');
        expect(normalizeLinkTarget('Café☕Notes')).toBe('café☕notes.md');
      });

      it('handles emoji in link names', () => {
        expect(normalizeLinkTarget('🚀 Launch')).toBe('🚀 launch.md');
        expect(normalizeLinkTarget('Ideas 💡')).toBe('ideas 💡.md');
      });

      it('handles combining characters', () => {
        const withCombining = 'Note\u0301';
        const result = normalizeLinkTarget(withCombining);
        expect(result).toBe('note\u0301.md');
      });

      it('handles Greek uppercase', () => {
        expect(normalizeLinkTarget('ΩMEGA')).toBe('ωmega.md');
      });
    });
  });
});
