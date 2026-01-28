---
title: audit-file-operations-test
tags:
  - test-audit
  - docstore
  - file-operations
---
# Test Audit: file-operations.test.ts

**Consolidated into:** [[consolidated-empty-string-validation]], [[consolidated-boundary-conditions]], [[consolidated-error-propagation-gaps]]

## Summary

The test suite covers happy paths adequately but has critical gaps in security validation, error handling edge cases, and assertion specificity. Several tests pass by accident due to weak assertions.

## Findings

### [CRITICAL] validatePathWithinSource allows exact root path

**Location:** `src/providers/docstore/file-operations.ts:28`

**Problem:** The validation check uses `resolvedPath.startsWith(resolvedRoot + '/')` which rejects paths equal to the source root itself. However, there's no test for what happens when `id` is an empty string or `.` which would resolve to exactly the source root.

**Evidence:**
```typescript
// Implementation (line 28)
if (!resolvedPath.startsWith(resolvedRoot + '/')) {
  throw new Error(`Path traversal detected: ${id} resolves outside source root`);
}
```

If `id = ''` or `id = '.'`, `resolvedPath === resolvedRoot`, so `resolvedPath.startsWith(resolvedRoot + '/')` is false, and it throws. This is probably correct behavior, but:
1. No test verifies empty string behavior
2. No test verifies `.` behavior  
3. No test verifies the exact error message format

**Fix:** Add tests for empty string and `.` paths:
```typescript
it('throws on empty string id', () => {
  expect(() => validatePathWithinSource(tempDir, '')).toThrow(/outside.*source/i);
});

it('throws on dot id', () => {
  expect(() => validatePathWithinSource(tempDir, '.')).toThrow(/outside.*source/i);
});
```

**Verification:** Tests fail if implementation changes to allow root-level access.

---

### [HIGH] getFileMtime test has redundant expect in catch block

**Location:** `tests/unit/docstore/file-operations.test.ts:40-46`

**Problem:** The test calls `getFileMtime` twice - once in `expect().rejects.toThrow()` and once in a try/catch. If the first assertion passes, the second call is redundant. If it fails differently (resolves instead of rejects), the redundant call masks the real error.

**Evidence:**
```typescript
await expect(getFileMtime(missingPath)).rejects.toThrow();
try {
  await getFileMtime(missingPath);  // Called again - redundant
} catch (err) {
  expect((err as NodeJS.ErrnoException).code).toBe('ENOENT');
}
```

**Fix:** Use a single pattern:
```typescript
await expect(getFileMtime(missingPath)).rejects.toMatchObject({
  code: 'ENOENT'
});
```

**Verification:** Test still verifies error code in single call.

---

### [HIGH] readFileContent has same redundant pattern

**Location:** `tests/unit/docstore/file-operations.test.ts:194-203`

**Problem:** Identical anti-pattern as getFileMtime test.

**Evidence:**
```typescript
await expect(readFileContent(missingPath)).rejects.toThrow();
try {
  await readFileContent(missingPath);
} catch (err) {
  expect((err as NodeJS.ErrnoException).code).toBe('ENOENT');
}
```

**Fix:** Same as above - use `rejects.toMatchObject({ code: 'ENOENT' })`.

**Verification:** Single assertion verifies error type.

---

### [HIGH] collectFiles doesn't test permission errors

**Location:** `src/providers/docstore/file-operations.ts:52-57`

**Problem:** The implementation catches any error from `readdir` and returns empty array. This is graceful degradation for missing directories, but it also silently swallows EACCES (permission denied), ENOTDIR (path is a file), and other errors. No test verifies this behavior is intentional.

**Evidence:**
```typescript
try {
  entries = await readdir(dir, { withFileTypes: true });
} catch {
  // Directory doesn't exist - but also catches permission errors!
  return results;
}
```

**Fix:** Either:
1. Add tests confirming permission errors return empty (if intentional)
2. Change implementation to only catch ENOENT, rethrow others
3. Document in JSDoc that all readdir errors are swallowed

```typescript
it('returns empty array for permission-denied directory', async () => {
  // Create a directory then chmod 000 it
  // This test may need platform-specific handling
});
```

**Verification:** Explicit test coverage for error behavior.

---

### [MEDIUM] validatePathWithinSource doesn't test absolute path injection

**Location:** `tests/unit/docstore/file-operations.test.ts:49-68`

**Problem:** No test verifies behavior when `id` is an absolute path like `/etc/passwd` or `C:\Windows\System32`. The `resolve()` function handles this, but no test confirms the security behavior.

**Evidence:**
```typescript
// Missing test cases:
validatePathWithinSource(tempDir, '/etc/passwd')  // absolute Unix path
validatePathWithinSource(tempDir, 'C:\\Windows\\System32')  // absolute Windows
```

**Fix:**
```typescript
it('throws on absolute path injection', () => {
  expect(() => validatePathWithinSource(tempDir, '/etc/passwd')).toThrow(/outside.*source/i);
});

it('throws on Windows absolute path injection', () => {
  expect(() => validatePathWithinSource(tempDir, 'C:\\Windows\\System32')).toThrow(/outside.*source/i);
});
```

**Verification:** Security boundary is explicitly tested.

---

### [MEDIUM] collectFiles extension matching is case-sensitive in Set but lowercased in implementation

**Location:** `tests/unit/docstore/file-operations.test.ts:159-171`

**Problem:** Test passes `new Set(['.md'])` (lowercase) and verifies `.MD`, `.Md` are matched. This works because implementation does `extname(entry.name).toLowerCase()`. But if someone passes `new Set(['.MD'])` (uppercase in the set), files with `.md` extension won't match because `.md !== .MD`.

**Evidence:**
```typescript
// Implementation (line 70-72)
const ext = extname(entry.name).toLowerCase();
if (ext && extensions.has(ext)) {  // Set.has() is case-sensitive!
```

**Fix:** Add test showing the footgun:
```typescript
it('FOOTGUN: extension set must be lowercase', async () => {
  await writeFile(join(tempDir, 'file.md'), 'content');
  
  // This returns empty because '.MD' !== '.md'
  const files = await collectFiles(tempDir, new Set(['.MD']));
  
  expect(files).toEqual([]);  // Documents the gotcha
});
```

Or fix implementation to normalize the set.

**Verification:** Behavior is documented even if not changed.

---

### [MEDIUM] collectFiles doesn't test symlinks

**Location:** `tests/unit/docstore/file-operations.test.ts:71-171`

**Problem:** No test for symlink behavior. The implementation uses `entry.isDirectory()` and `entry.isFile()` which return false for symlinks (they return true for `isSymbolicLink()`). This means symlinks are silently skipped. No test verifies this.

**Evidence:**
```typescript
// Implementation (lines 62-75)
if (entry.isDirectory()) {
  // ... recurse
} else if (entry.isFile()) {
  // ... collect
}
// symlinks fall through - neither isDirectory nor isFile
```

**Fix:**
```typescript
it('skips symlinks to files', async () => {
  await writeFile(join(tempDir, 'real.md'), 'content');
  await symlink(join(tempDir, 'real.md'), join(tempDir, 'link.md'));
  
  const files = await collectFiles(tempDir, new Set(['.md']));
  
  expect(files).toEqual([join(tempDir, 'real.md')]);
});
```

**Verification:** Symlink behavior is explicit.

---

### [MEDIUM] readFileContent doesn't test binary files or encoding issues

**Location:** `tests/unit/docstore/file-operations.test.ts:174-204`

**Problem:** Only tests valid UTF-8 content. No test for what happens with binary files (images accidentally given .md extension) or invalid UTF-8 sequences.

**Evidence:**
```typescript
// Implementation just passes through to readFile
export async function readFileContent(filePath: string): Promise<string> {
  return readFile(filePath, 'utf-8');
}
```

**Fix:**
```typescript
it('handles binary content that is not valid UTF-8', async () => {
  const filePath = join(tempDir, 'binary.md');
  await writeFile(filePath, Buffer.from([0x80, 0x81, 0x82]));  // Invalid UTF-8
  
  // Document actual behavior - does it throw or return replacement chars?
  const content = await readFileContent(filePath);
  // Assert whatever the actual behavior is
});
```

**Verification:** Edge case behavior is documented.

---

### [LOW] EXCLUDED_DIRS test doesn't verify exclusion is directory-name-based

**Location:** `tests/unit/docstore/file-operations.test.ts:111-122`

**Problem:** Test creates excluded dirs at root level, but doesn't verify that a file named `.git.md` (not a directory) is still collected, or that `subfolder/.git/file.md` is excluded.

**Evidence:**
```typescript
for (const excluded of EXCLUDED_DIRS) {
  await mkdir(join(tempDir, excluded), { recursive: true });
  // Only tests dirs at root level
```

**Fix:**
```typescript
it('excludes nested directories with excluded names', async () => {
  await mkdir(join(tempDir, 'sub/.git'), { recursive: true });
  await writeFile(join(tempDir, 'sub/.git/hidden.md'), 'hidden');
  await writeFile(join(tempDir, 'sub/visible.md'), 'visible');
  
  const files = await collectFiles(tempDir, new Set(['.md']));
  
  expect(files).toEqual([join(tempDir, 'sub/visible.md')]);
});

it('does not exclude files with excluded dir names', async () => {
  await writeFile(join(tempDir, '.git.md'), 'not excluded');
  
  const files = await collectFiles(tempDir, new Set(['.md']));
  
  expect(files).toContain(join(tempDir, '.git.md'));
});
```

**Verification:** Exclusion logic is thoroughly tested.

---

### [LOW] Test imports EXCLUDED_DIRS from watcher.ts

**Location:** `tests/unit/docstore/file-operations.test.ts:11`

**Problem:** Test file imports `EXCLUDED_DIRS` from watcher, same issue as implementation. If the constant is moved (as recommended in separate issue), test breaks.

**Evidence:**
```typescript
import { EXCLUDED_DIRS } from '../../../src/providers/docstore/watcher.js';
```

**Fix:** When `EXCLUDED_DIRS` is extracted to constants.ts, update test import.

**Verification:** N/A - depends on separate refactor.

## References

- [[file-operations-depends-on-watcher]] - Related architectural issue about EXCLUDED_DIRS location
