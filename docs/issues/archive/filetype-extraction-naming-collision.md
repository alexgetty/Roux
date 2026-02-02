---
id: 264CbERAbRNx
title: filetype-extraction-naming-collision
tags:
  - issue
  - refactor
  - docstore
---
# ParsedFile vs ParsedMarkdown Naming Collision

**Severity:** Medium  
**Location:** `src/providers/docstore/parser.ts`, proposed `types.ts`

## Problem

The FileTypeProvider extraction plan introduces `ParsedFile` interface in `types.ts`, but `parser.ts` already exports `ParsedMarkdown`. These are conceptually identical:

```typescript
// Existing in parser.ts
export interface ParsedMarkdown {
  title: string | undefined;
  tags: string[];
  properties: Record<string, unknown>;
  content: string;
}

// Proposed in types.ts
interface ParsedFile {
  title?: string;
  content: string;
  tags: string[];
  properties: Record<string, unknown>;
  rawLinks: string[];  // new field
}
```

## Resolution Options

1. **Rename and migrate:** Delete `ParsedMarkdown`, use `ParsedFile` everywhere
2. **Extend:** `ParsedFile extends ParsedMarkdown` with `rawLinks`
3. **Keep both:** `ParsedMarkdown` for parser internals, `ParsedFile` for provider contract

## Recommendation

Option 1. One type, one name. The `rawLinks` field is the only difference — add it to the unified type.
