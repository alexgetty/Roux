---
type: Issue
severity: High
component: DocStore
phase: 6
---

# Issue - UpdateNode Precedence

Unclear behavior when `updateNode` receives both `content` and `outgoingLinks`.

## Problem

Implementation at `src/providers/docstore/index.ts:114-118`:

```typescript
let outgoingLinks = updates.outgoingLinks;
if (updates.content !== undefined && outgoingLinks === undefined) {
  const rawLinks = extractWikiLinks(updates.content);
  outgoingLinks = rawLinks.map((link) => this.normalizeWikiLink(link));
}
```

If caller passes `{ content: '[[new-link]]', outgoingLinks: ['old-link.md'] }`:
- Explicit `outgoingLinks` wins
- Links parsed from content are ignored
- Content has `[[new-link]]` but node.outgoingLinks says `['old-link.md']`

## Questions

1. Is this intentional? If so, document it.
2. Should we throw if both are provided?
3. Should content-parsed links always win?

## Suggested Test

```typescript
it('explicit outgoingLinks takes precedence over content-parsed links', async () => {
  await store.updateNode('target.md', {
    content: '[[new-link]]',
    outgoingLinks: ['old-link.md'],
  });
  const node = await store.getNode('target.md');
  // Document which behavior is correct
  expect(node?.outgoingLinks).toEqual(['old-link.md']); // or ['new-link.md']?
});
```

## References

- `src/providers/docstore/index.ts:106-144`
- `tests/unit/docstore/docstore.test.ts:292-358`
