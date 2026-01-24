---
type: Issue
severity: Medium
component: Multiple
phase: 7
---

# Issue - Tech Debt Collection

Lower-severity issues that should be addressed before Phase 11 (Integration & Polish).

## Flaky Timing in Tests

**Location:** `tests/unit/docstore/docstore.test.ts:181-207`

Uses `setTimeout(50ms)` to force mtime change. On fast filesystems this could flake.

**Fix:** Use `fs.utimes()` to explicitly set mtime instead of waiting.

## Error Propagation in updateNode

**Location:** `src/providers/docstore/index.ts:106-144`

If `writeFile` fails (disk full, permissions), what error surfaces? No test for I/O failures.

**Fix:** Add test with mock that throws on write.

## Symlink Handling in sync

**Location:** `src/providers/docstore/index.ts:241-268`

`entry.isFile()` returns false for symlinks. Symlinked markdown files are silently ignored.

**Question:** Is this intentional? If so, document. If not, use `entry.isSymbolicLink()` check.

## Case Sensitivity on Linux

**Location:** `src/providers/docstore/cache.ts:132-139`

On Linux, `CamelCase.md` and `camelcase.md` can be different files. The cache normalizes both to `camelcase.md`, causing silent collision.

**Risk:** Low for MVP (targeting macOS Obsidian vaults), but should be documented.

## Byte Offset in getEmbedding

**Location:** `src/providers/docstore/cache.ts:249-259`

Uses `row.vector.byteOffset` which could be non-zero if SQLite's Buffer is a view into larger memory.

**Risk:** Low - better-sqlite3 returns independent Buffers, but a future version change could break this.

## Unicode Normalization in Titles

**Location:** `src/providers/docstore/parser.ts:101-120`

`titleFromPath` just lowercases. `café` vs `café` (NFC vs NFD) could produce duplicate-looking titles.

**Fix:** Apply `str.normalize('NFC')` before processing.

## Missing Direct Tests

1. `DocStore.getAllNodeIds()` - only tested implicitly via `sync()`
2. ~~`DocStore.close()` doesn't close injected VectorProvider~~ - **Fixed in Phase 7**
3. `src/index.ts` exports - only `VERSION` is tested, not actual module exports

## Error Assertion Specificity

**Location:** `tests/unit/docstore/docstore.test.ts` lines 288, 342, 375

Tests assert errors match `/exists/i`, `/not found/i` but don't verify error type or full message. If error wording changes, tests may pass incorrectly.

**Fix:** Use more specific error class or exact message matching.

## searchByVector Dimension Mismatch Pass-through

**Location:** `tests/unit/docstore/docstore.test.ts`

No test verifying that dimension mismatch errors from VectorProvider surface correctly through DocStore.

**Fix:** Add test with mismatched vector dimensions.

## getRandomNode Tag Mode Documentation

**Location:** `src/providers/docstore/index.ts:183-197`

`getRandomNode(tags)` uses `'any'` mode for tag matching. This is intentional but undocumented in the interface.

**Fix:** Add JSDoc to `StoreProvider.getRandomNode()` clarifying tag matching behavior.

## References

- All locations listed above
- `docs/MVP Implementation Plan.md` Phase 11
