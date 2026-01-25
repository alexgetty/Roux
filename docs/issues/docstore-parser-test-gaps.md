---
title: DocStore Parser Test Gaps
tags:
  - issue
  - docstore
  - parser
  - testing
---
# DocStore Parser Test Gaps

Missing test coverage in DocStore and parser.

## 1. Malformed YAML Frontmatter Pollution

**Location:** `tests/unit/docstore/parser.test.ts:77-87`

Only checks content contains "Content". Doesn't verify malformed frontmatter doesn't partially pollute `result.properties`.

**Fix:** Add explicit assertion that `result.properties` is empty for malformed YAML.

## 2. nodesExist Normalization Not Explicitly Verified

**Location:** `tests/unit/docstore/docstore.test.ts:1245`

Test checks `exists.md` and `also-exists.md` but inputs were `EXISTS.MD`, `ALSO-EXISTS.md`. Passes but doesn't explicitly assert key transformation behavior.

## 3. Monkey-Patching Prototype Pattern

**Location:** `tests/unit/docstore/docstore.test.ts:929-958`

Fragile test pattern using `@ts-expect-error` to access private method. If implementation changes method name, test breaks silently.

**Fix:** Consider injecting a testable seam instead.

## 4. processQueue All-Fail Edge Case

**Location:** `src/providers/docstore/index.ts:397-437`

If ALL items in `processQueue` fail, `processedIds.length` is 0, no graph rebuild. If files exist in cache from previous sync, graph could be stale.

Very unlikely but worth awareness.

## References

- Red team round 9
