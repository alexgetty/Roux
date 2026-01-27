import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  getFileMtime,
  validatePathWithinSource,
  collectFiles,
  readFileContent,
} from '../../../src/providers/docstore/file-operations.js';
import { EXCLUDED_DIRS } from '../../../src/providers/docstore/watcher.js';

describe('file-operations', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'roux-file-ops-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('getFileMtime', () => {
    it('returns mtime in milliseconds', async () => {
      const filePath = join(tempDir, 'test.md');
      await writeFile(filePath, 'content');

      const mtime = await getFileMtime(filePath);

      expect(typeof mtime).toBe('number');
      expect(mtime).toBeGreaterThan(0);
      // mtime should be recent (within last minute)
      expect(Date.now() - mtime).toBeLessThan(60000);
    });

    it('throws ENOENT for missing file', async () => {
      const missingPath = join(tempDir, 'does-not-exist.md');

      await expect(getFileMtime(missingPath)).rejects.toThrow();
      try {
        await getFileMtime(missingPath);
      } catch (err) {
        expect((err as NodeJS.ErrnoException).code).toBe('ENOENT');
      }
    });
  });

  describe('validatePathWithinSource', () => {
    it('allows valid paths within source root', () => {
      expect(() => validatePathWithinSource(tempDir, 'file.md')).not.toThrow();
      expect(() => validatePathWithinSource(tempDir, 'folder/file.md')).not.toThrow();
      expect(() => validatePathWithinSource(tempDir, 'deep/nested/file.md')).not.toThrow();
    });

    it('throws on path traversal with ../', () => {
      expect(() => validatePathWithinSource(tempDir, '../escape.md')).toThrow(/outside.*source/i);
      expect(() => validatePathWithinSource(tempDir, '../../etc/passwd')).toThrow(/outside.*source/i);
    });

    it('throws on path traversal with folder/../.. pattern', () => {
      expect(() => validatePathWithinSource(tempDir, 'folder/../../escape.md')).toThrow(/outside.*source/i);
    });

    it('allows paths that look like traversal but resolve within root', () => {
      // folder/../file.md resolves to file.md which is still within root
      expect(() => validatePathWithinSource(tempDir, 'folder/../file.md')).not.toThrow();
    });
  });

  describe('collectFiles', () => {
    it('collects files by extension', async () => {
      await writeFile(join(tempDir, 'a.md'), 'a');
      await writeFile(join(tempDir, 'b.md'), 'b');
      await writeFile(join(tempDir, 'c.txt'), 'c');

      const files = await collectFiles(tempDir, new Set(['.md']));

      expect(files.sort()).toEqual([
        join(tempDir, 'a.md'),
        join(tempDir, 'b.md'),
      ]);
    });

    it('filters by multiple extensions', async () => {
      await writeFile(join(tempDir, 'a.md'), 'a');
      await writeFile(join(tempDir, 'b.markdown'), 'b');
      await writeFile(join(tempDir, 'c.txt'), 'c');

      const files = await collectFiles(tempDir, new Set(['.md', '.markdown']));

      expect(files.sort()).toEqual([
        join(tempDir, 'a.md'),
        join(tempDir, 'b.markdown'),
      ]);
    });

    it('recurses into subdirectories', async () => {
      await mkdir(join(tempDir, 'sub'), { recursive: true });
      await writeFile(join(tempDir, 'root.md'), 'root');
      await writeFile(join(tempDir, 'sub/nested.md'), 'nested');

      const files = await collectFiles(tempDir, new Set(['.md']));

      expect(files.sort()).toEqual([
        join(tempDir, 'root.md'),
        join(tempDir, 'sub/nested.md'),
      ]);
    });

    it('respects EXCLUDED_DIRS', async () => {
      // Create directories matching excluded patterns
      for (const excluded of EXCLUDED_DIRS) {
        await mkdir(join(tempDir, excluded), { recursive: true });
        await writeFile(join(tempDir, excluded, 'hidden.md'), 'hidden');
      }
      await writeFile(join(tempDir, 'visible.md'), 'visible');

      const files = await collectFiles(tempDir, new Set(['.md']));

      expect(files).toEqual([join(tempDir, 'visible.md')]);
    });

    it('returns empty array for non-existent directory', async () => {
      const missingDir = join(tempDir, 'does-not-exist');

      const files = await collectFiles(missingDir, new Set(['.md']));

      expect(files).toEqual([]);
    });

    it('returns empty array for empty extension set', async () => {
      await writeFile(join(tempDir, 'file.md'), 'content');

      const files = await collectFiles(tempDir, new Set());

      expect(files).toEqual([]);
    });

    it('skips files with no extension', async () => {
      await writeFile(join(tempDir, 'README'), 'readme content');
      await writeFile(join(tempDir, 'note.md'), 'note');

      const files = await collectFiles(tempDir, new Set(['.md']));

      expect(files).toEqual([join(tempDir, 'note.md')]);
    });

    it('skips dotfiles (extension is empty string)', async () => {
      await writeFile(join(tempDir, '.gitignore'), 'node_modules');
      await writeFile(join(tempDir, '.env'), 'SECRET=123');
      await writeFile(join(tempDir, 'note.md'), 'note');

      const files = await collectFiles(tempDir, new Set(['.md']));

      expect(files).toEqual([join(tempDir, 'note.md')]);
    });

    it('handles case-insensitive extension matching', async () => {
      await writeFile(join(tempDir, 'upper.MD'), 'upper');
      await writeFile(join(tempDir, 'lower.md'), 'lower');
      await writeFile(join(tempDir, 'mixed.Md'), 'mixed');

      const files = await collectFiles(tempDir, new Set(['.md']));

      expect(files.sort()).toEqual([
        join(tempDir, 'lower.md'),
        join(tempDir, 'mixed.Md'),
        join(tempDir, 'upper.MD'),
      ]);
    });
  });

  describe('readFileContent', () => {
    it('reads UTF-8 content', async () => {
      const filePath = join(tempDir, 'test.md');
      await writeFile(filePath, 'Hello, world!', 'utf-8');

      const content = await readFileContent(filePath);

      expect(content).toBe('Hello, world!');
    });

    it('handles unicode characters', async () => {
      const filePath = join(tempDir, 'unicode.md');
      const unicodeContent = '日本語 émoji 🎉 über';
      await writeFile(filePath, unicodeContent, 'utf-8');

      const content = await readFileContent(filePath);

      expect(content).toBe(unicodeContent);
    });

    it('throws ENOENT for missing file', async () => {
      const missingPath = join(tempDir, 'missing.md');

      await expect(readFileContent(missingPath)).rejects.toThrow();
      try {
        await readFileContent(missingPath);
      } catch (err) {
        expect((err as NodeJS.ErrnoException).code).toBe('ENOENT');
      }
    });
  });
});
