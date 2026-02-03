---
id: '-DcDvgwtgx2Y'
title: Resolvealllinks Content Reparsing
tags:
  - issue
  - performance
  - docstore
---
# resolveAllLinks Content Reparsing

## Summary

`resolveAllLinks()` re-parses all node content on every sync to build the `normalizedToOriginal` map for ghost title preservation. This is O(nodes × links) work that runs even when nothing changed.

## Location

`src/providers/docstore/index.ts` — `resolveAllLinks()`, the `normalizedToOriginal` loop.

## Problem

```typescript
const normalizedToOriginal = new Map<string, string>();
for (const node of realNodes) {
  if (node.content === null) continue;
  const rawLinks = extractWikiLinks(node.content);
  for (const raw of rawLinks) {
    const normalized = normalizeWikiLink(raw);
    if (!normalizedToOriginal.has(normalized)) {
      normalizedToOriginal.set(normalized, raw);
    }
  }
}
```

On a 10,000-note vault, this iterates every real node and extracts wikilinks from content on every sync call, including when nothing changed.

## Suggested Fix

Store original wikilink text during initial parse (in the reader or during `processFile`) and pass it through to `resolveAllLinks` so re-parsing is unnecessary.

## Impact

Performance degradation at scale. Not a correctness bug.

## Found By

Red team review, round 12.
