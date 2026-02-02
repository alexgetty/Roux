---
id: U-vDpYwwVzaf
title: Test Coverage Extensions
tags:
  - roadmap
type: Feature
status: Proposed
priority: P3
effort: M
phase: Post-MVP
category: Testing
parent: '[[Testing Framework]]'
---
# Feature - Test Coverage Extensions

Edge case and stress testing identified during red-team audit round 5.

## Summary

Post-MVP test improvements for robustness and edge case coverage. Not blocking MVP but would improve confidence in production scenarios.

## Proposed Tests

### 1. 10k emoji paste test

**Location:** `tests/unit/mcp/handlers.test.ts`

What happens if `handleCreateNode` gets a title with 10,000 emojis? Current sanitizer strips them → `'untitled'`. Acceptable but maybe worth a warning log.

**Complexity:** Low
**Priority:** Low

### 2. Concurrent search during store

**Location:** `tests/unit/vector/sqlite.test.ts`

What if `store()` is called while `search()` is iterating? SQLite should handle via transaction isolation but not explicitly tested.

**Complexity:** Medium — needs async coordination
**Priority:** Low

### 3. Parse failure recovery

**Location:** `tests/unit/docstore/watcher.test.ts`

Test says "retry on next event" in plan, but no test verifies that a previously failed file is successfully parsed on the next change event.

**Complexity:** Low
**Priority:** Low

### 4. Filesystem permission errors

**Location:** `tests/integration/watcher/file-events.test.ts`

What if a file is created but user doesn't have read permission? Currently not tested — would require platform-specific setup.

**Complexity:** High — platform-specific
**Priority:** Low

## References

- Phase 10 red-team audit round 5 (2026-01-24)
- [[Red Team Round 5 Tech Debt]] for Medium-priority items
