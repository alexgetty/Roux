---
id: tV9h3h-Ijbb5
title: resolve-duplicate-title-collision
tags:
  - medium
  - test-gap
  - cache
---
# Resolve Duplicate Title Collision

**Severity:** Medium  
**Location:** `src/providers/docstore/cache/resolve.ts:34-37`

## Problem

When building the title-to-ID map, duplicate titles (after lowercasing) silently overwrite:

```typescript
for (const c of candidates) {
  titleToId.set(c.title.toLowerCase(), c.id);  // Last one wins
}
```

If two nodes have the same title, only one will ever be matched.

## Why Medium

- Node IDs are paths (unique by definition)
- Titles derive from filenames
- Can't have two files with same name in same folder
- Cross-folder duplicates (e.g., `recipes/pasta.md` and `archive/pasta.md` both titled "Pasta") could collide
- Path filters in `resolveNodes` typically prevent this

## Test Gap

No test exists for duplicate title behavior.

## Recommended Fix

Add test documenting expected behavior. Either:
1. Accept "last wins" and test it
2. Or return first match / highest-scored match and test that

Document the decision either way.
