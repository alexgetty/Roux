import { describe, it, expect } from 'vitest';
import {
  parseMarkdown,
  extractWikiLinks,
  serializeToMarkdown,
  normalizeId,
  titleFromPath,
  type ParsedMarkdown,
} from '../../../src/providers/docstore/parser.js';

describe('parseMarkdown', () => {
  describe('frontmatter extraction', () => {
    it('parses YAML frontmatter with title and tags', () => {
      const content = `---
title: My Note
tags:
  - test
  - example
---
# Content here`;

      const result = parseMarkdown(content);
      expect(result.title).toBe('My Note');
      expect(result.tags).toEqual(['test', 'example']);
      expect(result.content).toBe('# Content here');
    });

    it('parses frontmatter with inline tags array', () => {
      const content = `---
title: Inline Tags
tags: [one, two, three]
---
Body text`;

      const result = parseMarkdown(content);
      expect(result.tags).toEqual(['one', 'two', 'three']);
    });

    it('extracts arbitrary properties from frontmatter', () => {
      const content = `---
title: Props Test
tags: []
custom: value
nested:
  key: nested-value
number: 42
---
Content`;

      const result = parseMarkdown(content);
      expect(result.properties['custom']).toBe('value');
      expect(result.properties['nested']).toEqual({ key: 'nested-value' });
      expect(result.properties['number']).toBe(42);
    });

    it('handles missing frontmatter gracefully', () => {
      const content = '# Just a heading\n\nSome content';

      const result = parseMarkdown(content);
      expect(result.title).toBeUndefined();
      expect(result.tags).toEqual([]);
      expect(result.properties).toEqual({});
      expect(result.content).toBe('# Just a heading\n\nSome content');
    });

    it('handles empty frontmatter gracefully', () => {
      const content = `---
---
Content only`;

      const result = parseMarkdown(content);
      expect(result.title).toBeUndefined();
      expect(result.tags).toEqual([]);
      expect(result.content).toBe('Content only');
    });

    it('handles malformed YAML frontmatter gracefully', () => {
      const content = `---
title: [unclosed bracket
tags: not:valid:yaml:probably
---
Content`;

      const result = parseMarkdown(content);
      // Should not throw, returns empty/default values
      expect(result.content).toContain('Content');
    });

    it('treats tags as empty array when tags field is not an array', () => {
      const content = `---
title: Test
tags: not-an-array
---
Content`;

      const result = parseMarkdown(content);
      expect(result.tags).toEqual([]);
    });

    it('filters non-string tags', () => {
      const content = `---
title: Test
tags: [valid, 123, true, null]
---
Content`;

      const result = parseMarkdown(content);
      expect(result.tags).toEqual(['valid']);
    });

    it('does not include title and tags in properties', () => {
      const content = `---
title: Test
tags: [a]
other: value
---
Content`;

      const result = parseMarkdown(content);
      expect(result.properties).not.toHaveProperty('title');
      expect(result.properties).not.toHaveProperty('tags');
      expect(result.properties['other']).toBe('value');
    });
  });
});

describe('extractWikiLinks', () => {
  it('extracts simple wiki links', () => {
    const content = 'See [[Note One]] and [[Note Two]] for details.';
    const links = extractWikiLinks(content);
    expect(links).toEqual(['Note One', 'Note Two']);
  });

  it('extracts wiki links with display text', () => {
    const content = 'See [[actual-target|Display Text]] here.';
    const links = extractWikiLinks(content);
    expect(links).toEqual(['actual-target']);
  });

  it('extracts mixed simple and aliased links', () => {
    const content = '[[Simple]] and [[target|aliased]] together.';
    const links = extractWikiLinks(content);
    expect(links).toEqual(['Simple', 'target']);
  });

  it('returns empty array when no links', () => {
    const content = 'No wiki links here, just regular text.';
    const links = extractWikiLinks(content);
    expect(links).toEqual([]);
  });

  it('handles links with paths', () => {
    const content = 'Link to [[folder/subfolder/note]] works.';
    const links = extractWikiLinks(content);
    expect(links).toEqual(['folder/subfolder/note']);
  });

  it('handles links with extensions', () => {
    const content = 'Link [[notes/file.md]] with extension.';
    const links = extractWikiLinks(content);
    expect(links).toEqual(['notes/file.md']);
  });

  it('deduplicates repeated links', () => {
    const content = '[[Same]] appears [[Same]] twice [[Same]].';
    const links = extractWikiLinks(content);
    expect(links).toEqual(['Same']);
  });

  it('ignores links inside code blocks', () => {
    const content = `Regular [[link]] here.

\`\`\`
[[code-block-link]]
\`\`\`

Another [[real]] link.`;

    const links = extractWikiLinks(content);
    expect(links).toEqual(['link', 'real']);
    expect(links).not.toContain('code-block-link');
  });

  it('ignores links inside inline code', () => {
    const content = 'Real [[link]] but `[[inline-code]]` ignored.';
    const links = extractWikiLinks(content);
    expect(links).toEqual(['link']);
  });

  it('handles empty link targets', () => {
    const content = 'Empty [[]] link should be ignored.';
    const links = extractWikiLinks(content);
    expect(links).toEqual([]);
  });

  it('handles whitespace-only link targets', () => {
    const content = 'Whitespace [[   ]] link should be ignored.';
    const links = extractWikiLinks(content);
    expect(links).toEqual([]);
  });

  it('trims whitespace from link targets', () => {
    const content = 'Link [[ spaced target ]] here.';
    const links = extractWikiLinks(content);
    expect(links).toEqual(['spaced target']);
  });
});

describe('normalizeId', () => {
  it('lowercases the path', () => {
    expect(normalizeId('Notes/Research.md')).toBe('notes/research.md');
  });

  it('preserves extensions', () => {
    expect(normalizeId('file.md')).toBe('file.md');
    expect(normalizeId('file.txt')).toBe('file.txt');
  });

  it('handles nested paths', () => {
    expect(normalizeId('A/B/C/Deep.md')).toBe('a/b/c/deep.md');
  });

  it('normalizes mixed case', () => {
    expect(normalizeId('MyFolder/MyFile.MD')).toBe('myfolder/myfile.md');
  });

  it('handles paths without extension', () => {
    expect(normalizeId('folder/file')).toBe('folder/file');
  });

  it('handles single file names', () => {
    expect(normalizeId('README.md')).toBe('readme.md');
  });

  it('normalizes backslashes to forward slashes', () => {
    expect(normalizeId('folder\\subfolder\\file.md')).toBe(
      'folder/subfolder/file.md'
    );
  });
});

describe('titleFromPath', () => {
  it('removes directory prefix and extension', () => {
    expect(titleFromPath('notes/my-note.md')).toBe('My Note');
  });

  it('replaces hyphens with spaces', () => {
    expect(titleFromPath('machine-learning.md')).toBe('Machine Learning');
  });

  it('title-cases words', () => {
    expect(titleFromPath('the-quick-brown-fox.md')).toBe(
      'The Quick Brown Fox'
    );
  });

  it('handles deeply nested paths', () => {
    expect(titleFromPath('a/b/c/deep-note.md')).toBe('Deep Note');
  });

  it('handles paths without hyphens', () => {
    expect(titleFromPath('folder/simple.md')).toBe('Simple');
  });

  it('handles uppercase input', () => {
    expect(titleFromPath('FOLDER/MY-FILE.MD')).toBe('My File');
  });

  it('handles multiple consecutive hyphens', () => {
    expect(titleFromPath('a--b---c.md')).toBe('A B C');
  });

  it('handles underscores as word separators', () => {
    expect(titleFromPath('my_note_title.md')).toBe('My Note Title');
  });

  it('handles mixed separators', () => {
    expect(titleFromPath('my-note_title.md')).toBe('My Note Title');
  });

  it('handles empty string path', () => {
    // Edge case: path.split returns [''], pop returns '', fall through to empty result
    expect(titleFromPath('')).toBe('');
  });
});

describe('normalizeWikiLink', () => {
  // Note: normalizeWikiLink is a private method, tested via DocStore integration
  // These tests verify the expected behavior through extractWikiLinks + normalization

  it('treats dots in filenames as part of name, not extension', () => {
    // archive.2024 should become archive.2024.md, not stay as archive.2024
    // This tests the expectation - actual implementation is in DocStore
    const content = '[[archive.2024]]';
    const links = extractWikiLinks(content);
    // The raw link should preserve the dot
    expect(links).toEqual(['archive.2024']);
    // Normalization to .md happens in DocStore.normalizeWikiLink
  });
});

describe('serializeToMarkdown', () => {
  it('serializes with title and tags', () => {
    const parsed: ParsedMarkdown = {
      title: 'Test Title',
      tags: ['tag1', 'tag2'],
      properties: {},
      content: 'Body content here.',
    };

    const result = serializeToMarkdown(parsed);
    expect(result).toContain('---');
    expect(result).toContain('title: Test Title');
    expect(result).toContain('tags:');
    expect(result).toContain('  - tag1');
    expect(result).toContain('  - tag2');
    expect(result).toContain('Body content here.');
  });

  it('serializes with custom properties', () => {
    const parsed: ParsedMarkdown = {
      title: 'Props',
      tags: [],
      properties: { custom: 'value', number: 42 },
      content: 'Content',
    };

    const result = serializeToMarkdown(parsed);
    expect(result).toContain('custom: value');
    expect(result).toContain('number: 42');
  });

  it('omits frontmatter when no metadata', () => {
    const parsed: ParsedMarkdown = {
      title: undefined,
      tags: [],
      properties: {},
      content: 'Just content',
    };

    const result = serializeToMarkdown(parsed);
    expect(result).toBe('Just content');
    expect(result).not.toContain('---');
  });

  it('includes frontmatter when only title is set', () => {
    const parsed: ParsedMarkdown = {
      title: 'Only Title',
      tags: [],
      properties: {},
      content: 'Content',
    };

    const result = serializeToMarkdown(parsed);
    expect(result).toContain('---');
    expect(result).toContain('title: Only Title');
  });

  it('includes frontmatter when only tags are set', () => {
    const parsed: ParsedMarkdown = {
      title: undefined,
      tags: ['single'],
      properties: {},
      content: 'Content',
    };

    const result = serializeToMarkdown(parsed);
    expect(result).toContain('---');
    expect(result).toContain('tags:');
  });

  it('roundtrips parsed markdown', () => {
    const original = `---
title: Roundtrip Test
tags:
  - a
  - b
custom: value
---
# Heading

Body text with [[links]].`;

    const parsed = parseMarkdown(original);
    const serialized = serializeToMarkdown(parsed);
    const reparsed = parseMarkdown(serialized);

    expect(reparsed.title).toBe(parsed.title);
    expect(reparsed.tags).toEqual(parsed.tags);
    expect(reparsed.properties['custom']).toBe(parsed.properties['custom']);
    // Content might have minor whitespace differences
    expect(reparsed.content).toContain('Body text with [[links]]');
  });
});
