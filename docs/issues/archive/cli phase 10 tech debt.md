---
type: Issue
severity: Medium
component: CLI
phase: 10
---

# Issue - CLI Phase 10 Tech Debt

Medium-priority issues from Phase 10 red-team audit. Not blocking, but should be addressed.

## 1. init nonexistent parent directory

**Location:** `tests/unit/cli/init.test.ts`

No test for `initCommand('/nonexistent/path')`. `mkdir` with `recursive: true` should handle it, but no test confirms this or the error if it fails.

**Fix:** Add test case for nonexistent parent directory — verify creates full path or throws meaningful error.

## 2. Transport mock hides MCP failures

**Location:** `tests/unit/cli/serve.test.ts:33-42`

Transport factory mock is `{ start: async () => {}, close: async () => {} }`. MCP server could fail silently and test would pass.

**Fix:** Verify server actually processes calls, or at minimum verify `start()` was called.

## 3. serve sync test doesn't verify node correctness

**Location:** `tests/unit/cli/serve.test.ts:71-84`

"syncs files on startup" only checks `nodeCount`, not that nodes are correctly parsed or searchable.

**Fix:** Add assertion that a known node is retrievable with correct content.

## 4. status manual embedding differs from serve path

**Location:** `tests/unit/cli/status.test.ts:61-79`

Test manually calls `store.storeEmbedding()`. In real usage, serve calls it. No test validates the two paths produce the same state.

**Fix:** Lower priority — paths are equivalent, but could add integration test.

## 5. viz HTML sanitization

**Location:** `src/cli/commands/viz.ts:87-237`

Generated HTML has no sanitization. Node titles containing `</script>` or malicious JS could break the page or execute.

MVP acceptable given files are user's own, but worth hardening.

**Fix:** Escape node titles in JSON output using proper JSON.stringify (already done) and verify no raw interpolation.

## 6. handlers.test.ts validates placeholder scores

**Location:** `tests/unit/mcp/handlers.test.ts:80-95`

Test uses `expect(result[1]?.score).toBe(0.95)` which validates the fake score formula. The comment in `handlers.ts:63-65` explicitly says scores are synthetic.

**Fix:** Either remove score value assertions or add comment explaining why placeholder is tested.

## References

- Phase 10 red-team audit (2026-01-24)
