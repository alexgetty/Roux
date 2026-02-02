---
id: 0mIWRkuUDwJs
title: parsefile-double-mtime
tags:
  - medium
  - performance
  - refactor
---
# parseFile Retrieves mtime Twice

**Severity:** Medium  
**Location:** `src/providers/docstore/index.ts:84,88,433`

## Problem

In the sync loop, `getFileMtime()` is called at line 84 for cache comparison, then `parseFile()` is called at line 88, which internally calls `getFileMtime()` again at line 433. Redundant I/O and creates minor TOCTOU window.

## Fix

Pass mtime into parseFile as a parameter:

```typescript
private async parseFile(filePath: string, mtime?: number): Promise<Node> {
  const content = await readFileContent(filePath);
  const actualMtime = mtime ?? await getFileMtime(filePath);
  // ...
}
```

## Verification

- Unit test for parseFile with provided mtime
- Verify getFileMtime called once per file during sync
