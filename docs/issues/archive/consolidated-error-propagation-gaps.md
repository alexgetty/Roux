---
title: consolidated-error-propagation-gaps
tags:
  - consolidated
  - test-audit
  - errors
  - async
status: open
priority: high
---
# Consolidated: Error Propagation and Async Failure Gaps

## Problem Pattern
Async operations (embedding, store calls, transform functions) can fail, but tests only cover success paths. When underlying operations throw, errors either propagate uncaught or are swallowed silently without test verification.

## Affected Locations

| File | Finding | Severity | Status |
|------|---------|----------|--------|
| tests/unit/mcp/transforms.test.ts | `nodeToResponse` error when `store.resolveTitles` throws | HIGH | ✅ DONE |
| tests/unit/mcp/transforms.test.ts | `nodeToContextResponse` parallel Promise.all failure | HIGH | ✅ DONE |
| tests/unit/mcp/handlers.test.ts | Transform layer errors not propagated through handlers | MEDIUM | OPEN |
| tests/unit/mcp/server.test.ts | `dispatchTool` throwing non-Error values (string, undefined) | HIGH | ✅ DONE |
| tests/unit/embedding/transformers.test.ts | No error handling tests for pipeline initialization | HIGH | OPEN |
| tests/unit/cli/serve.test.ts | Embedding failure during startup crashes serve | CRITICAL | ✅ DONE |
| tests/unit/cli/serve.test.ts | Watch callback embedding failure not tested | MEDIUM | ✅ DONE (+ fix) |
| tests/unit/cli/serve.test.ts | Cleanup on partial initialization failure | HIGH | ✅ DONE (+ fix) |
| tests/unit/docstore/cache.test.ts | `JSON.parse` error on corrupted data | MEDIUM | OPEN |
| tests/unit/core/graphcore.test.ts | Search options (threshold, tags) unimplemented but untested | MEDIUM | OPEN |
| tests/unit/docstore/watcher.test.ts | `vectorProvider.delete()` failure not tested | MEDIUM | OPEN |

**Progress: 7/11 complete**

## Implementation Fixes Made

### 1. Store cleanup on MCP server failure
`src/cli/commands/serve.ts` — Added try/catch around mcpServer.start() that calls store.close() on failure.

### 2. Graceful degradation in watch callback  
`src/cli/commands/serve.ts` — Watch callback now catches embedding failures per-file and logs warning instead of crashing.

## Remaining Work
- Transform layer error propagation through handlers (MEDIUM)
- Pipeline initialization error handling (HIGH)  
- JSON.parse error on corrupted cache data (MEDIUM)
- Search options unimplemented behavior (MEDIUM)
- vectorProvider.delete() failure (MEDIUM)
