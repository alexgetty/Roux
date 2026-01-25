---
type: Issue
severity: Medium
component: MCP
phase: 11
---

# Red Team Round 10 Tech Debt

MCP Server test audit findings. Medium priority.

## handlers.test.ts

### Lines 900-943: Dynamic imports in test cases
Multiple tests use `await import('../../../src/mcp/handlers.js')` inside test body despite module already being imported at top of file. Adds overhead and obscures intent.

### No test for numeric ID edge case
`handleGetNode`, `handleGetNeighbors`, etc. cast `args.id as string` without runtime validation. If `{id: 123}` is passed, handler proceeds with invalid type. Test should verify INVALID_PARAMS thrown for non-string id.

### handleListNodes total is nodes.length (post-pagination)
`handlers.ts:369` returns `total: nodes.length` which is the returned count, not total matching nodes. Test at line 910-913 passes because both values are 2, but doesn't catch the pagination bug.

## server.test.ts

### Line 102-106: Weak test for default stdio transport
Test only verifies `server.start` is a function, not that it works without arguments.

### Mock helpers duplicated across test files
`createMockStore` and `createMockCore` appear in both handlers.test.ts and server.test.ts. Extract to shared test fixture.

## transforms.test.ts

### pathToResponse empty path returns length -1
`pathToResponse([])` returns `{ path: [], length: -1 }`. Mathematically correct but semantically odd. Consider returning 0 or rejecting empty paths.

## handlers.integration.test.ts

### No integration tests for list_nodes, resolve_nodes, nodes_exist
Unit tests exist but no real-filesystem integration coverage for these newer tools.

### 60s warmup timeout without validation
`beforeAll` warmup doesn't assert model loaded correctly. Failed load would cascade as confusing errors in subsequent tests.
