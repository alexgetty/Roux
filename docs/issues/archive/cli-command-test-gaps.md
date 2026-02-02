---
id: nxwJZ5cBb021
title: CLI Command Test Gaps
tags:
  - issue
  - cli
  - testing
type: '[[Test Gap]]'
priority: Low
component: '[[CLI]]'
status: open
---
# CLI Command Test Gaps

Missing test coverage for CLI commands.

## 1. init Nonexistent Parent Directory

**Location:** `tests/unit/cli/init.test.ts`

No test for `initCommand('/nonexistent/path')`. `mkdir` with `recursive: true` should handle it, but no test confirms this.

## 2. Transport Mock Hides MCP Failures

**Location:** `tests/unit/cli/serve.test.ts:33-42`

Transport factory mock is `{ start: async () => {}, close: async () => {} }`. MCP server could fail silently and test would pass.

**Fix:** Verify `start()` was called at minimum.

## 3. serve Sync Test Doesn't Verify Node Correctness

**Location:** `tests/unit/cli/serve.test.ts:71-84`

"syncs files on startup" only checks `nodeCount`, not that nodes are correctly parsed or searchable.

## 4. viz HTML Sanitization

**Location:** `src/cli/commands/viz.ts:87-237`

No sanitization. Node titles containing `</script>` could break page.

MVP acceptable (user's own files), but worth hardening.

**Fix:** Verify no raw interpolation—JSON.stringify should handle it.

## References

- CLI Phase 10 tech debt
