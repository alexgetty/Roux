---
title: audit-docstore-parser-test
tags:
  - test-audit
  - docstore
  - parser
---
# Test Audit: docstore/parser.test.ts

**Consolidated into:** [[consolidated-type-guard-validation-gaps]], [[consolidated-weak-assertions]], [[consolidated-empty-string-validation]]

## Summary

Critical test/implementation mismatch: 5 tests reference a `plugins` field that does not exist in the `ParsedMarkdown` interface. Additionally, several edge cases remain untested including escaped brackets, code blocks with language specifiers, and frontmatter-like separators in content.

## Findings

### [CRITICAL] Tests reference non-existent `plugins` field - 5 failing tests

**Location:** `tests/unit/docstore/parser.test.ts:125-178` (parsing), `tests/unit/docstore/parser.test.ts:450-518` (serializing)

**Problem:** Five tests assert behavior for a `plugins` field on `ParsedMarkdown`, but this field does not exist in the interface definition at `src/providers/docstore/parser.ts:3-8`. Tests are passing TypeScript compilation (likely via `@ts-expect-error` or loose typing) but fail at runtime.

**Evidence:**
```typescript
// Interface (parser.ts:3-8)
export interface ParsedMarkdown {
  title: string | undefined;
  tags: string[];
  properties: Record<string, unknown>;
  content: string;
  // NO plugins field
}

// Test (parser.test.ts:140)
expect(result.plugins).toEqual({
  'plugin-pm': { status: 'open', priority: 'high' },
  'plugin-time': { estimate: '2h' },
});
```

**Failing tests:**
1. `extracts plugins field separately from properties` (line 125)
2. `returns undefined plugins when not in frontmatter` (line 148)
3. `returns undefined plugins when plugins field is not an object` (line 158)
4. `handles empty plugins object` (line 169)
5. `serializes with plugins field` (line 450)
6. `omits plugins field when undefined` (line 471)
7. `includes empty plugins object in frontmatter` (line 484)
8. `roundtrips plugins data` (line 498)

**Fix:** Either:
1. Add `plugins?: Record<string, Record<string, unknown>>` to `ParsedMarkdown` interface AND implement extraction/serialization logic in `parseMarkdown`/`serializeToMarkdown`
2. OR delete the tests if plugins feature was abandoned

**Verification:** `npm test -- tests/unit/docstore/parser.test.ts` should pass all 53 tests

---

### [HIGH] Malformed YAML properties pollution not asserted

**Location:** `tests/unit/docstore/parser.test.ts:77-87`

**Problem:** Test for malformed YAML only asserts content contains "Content". Does not verify `result.properties` is empty, `result.tags` is empty array, and `result.title` is undefined. Malformed YAML could theoretically partially parse and pollute these fields.

**Evidence:**
```typescript
it('handles malformed YAML frontmatter gracefully', () => {
  const content = `---
title: [unclosed bracket
tags: not:valid:yaml:probably
---
Content`;

  const result = parseMarkdown(content);
  // Should not throw, returns empty/default values
  expect(result.content).toContain('Content');
  // MISSING: expect(result.properties).toEqual({});
  // MISSING: expect(result.tags).toEqual([]);
  // MISSING: expect(result.title).toBeUndefined();
});
```

**Fix:** Add explicit assertions for all fields when YAML is malformed.

**Verification:** Add assertions, verify test still passes, then mutate implementation to leak data and confirm test catches it.

---

### [MEDIUM] Code blocks with language specifier untested

**Location:** `tests/unit/docstore/parser.test.ts:225-237`

**Problem:** Test uses plain code block without language specifier. Real-world markdown often has `\`\`\`typescript` or `\`\`\`js`. The regex `\`\`\`[\s\S]*?\`\`\`` should handle this but no test proves it.

**Evidence:**
```typescript
// Current test (line 225-237)
const content = `Regular [[link]] here.

\`\`\`
[[code-block-link]]
\`\`\`
`;

// Missing test case:
const content = `\`\`\`typescript
[[should-ignore]]
\`\`\`
[[real-link]]`;
```

**Fix:** Add test with language specifier: `\`\`\`typescript\n[[code-link]]\n\`\`\``

**Verification:** Test passes with current implementation (documents behavior)

---

### [MEDIUM] Escaped wiki-link brackets untested

**Location:** `src/providers/docstore/parser.ts:68` (regex)

**Problem:** Obsidian treats `\[\[not-a-link\]\]` as literal text, not a link. Current regex `/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g` will match it because it doesn't check for escape characters.

**Evidence:**
```typescript
// parser.ts:68 - regex doesn't account for escapes
const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

// Untested behavior:
extractWikiLinks('\\[\\[not-a-link\\]\\]'); // Should return [] but likely returns ['not-a-link']
```

**Fix:** Add test documenting current behavior. If incorrect, file separate issue for implementation fix.

**Verification:** Write test, determine if behavior matches Obsidian

---

### [MEDIUM] Frontmatter-like separators in content cause data loss on roundtrip

**Location:** `tests/unit/docstore/parser.test.ts:427-448`

**Problem:** Roundtrip test doesn't verify content containing `\n---\n` survives. gray-matter may interpret this as frontmatter delimiter.

**Evidence:**
```typescript
// Missing test:
const parsed: ParsedMarkdown = {
  title: 'Test',
  tags: [],
  properties: {},
  content: 'Before\n---\nAfter',  // Could be misinterpreted
};
const serialized = serializeToMarkdown(parsed);
const reparsed = parseMarkdown(serialized);
// Does reparsed.content still contain both "Before" and "After"?
```

**Fix:** Add test for content with frontmatter-like separators.

**Verification:** Test either passes (documenting safe behavior) or fails (exposing bug)

---

### [MEDIUM] Non-string title handling incomplete

**Location:** `tests/unit/docstore/parser.test.ts:13-26`

**Problem:** Tests string title, but what if title is a number or object? Implementation checks `typeof data['title'] === 'string'` (line 31 of parser.ts) but no test proves non-string titles are handled.

**Evidence:**
```typescript
// parser.ts:31
const title = typeof data['title'] === 'string' ? data['title'] : undefined;

// Missing test:
const content = `---
title: 123
---
Content`;
// Should result.title be undefined or "123"?
```

**Fix:** Add test for numeric/boolean/object title values.

**Verification:** Test documents behavior, proves type guard works

---

### [LOW] Multiple consecutive backticks in inline code

**Location:** `tests/unit/docstore/parser.test.ts:239-243`

**Problem:** Inline code regex `/`[^`]+`/g` doesn't handle double-backtick inline code syntax (``` ``code`` ```).

**Evidence:**
```typescript
// parser.ts:65
const withoutInlineCode = withoutCodeBlocks.replace(/`[^`]+`/g, '');

// Untested: double backtick syntax
'Use ``[[not-a-link]]`` here'  // Should not extract link
```

**Fix:** Add test documenting behavior. May need regex update for double backticks.

**Verification:** Write test, determine if behavior is acceptable

---

### [LOW] normalizeWikiLink test is misleading comment

**Location:** `tests/unit/docstore/parser.test.ts:342-355`

**Problem:** Comment says "normalizeWikiLink is a private method, tested via DocStore integration" but the test block doesn't actually test any normalization - it just tests `extractWikiLinks` and comments about DocStore behavior.

**Evidence:**
```typescript
describe('normalizeWikiLink', () => {
  // Note: normalizeWikiLink is a private method, tested via DocStore integration
  // These tests verify the expected behavior through extractWikiLinks + normalization

  it('treats dots in filenames as part of name, not extension', () => {
    const content = '[[archive.2024]]';
    const links = extractWikiLinks(content);
    expect(links).toEqual(['archive.2024']);
    // Normalization to .md happens in DocStore.normalizeWikiLink
  });
});
```

**Fix:** Either rename describe block to reflect what's actually tested, or delete and add proper integration test reference.

**Verification:** N/A - documentation/organization issue

## Cross-References

- [[docs/issues/Parser Edge Cases.md]] - Lists escaped brackets and code block language specifier gaps (duplicated here for completeness)
- [[docs/issues/docstore-parser-test-gaps.md]] - Lists malformed YAML pollution gap (duplicated here for completeness)
