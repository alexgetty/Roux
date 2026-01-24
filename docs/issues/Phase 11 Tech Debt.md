---
type: Issue
severity: Medium
component: Tests
phase: 11
---

# Phase 11 Tech Debt

Medium-priority issues from Phase 11 red-team audit. Not blocking, documented for future cleanup.

## Fixed

- ~~Temp directory leak in integration tests~~ — Changed afterAll to afterEach with proper store.close()

## Medium (remaining)

### 1. fromConfig test creates separate DocStore

**File:** `tests/integration/core/graphcore.integration.test.ts:334-366`

Test creates a second DocStore manually instead of verifying the one created by `fromConfig()`. Tests the wrong thing.

**Suggestion:** Access store through configured core, or test config parsing separately.

### 2. Debounce batching assertion is loose

**File:** `tests/integration/watcher/file-events.test.ts:104-131`

Uses `1 <= callCount <= 3` due to filesystem timing. Valid reason, but consider deterministic fake timer test in unit layer.

## Roadmap (out of scope)

- No concurrent search test — MVP targets <200 nodes
- No embedding model upgrade test — Dimension mismatch handled by-design (overwrite)
- No handler timeout tests — MCP SDK handles timeouts
- No concurrent handler invocation test — SQLite serializes writes

## References

- Red-team audit (2026-01-24)
- Phase 11: Integration & Polish
