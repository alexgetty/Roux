---
id: zFwblricjuF9
title: normalize-functions-naming-confusion
tags:
  - low
  - naming
  - docstore
---
# Normalize Functions Naming Confusion

**Severity:** Low  
**Location:** `src/providers/docstore/parser.ts:90`, `src/providers/docstore/links.ts:23`

## Problem

`parser.ts` has `normalizeId(path)` and `links.ts` has `normalizeWikiLink(target)`. Both lowercase and convert backslashes. The difference: `normalizeWikiLink` also appends `.md` if no extension.

`MarkdownReader` imports from both files. The naming makes it unclear which to use when.

## Fix

Either:
- Rename `normalizeWikiLink` → `normalizeTarget` or `normalizeLinkTarget` for clarity
- Add JSDoc comments explaining when to use each function
- Consolidate into one module with explicit naming like `normalizeFilePath` vs `normalizeLinkTarget`
