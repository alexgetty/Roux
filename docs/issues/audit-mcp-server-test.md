---
tags:
  - test-audit
  - mcp
  - issue
status: open
severity: mixed
component: MCP
phase: current
title: audit-mcp-server-test
---

# Test Audit: mcp/server.test.ts

## Summary

The `server.test.ts` file covers core MCP server functionality but has significant gaps in edge case coverage, relies on fragile SDK mocking patterns, and lacks tests for error paths in the integration layer.

## Findings

### [HIGH] No Test for dispatchTool Throwing Non-McpError

**Location:** `src/mcp/server.ts:452-457`, `tests/unit/mcp/server.test.ts:436-448`

**Problem:** The `executeToolCall` function catches errors and routes them through `formatErrorResponse`. The test at line 436-448 only tests when `core.getNode` throws a generic `Error`. However, `dispatchTool` can throw other types:
- Non-Error primitives (string, number, undefined thrown by user code)
- Objects with `.message` but not instanceof Error

The `formatErrorResponse` tests (lines 346-380) cover these cases in isolation, but `executeToolCall` is never tested with these edge cases flowing through the full path.

**Evidence:**
```typescript
// server.test.ts:436-448 - only tests generic Error
it('formats generic Error as PROVIDER_ERROR', async () => {
  (mockCore.getNode as ReturnType<typeof vi.fn>).mockRejectedValue(
    new Error('Database crashed')
  );
  // ...
});

// No test for:
// - mockCore.getNode.mockRejectedValue('string error')
// - mockCore.getNode.mockRejectedValue({ message: 'fake error' })
// - mockCore.getNode.mockRejectedValue(undefined)
```

**Fix:** Add tests in `executeToolCall` describe block for non-Error rejection values to verify the full error path.

**Verification:** Run `npm test -- --coverage` and confirm `executeToolCall` error branches have explicit test coverage.

---

### [HIGH] Mock Store Missing `nodesExist` Default Behavior

**Location:** `tests/unit/mcp/server.test.ts:20-39`

**Problem:** The `createMockStore()` function in the test file mocks `nodesExist` to return `new Map()` (line 37), but this doesn't match realistic behavior. When `nodes_exist` tool is called, it should return a Map with entries for each queried ID. The mock always returns empty Map regardless of input.

**Evidence:**
```typescript
// Line 37 - always returns empty Map
nodesExist: vi.fn().mockResolvedValue(new Map()),
```

This means any test that calls the `nodes_exist` tool via the MCP server integration path would silently get wrong results.

**Fix:** Either make the mock implementation-aware (return based on input IDs) or document that `nodes_exist` tool is not testable through this test file.

**Verification:** Add a test that calls `nodes_exist` through the full server path and verifies non-empty results.

---

### [MEDIUM] No Test for Server Capabilities Object

**Location:** `src/mcp/server.ts:471-474`

**Problem:** The server is constructed with `{ capabilities: { tools: {} } }`. No test verifies this capability configuration is correct or that changing it would break anything.

**Evidence:**
```typescript
// src/mcp/server.ts:471-474
this.server = new Server(
  { name: 'roux', version: VERSION },
  { capabilities: { tools: {} } }
);
```

If capabilities were misconfigured (e.g., wrong object shape), MCP clients might fail silently. There's no test asserting the capability structure.

**Fix:** Add test that inspects the Server constructor call arguments to verify capabilities are set correctly.

**Verification:** Add assertion that Server mock was called with expected capabilities object.

---

### [MEDIUM] VERSION Import Not Tested

**Location:** `src/mcp/server.ts:12`, `src/mcp/server.ts:472`

**Problem:** `VERSION` is imported from `../index.js` and passed to the Server constructor. No test verifies:
1. That VERSION is a valid semver string
2. That it's correctly passed to the Server

If VERSION became undefined or malformed, no test would catch it.

**Evidence:**
```typescript
// Line 12
import { VERSION } from '../index.js';

// Line 472 - passed to Server but never verified in tests
{ name: 'roux', version: VERSION },
```

**Fix:** Add test that verifies Server is constructed with a valid version string (regex match for semver).

**Verification:** Add assertion checking `Server` mock was called with version matching `/^\d+\.\d+\.\d+/`.

---

### [MEDIUM] close() Test Only Verifies No Throw

**Location:** `tests/unit/mcp/server.test.ts:163-168`

**Problem:** The `close()` test only checks that it doesn't throw. It doesn't verify that `server.close()` was actually called on the underlying SDK Server.

**Evidence:**
```typescript
describe('close', () => {
  it('closes server without error', async () => {
    const server = new McpServer(options);
    await expect(server.close()).resolves.not.toThrow();
  });
});
```

This test would pass even if `close()` was a no-op. The mock's `close` function is never asserted to have been called.

**Fix:** Assert that the mock Server's `close` method was called.

**Verification:** Add `expect(mockServer.close).toHaveBeenCalled()` (requires capturing mock instance).

---

### [MEDIUM] start() Does Not Verify server.connect() Called

**Location:** `tests/unit/mcp/server.test.ts:170-195`

**Problem:** The `start` tests verify that the transport factory is called and StdioServerTransport is instantiated, but never verify that `server.connect()` was called with the transport.

**Evidence:**
```typescript
it('starts with custom transport factory', async () => {
  // ...
  await server.start(factory);
  expect(factory).toHaveBeenCalled();
  // No assertion that server.connect was called with transport
});
```

**Fix:** Capture the mock Server instance and assert `connect` was called with the transport.

**Verification:** Add `expect(mockServer.connect).toHaveBeenCalledWith(mockTransport)`.

---

### [MEDIUM] TOOL_SCHEMAS Maximum Values Not Tested

**Location:** `src/mcp/server.ts:35-323`

**Problem:** Tool schemas define `maximum` constraints (e.g., `limit: { maximum: 50 }`, `limit: { maximum: 1000 }`). These constraints are declared in the schema but never tested. The MCP protocol may or may not enforce these at runtime - tests should verify the behavior when maximum is exceeded.

**Evidence:**
```typescript
// Line 44-48
limit: {
  type: 'integer',
  minimum: 1,
  maximum: 50,  // Never tested what happens if 51 is passed
  default: 10,
}
```

The handler tests verify minimum validation (limit < 1 throws), but maximum validation is unverified.

**Fix:** Either test that exceeding maximum produces an error, or document that maximum is advisory-only for LLM clients.

**Verification:** Add test passing `limit: 51` to search and verify behavior (error or clamped value).

---

### [MEDIUM] getToolDefinitions Missing Schema Validation Tests

**Location:** `tests/unit/mcp/server.test.ts:227-283`

**Problem:** Tests verify tool count and names but never validate schema correctness. For example:
- No test that `required` arrays reference existing properties
- No test that `enum` values are valid
- No test that `type` values are valid JSON Schema types

**Evidence:**
```typescript
it('tools have input schemas', () => {
  const tools = getToolDefinitions(true);
  for (const tool of tools) {
    expect(tool.inputSchema).toBeTruthy();
    expect(tool.inputSchema.type).toBe('object');
    // No deeper schema validation
  }
});
```

**Fix:** Add schema validation tests that verify `required` arrays reference real properties, enum arrays are non-empty, etc.

**Verification:** Add test that validates each tool's `required` properties exist in `properties` object.

---

### [LOW] formatToolResponse Tested in Isolation But Not Integration

**Location:** `tests/unit/mcp/server.test.ts:285-312`

**Problem:** `formatToolResponse` is tested directly but never verified through the full MCP handler path. The tests call the function directly, not through `executeToolCall` or the CallToolRequestSchema handler.

**Evidence:**
```typescript
describe('formatToolResponse', () => {
  it('wraps result in MCP content format', async () => {
    const { formatToolResponse } = await import('../../../src/mcp/server.js');
    const result = { nodes: [{ id: 'test.md' }], total: 1 };
    const response = formatToolResponse(result);
    // Direct call, not through handler
```

**Fix:** Add integration test that makes a tool call through the MCP handler and verifies the final response format.

**Verification:** Call handler with a successful tool request and verify response structure matches `formatToolResponse` output.

---

### [LOW] CallTool Handler Error Path Not Tested

**Location:** `tests/unit/mcp/server.test.ts:117-161`

**Problem:** The CallTool handler tests only cover success cases. When `executeToolCall` returns an error response (with `isError: true`), that path through the handler is never tested.

**Evidence:**
```typescript
it('registers CallTool handler that dispatches and formats result', async () => {
  // Only tests success case - mockCore.getNode returns a node
  const mockNode = { id: 'test.md', ... };
  (mockCore.getNode as ReturnType<typeof vi.fn>).mockResolvedValue(mockNode);
  // ...
});
```

**Fix:** Add test where the handler receives a request for an unknown tool and verify the response has `isError: true`.

**Verification:** Call handler with `name: 'unknown_tool'` and assert `response.isError === true`.

---

### [LOW] No Test for Empty Tool Arguments Object

**Location:** `tests/unit/mcp/server.test.ts:144-160`

**Problem:** Test at line 144-160 tests `arguments: undefined` fallback to `{}`. But there's no test for when `arguments` is explicitly an empty object `{}` for tools that require parameters.

**Evidence:**
```typescript
it('CallTool handler defaults undefined arguments to empty object', async () => {
  // Tests undefined -> {}
  const result = await handler!({
    params: { name: 'random_node', arguments: undefined },
  });
```

No test for:
```typescript
{ params: { name: 'get_node', arguments: {} } }  // missing required 'id'
```

**Fix:** Add test calling `get_node` with empty arguments object to verify INVALID_PARAMS error.

**Verification:** Add test with `{ name: 'get_node', arguments: {} }` and verify error response.

---

## Known Issues (Already Documented)

The following issues are already tracked and should not be re-reported:

1. **SDK Mock Fragility** - Documented in `docs/issues/mcp-server-test-fragility.md`
2. **Circular Reference Guard** - Documented in `docs/issues/mcp-server-test-fragility.md`
3. **JSON.stringify Edge Cases** - Documented in `docs/issues/MCP Layer Gaps.md`
4. **close() minimal verification** - Partially covered in `docs/issues/MCP Layer Gaps.md:64`

## Test Coverage Summary

| Area | Coverage | Gaps |
|------|----------|------|
| McpServer constructor | Good | Missing VERSION validation |
| start() | Partial | Missing connect() verification |
| close() | Weak | No mock assertion |
| ListTools handler | Good | None |
| CallTool handler | Partial | Missing error path, empty args |
| formatToolResponse | Good (isolated) | No integration test |
| formatErrorResponse | Good | None |
| executeToolCall | Partial | Non-Error rejection types |
| getToolDefinitions | Good | Schema validation missing |
| TOOL_SCHEMAS | None | Maximum validation untested |

## Priority Order for Green Team

1. CallTool handler error path test (LOW but blocks finding errors in production)
2. executeToolCall non-Error rejection tests (HIGH - production safety)
3. start()/close() mock verification (MEDIUM - ensures cleanup works)
4. TOOL_SCHEMAS maximum validation (MEDIUM - contract clarity)
5. Schema validation tests (MEDIUM - prevents silent schema bugs)
