---
title: audit-readers-markdown-test
tags:
  - test-audit
  - docstore
  - readers
status: open
---
# Test Audit: readers/markdown.test.ts

**Consolidated into:** [[consolidated-unicode-i18n-handling]], [[consolidated-weak-assertions]], [[consolidated-empty-string-validation]]

## Summary

The MarkdownReader test file has reasonable coverage of happy paths but lacks edge case testing for link extraction, weak assertions on malformed input behavior, and missing tests for code paths in helper functions that the reader depends on.

## Findings

### [MEDIUM] Malformed frontmatter assertion is too weak

**Location:** `tests/unit/docstore/readers/markdown.test.ts:133-146`

**Problem:** The test "handles malformed frontmatter gracefully" only asserts that parsing does not throw and that `node.id` is set. It does not verify that:
1. The malformed frontmatter content is preserved as raw content
2. `tags` is an empty array
3. `properties` is an empty object
4. `title` falls back to path-derived value

**Evidence:**
```typescript
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
  // No assertions on tags, properties, title, or content!
});
```

**Fix:** Add explicit assertions for all fallback behaviors:
```typescript
expect(node.title).toBe('Broken');
expect(node.tags).toEqual([]);
expect(node.properties).toEqual({});
expect(node.content).toContain('malformed');
```

**Verification:** Run the test with these assertions; they should pass if graceful degradation works correctly.

---

### [MEDIUM] No test for wiki-links inside code blocks being ignored

**Location:** `tests/unit/docstore/readers/markdown.test.ts:80-103`

**Problem:** The tests verify wiki-link extraction but never test that links inside code blocks or inline code are excluded. This is a documented behavior in `parser.ts:57-58` but not exercised through the MarkdownReader tests.

**Evidence:** From `parser.ts`:
```typescript
/**
 * Extract wiki-link targets from markdown content.
 * Ignores links inside code blocks and inline code.  // <-- untested via MarkdownReader
 * Deduplicates results.
 */
```

The test file has no content containing:
- Fenced code blocks with `[[links]]` inside
- Inline code with `[[links]]` inside

**Fix:** Add integration test through MarkdownReader:
```typescript
it('ignores wiki-links inside code blocks', () => {
  const content = `
Real [[link]] here.

\`\`\`typescript
[[code-link]]
\`\`\`

And \`[[inline-code-link]]\` too.
`;
  const context = createContext('source.md');
  const node = reader.parse(content, context);

  expect(node.outgoingLinks).toContain('link.md');
  expect(node.outgoingLinks).not.toContain('code-link.md');
  expect(node.outgoingLinks).not.toContain('inline-code-link.md');
});
```

**Verification:** Test should pass with current implementation.

---

### [MEDIUM] No test for duplicate wiki-links being deduplicated

**Location:** `tests/unit/docstore/readers/markdown.test.ts:80-103`

**Problem:** `extractWikiLinks` in `parser.ts:69-77` deduplicates links using a Set, but no test verifies this behavior flows through MarkdownReader.

**Evidence:** From `parser.ts`:
```typescript
const seen = new Set<string>();
const links: string[] = [];

let match;
while ((match = linkRegex.exec(withoutInlineCode)) !== null) {
  const target = match[1]?.trim();
  if (target && !seen.has(target)) {
    seen.add(target);
    links.push(target);
  }
}
```

**Fix:** Add deduplication test:
```typescript
it('deduplicates repeated wiki-links', () => {
  const content = '[[Note A]] and again [[Note A]] and [[note a]]';
  const context = createContext('source.md');
  const node = reader.parse(content, context);

  // Should contain only one normalized 'note a.md'
  expect(node.outgoingLinks.filter(l => l === 'note a.md')).toHaveLength(1);
});
```

**Verification:** Test should pass with current implementation.

---

### [LOW] No test for `.markdown` extension

**Location:** `tests/unit/docstore/readers/markdown.test.ts:15-19`

**Problem:** The test asserts that `reader.extensions` contains `.markdown` but no actual parsing test uses a `.markdown` file. The `createContext` helper always uses `.md`.

**Evidence:**
```typescript
it('handles .md and .markdown', () => {
  expect(reader.extensions).toContain('.md');
  expect(reader.extensions).toContain('.markdown');  // Asserts extension exists...
});
// ...but no test actually parses a .markdown file
```

**Fix:** Add a parsing test with `.markdown` extension:
```typescript
it('parses .markdown files identically to .md', () => {
  const content = `---
title: Markdown File
---
Content`;
  const context: FileContext = {
    absolutePath: '/root/test.markdown',
    relativePath: 'test.markdown',
    extension: '.markdown',
    mtime: new Date(),
  };
  const node = reader.parse(content, context);

  expect(node.id).toBe('test.markdown');
  expect(node.title).toBe('Markdown File');
});
```

**Verification:** Test should pass with current implementation.

---

### [LOW] Title derivation edge cases not tested

**Location:** `tests/unit/docstore/readers/markdown.test.ts:61-69`

**Problem:** Only one title derivation case is tested (`my-derived-title.md` -> `My Derived Title`). The `titleFromPath` function in `parser.ts:101-120` handles underscores, multiple hyphens, and empty edge cases that aren't tested.

**Evidence:** From `parser.ts`:
```typescript
// Replace hyphens and underscores with spaces, collapse multiples
const spaced = withoutExt.replace(/[-_]+/g, ' ').toLowerCase();
```

Missing test cases:
- Underscores: `my_note.md` -> `My Note`
- Mixed separators: `my-note_file.md` -> `My Note File`
- Multiple consecutive: `my--note.md` -> `My Note`
- Numeric: `2024-01-15.md` -> `2024 01 15`

**Fix:** Add edge case tests:
```typescript
it('derives title replacing underscores', () => {
  const content = '# Content';
  const context = createContext('my_underscored_note.md');
  const node = reader.parse(content, context);
  expect(node.title).toBe('My Underscored Note');
});

it('derives title collapsing multiple separators', () => {
  const content = '# Content';
  const context = createContext('my---triple---dash.md');
  const node = reader.parse(content, context);
  expect(node.title).toBe('My Triple Dash');
});
```

**Verification:** Tests should pass with current implementation.

---

### [LOW] No test for tags with non-string elements filtered out

**Location:** `tests/unit/docstore/readers/markdown.test.ts:34-45`

**Problem:** `parser.ts:35-37` explicitly filters non-string tags, but no test verifies this behavior.

**Evidence:** From `parser.ts`:
```typescript
if (Array.isArray(data['tags'])) {
  tags = data['tags'].filter((t): t is string => typeof t === 'string');
}
```

This filters out numbers, objects, nulls, etc. from the tags array.

**Fix:**
```typescript
it('filters non-string tags from frontmatter', () => {
  const content = `---
tags:
  - valid-tag
  - 123
  - null
  - another-valid
---
Content`;
  const context = createContext('test.md');
  const node = reader.parse(content, context);

  expect(node.tags).toEqual(['valid-tag', 'another-valid']);
});
```

**Verification:** Test should pass with current implementation.

---

### [LOW] No test for non-string title in frontmatter

**Location:** `tests/unit/docstore/readers/markdown.test.ts:23-31`

**Problem:** `parser.ts:31` only accepts string titles, falling back to undefined otherwise. No test verifies numeric or object titles are ignored.

**Evidence:** From `parser.ts`:
```typescript
const title = typeof data['title'] === 'string' ? data['title'] : undefined;
```

**Fix:**
```typescript
it('ignores non-string title in frontmatter', () => {
  const content = `---
title: 123
---
Content`;
  const context = createContext('numeric-title.md');
  const node = reader.parse(content, context);

  expect(node.title).toBe('Numeric Title'); // Falls back to path-derived
});
```

**Verification:** Test should pass with current implementation.

---

### [LOW] Wiki-link with path separators untested

**Location:** `tests/unit/docstore/readers/markdown.test.ts:89-95`

**Problem:** No test verifies wiki-links containing path separators like `[[folder/note]]`.

**Evidence:** The `normalizeWikiLink` function handles paths with `/` but the test file never exercises this case.

**Fix:**
```typescript
it('normalizes wiki-links with path separators', () => {
  const content = 'Link to [[Folder/Nested Note]]';
  const context = createContext('source.md');
  const node = reader.parse(content, context);

  expect(node.outgoingLinks).toContain('folder/nested note.md');
});
```

**Verification:** Test should pass with current implementation.

---

### [LOW] No test for empty wiki-link `[[]]`

**Location:** `tests/unit/docstore/readers/markdown.test.ts:80-103`

**Problem:** Edge case of empty wiki-link brackets `[[]]` is untested. The regex in `parser.ts:68` matches `[^\]|]+` which requires at least one character, so `[[]]` shouldn't match, but this isn't verified.

**Evidence:** From `parser.ts`:
```typescript
const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
//                    ^^^^^^^ one or more non-] non-| chars
```

**Fix:**
```typescript
it('ignores empty wiki-links', () => {
  const content = 'Empty [[]] and [[  ]] brackets';
  const context = createContext('source.md');
  const node = reader.parse(content, context);

  expect(node.outgoingLinks).toHaveLength(0);
});
```

**Verification:** Confirm implementation behavior matches expectation.

---

## Cross-Reference

Related issues already documented:
- `docs/issues/Parser Edge Cases.md` - covers escaped brackets and code block edge cases at parser level
- `docs/issues/docstore-parser-test-gaps.md` - covers malformed YAML pollution at parser level

This audit focuses specifically on gaps in `readers/markdown.test.ts` integration tests that exercise these paths through the MarkdownReader class.
