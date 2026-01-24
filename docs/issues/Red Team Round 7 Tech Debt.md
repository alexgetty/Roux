---
type: Issue
severity: Medium
component: Tests
phase: 9
---

# Red Team Round 7 Tech Debt

## Summary

Audit of 4 changed test files. No Critical or High issues found. 7 Medium items documented below.

## Files Audited

- `tests/unit/vector/sqlite.test.ts`
- `tests/unit/docstore/watcher.test.ts`
- `tests/unit/mcp/handlers.test.ts`
- `tests/integration/watcher/file-events.test.ts`

---

## Issues

### 1. Zero Vector Accepted Without Warning

**File:** `src/providers/vector/sqlite.ts:31-39`
**Test:** `tests/unit/vector/sqlite.test.ts:359-364`

Tests verify zero vector returns distance 1, but zero vectors are semantically meaningless for embeddings. Implementation accepts `[0,0,0]` without validation or warning.

**Impact:** Silent garbage - zero embeddings provide no semantic value but are stored anyway.

**Suggested Fix:** Either throw on zero magnitude vectors or log warning.

---

### 2. Event Coalescing Tests Missing Cache State Assertions

**File:** `tests/unit/docstore/watcher.test.ts:361-428`

Tests for event coalescing (add+change, change+unlink, etc.) verify `onChange` callback arguments but most don't assert final cache state. Line 403-427 (`change + unlink = unlink`) correctly checks cache, but lines 361-378 (`add + change = add`) only checks callback count.

**Impact:** Callback could fire with correct IDs but cache could be in wrong state.

**Suggested Fix:** Add cache state assertions to all coalescing tests.

---

### 3. Debounce Test Timing Fragility

**File:** `tests/unit/docstore/watcher.test.ts:286-357`

Tests use `vi.waitFor({ timeout: 2000 })` with 1000ms debounce. If CI is slow or filesystem ops take longer, tests may flake. The batching test assumes files are created faster than debounce fires.

**Impact:** Potential flaky tests on slow CI.

**Suggested Fix:** Add comments explaining timing requirements, or use fake timers for unit tests (integration tests legitimately need real time).

---

### 4. sanitizeFilename Missing Leading/Trailing Hyphen Test

**File:** `tests/unit/mcp/handlers.test.ts:853-891`

Tests verify spaces become hyphens and multiple hyphens collapse, but no test for input like `'--hello--'` which should become `'hello'`.

**Impact:** Edge case untested. Implementation handles it, but test suite doesn't prove it.

**Suggested Fix:** Add test case: `expect(sanitizeFilename('--hello--')).toBe('hello')`

---

### 5. Negative Limit Handled by Provider, Not Handler

**File:** `tests/unit/mcp/handlers.test.ts:179-188`

Test documents that `limit: '-5'` coerces to `-5` and passes through to core. Comment says "underlying provider handles negative limits" but this pushes validation burden to every provider.

**Impact:** Each provider must independently handle negative limits. Inconsistent behavior risk.

**Suggested Fix:** Either validate limit >= 0 at handler level, or document this as explicit contract. Current test documents behavior; no code fix needed unless policy changes.

---

### 6. handleDeleteNode Integration Gap (Documentation Only)

**File:** `tests/unit/mcp/handlers.test.ts:826-850`

Handler test correctly verifies delegation to `core.deleteNode()`. The full flow (handler → core → store → vectorProvider.delete) is tested at the store level but no single integration test covers the complete MCP-to-vector path.

**Impact:** If wiring breaks between layers, no single test catches it.

**Suggested Fix:** Add integration test in Phase 11: `handleDeleteNode` → verify vector embedding actually deleted.

---

### 7. Integration Test Timeouts Need Comments

**File:** `tests/integration/watcher/file-events.test.ts` (various)

Tests use 5000-8000ms timeouts without explaining why. These are necessary (real filesystem + chokidar stability threshold + debounce) but future maintainers may reduce and cause flakes.

**Impact:** Maintenance burden - unclear why timeouts are so long.

**Suggested Fix:** Add comment at top of file:
```typescript
// Timeouts explanation:
// - chokidar stabilityThreshold: 100ms
// - debounce window: 1000ms
// - filesystem event propagation: variable
// - Total safe timeout: 5000-8000ms for reliable CI
```

---

## References

- Red-team audit (2026-01-24)
- Phase 9: MCP Server
- MVP targets <200 nodes
