---
tags:
  - test-audit
  - cli
status: open
title: audit-cli-viz-test
---

# Test Audit: cli/viz.test.ts

## Summary

The viz command tests cover the happy path adequately but miss several edge cases, error paths, and have weak assertions that could pass with buggy implementations.

## Findings

### [HIGH] Empty Graph Not Tested

**Location:** `tests/unit/cli/viz.test.ts` - missing test case
**Problem:** No test verifies behavior when the store has zero nodes. The implementation at `viz.ts:47-72` iterates over `cache.getAllNodes()` which could return an empty array, but this path is untested.
**Evidence:** All tests create at least one markdown file before calling vizCommand. No test exercises:
```typescript
await initCommand(testDir);
// No files created
const result = await vizCommand(testDir);
```
**Fix:** Add test case that initializes directory without creating any markdown files, verify `nodeCount: 0`, `edgeCount: 0`, and valid HTML output.
**Verification:** New test passes and HTML renders correctly in browser with empty graph.

### [HIGH] Cache Failure Not Tested

**Location:** `viz.ts:44-89`
**Problem:** If `cache.getAllNodes()` or `cache.getCentrality()` throws, the error propagates uncaught. No test verifies this behavior or that the cache is properly closed in the finally block on error.
**Evidence:** Implementation has:
```typescript
try {
  const nodes = cache.getAllNodes();
  // ... processing
} finally {
  cache.close();
}
```
But no test mocks a cache failure to verify cleanup occurs.
**Fix:** Add test with corrupted cache database to verify error handling and cleanup.
**Verification:** Test confirms error is thrown AND cache.close() is called (via spy or by verifying no file handles leaked).

### [MEDIUM] HTML Content Not Actually Validated

**Location:** `tests/unit/cli/viz.test.ts:50-64`
**Problem:** Test "generates valid HTML with D3 CDN" uses weak assertions that could pass with malformed HTML.
**Evidence:**
```typescript
expect(html).toContain('<!DOCTYPE html>');
expect(html).toContain('d3js.org');
expect(html).toContain('<svg');
```
These pass if HTML has broken tags, missing closing tags, or invalid structure. `toContain('<svg')` passes for `<svg` without closing `>`.
**Fix:** Either:
1. Use proper HTML validator (overkill for MVP)
2. At minimum, check for complete tags: `<svg></svg>`, `</html>`, etc.
3. Add snapshot test for generated HTML structure
**Verification:** Intentionally break HTML template, verify test fails.

### [MEDIUM] Node Title XSS/Injection Not Tested

**Location:** `viz.ts:93-94`, `tests/unit/cli/viz.test.ts:66-82`
**Problem:** Node titles are JSON.stringified but the test only uses safe titles ("Node A", "Node B"). No test verifies titles containing special characters are handled safely.
**Evidence:** Implementation does:
```typescript
const nodesJson = JSON.stringify(nodes);
```
JSON.stringify escapes quotes and backslashes but test doesn't verify this with adversarial input like:
- `title: "</script><script>alert(1)</script>"`
- `title: "Node\nWith\nNewlines"`
- `title: "Node with \"quotes\""`
**Fix:** Add test with malicious/special-character titles, verify HTML doesn't break and JavaScript parses correctly.
**Verification:** Load generated HTML in headless browser, verify no script errors.

### [MEDIUM] Output Path Edge Cases Not Tested

**Location:** `tests/unit/cli/viz.test.ts:40-48`
**Problem:** "respects custom output path" only tests one custom path. Missing edge cases:
1. Path with spaces: `/tmp/my folder/viz.html`
2. Existing file (should overwrite)
3. Relative path (implementation seems to accept it)
4. Path without .html extension
**Evidence:** Test uses simple path:
```typescript
const customPath = join(testDir, 'custom', 'viz.html');
```
**Fix:** Add test cases for paths with spaces, overwrite behavior, and clarify whether relative paths are supported.
**Verification:** Tests pass with edge-case paths.

### [MEDIUM] mkdir Failure Not Tested

**Location:** `viz.ts:78`
**Problem:** `mkdir(dirname(outputPath), { recursive: true })` could fail (permissions, disk full, etc.) but no test covers this.
**Evidence:**
```typescript
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, html, 'utf-8');
```
Both could throw, neither error path is tested.
**Fix:** Mock fs operations to throw and verify error propagates correctly.
**Verification:** Test confirms appropriate error is thrown.

### [MEDIUM] Self-Referencing Links Not Tested

**Location:** `viz.ts:64-70`
**Problem:** No test for a node that links to itself (`[[a]]` in `a.md`). The edge filtering logic at line 65 would include this edge since the node exists.
**Evidence:** All test cases use links between different nodes:
```typescript
await writeFile(join(testDir, 'a.md'), '...Links to [[B]]...', 'utf-8');
```
**Fix:** Add test where `a.md` contains `[[a]]` self-reference, verify edge count is correct and HTML renders without issues.
**Verification:** Test verifies self-loop is included in edge count (or explicitly filtered if that's desired behavior).

### [LOW] Large Graph Performance Not Tested

**Location:** `viz.ts:46-86`
**Problem:** No test verifies behavior with large graphs (100+ nodes). Could be slow or generate oversized HTML.
**Evidence:** All tests use 0-2 nodes.
**Fix:** Add smoke test with ~50-100 nodes to verify reasonable performance and valid output.
**Verification:** Test completes in reasonable time (<5s), HTML file is reasonable size.

### [LOW] Node Degree Calculation Not Directly Asserted

**Location:** `tests/unit/cli/viz.test.ts:66-82`
**Problem:** Test checks nodeCount and edgeCount but doesn't verify inDegree values are correct in the generated HTML/data.
**Evidence:** 
```typescript
expect(result.nodeCount).toBe(2);
expect(result.edgeCount).toBe(1);
// No assertion on inDegree values
```
**Fix:** Parse the generated HTML's JavaScript data and verify `inDegree` values match expected centrality.
**Verification:** Test extracts nodes array from HTML, verifies inDegree values.

### [LOW] No Test for Cache Close on Success

**Location:** `viz.ts:88`
**Problem:** Tests don't verify the cache is properly closed after successful execution. Could leak file handles.
**Evidence:** Implementation has `finally { cache.close(); }` but no test verifies this is called.
**Fix:** Add spy on cache.close() to verify it's called exactly once, regardless of success/failure.
**Verification:** Spy assertion passes.

## Cross-Reference

- `docs/issues/cli-command-test-gaps.md` - Item #4 mentions HTML sanitization concern (overlaps with XSS finding above)

## Priority

Address HIGH findings first - empty graph and cache failure are actual gaps in behavior coverage. MEDIUM findings improve robustness. LOW findings are nice-to-have hardening.
