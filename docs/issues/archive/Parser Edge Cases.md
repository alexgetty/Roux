---
id: AaHEdKxbLX6d
title: Parser Edge Cases
tags:
  - issue
  - docstore
  - testing
type: Issue
priority: Low
component: Parser
status: open
severity: High
phase: 6
---
# Parser Edge Cases

Several edge cases in wiki-link extraction are untested.

## 1. Nested Code Blocks

Current test covers single code block, but what about code blocks with language specifiers?

```typescript
const content = `
\`\`\`ts
[[should-not-extract]]
\`\`\`
`;
```

The regex `` ```[\s\S]*?``` `` is non-greedy and should work, but needs explicit test.

## 2. Escaped Brackets

What about `\[\[not-a-link\]\]`? Obsidian doesn't parse this as a link, but the current regex will match it.

```typescript
it('ignores escaped brackets', () => {
  const content = '\\[\\[escaped\\]\\]';
  const links = extractWikiLinks(content);
  expect(links).toEqual([]);
});
```

## 3. Frontmatter Injection

What if content contains `\n---\n`? Could roundtrip lose data?

```typescript
it('preserves content with frontmatter-like separators', () => {
  const parsed: ParsedMarkdown = {
    title: 'Test',
    tags: [],
    properties: {},
    content: 'Before\n---\nAfter',
  };

  const serialized = serializeToMarkdown(parsed);
  const reparsed = parseMarkdown(serialized);

  expect(reparsed.content).toContain('Before');
  expect(reparsed.content).toContain('After');
});
```

## Suggested Tests

```typescript
describe('extractWikiLinks edge cases', () => {
  it('handles code blocks with language specifiers', () => {
    const content = `Real [[link]] here.

\`\`\`typescript
[[code-link]]
\`\`\`

Another [[real]] link.`;

    const links = extractWikiLinks(content);
    expect(links).toEqual(['link', 'real']);
    expect(links).not.toContain('code-link');
  });

  it('ignores escaped brackets', () => {
    const content = '\\[\\[escaped\\]\\] and [[real]]';
    const links = extractWikiLinks(content);
    // Behavior TBD - document what's correct
  });
});
```

## References

- `src/providers/docstore/parser.ts:60-82`
- `tests/unit/docstore/parser.test.ts:127-207`
