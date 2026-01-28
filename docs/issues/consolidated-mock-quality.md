---
tags:
  - consolidated
  - test-audit
  - mocks
  - testing
status: open
priority: medium
title: consolidated-mock-quality
---

# Consolidated: Mock Quality and Interface Drift

## Problem Pattern
Test mocks silently succeed regardless of input, don't match interface contracts, or allow tests to pass when the mocked behavior diverges from reality.

## Affected Locations

| File | Finding | Severity |
|------|---------|----------|
| tests/unit/mcp/server.test.ts | Mock store `nodesExist` always returns empty Map | HIGH |
| tests/unit/mcp/transforms.test.ts | Mock store missing type safety, could drift from interface | LOW |
| tests/unit/mcp/handlers.test.ts | Mock store missing methods silently | LOW |
| tests/unit/docstore/file-watcher.test.ts | `triggerEvent` silently no-ops if handler not found | HIGH |
| tests/unit/docstore/file-watcher.test.ts | Mocking undermines coalescing test (bypasses chokidar) | HIGH |
| tests/unit/docstore/watcher.test.ts | `vectorProvider.delete()` mock always succeeds | MEDIUM |
| tests/unit/embedding/transformers.test.ts | Pipeline caching test uses timing instead of call counting | MEDIUM |
| tests/integration/watcher/file-events.test.ts | `createChangeCapture` only captures last callback, not all | MEDIUM |

## Root Cause Analysis
Mock quality issues stem from:
1. **Minimal mocking**: Only methods under test are mocked, others are undefined
2. **Always-succeed pattern**: `mockResolvedValue(...)` without conditional logic
3. **Silent fallback**: Missing handlers return undefined instead of failing
4. **Timing-based verification**: Using time delays instead of call counts

These issues cause:
- Tests passing when they should fail (false positives)
- Interface changes not caught by tests
- Unrealistic test scenarios that don't match production

## Fix Strategy

1. **Add assertion to trigger functions**:
   ```typescript
   function triggerEvent(event: string, arg?: string | Error) {
     const mockWatcher = getMockWatcher();
     const handler = mockWatcher.on.mock.calls.find(
       (call) => call[0] === event
     )?.[1];
     
     if (!handler) {
       throw new Error(`No handler registered for event '${event}'`);
     }
     
     handler(arg);
   }
   ```

2. **Make mocks implementation-aware**:
   ```typescript
   // Before (always empty)
   nodesExist: vi.fn().mockResolvedValue(new Map()),
   
   // After (input-aware)
   nodesExist: vi.fn().mockImplementation(async (ids: string[]) => {
     const result = new Map<string, boolean>();
     for (const id of ids) {
       result.set(id, existingNodes.has(id));
     }
     return result;
   }),
   ```

3. **Use spy-based verification instead of timing**:
   ```typescript
   // Before (timing-based, flaky)
   const start = performance.now();
   await p.embed('second call');
   expect(performance.now() - start).toBeLessThan(5000);
   
   // After (call counting, deterministic)
   const pipelineSpy = vi.spyOn(transformers, 'pipeline');
   await p.embed('first');
   await p.embed('second');
   expect(pipelineSpy).toHaveBeenCalledTimes(1);
   ```

4. **Add interface compliance checking**:
   ```typescript
   function createMockStore(): StoreProvider {
     const mock = {
       getNode: vi.fn(),
       createNode: vi.fn(),
       // ... all methods
     };
     
     // Verify all interface methods are present
     const interfaceMethods: (keyof StoreProvider)[] = [
       'getNode', 'createNode', 'updateNode', 'deleteNode', // ...
     ];
     for (const method of interfaceMethods) {
       if (!(method in mock)) {
         throw new Error(`Mock missing interface method: ${method}`);
       }
     }
     
     return mock as StoreProvider;
   }
   ```

5. **Capture all callbacks, not just last**:
   ```typescript
   // Before (overwrites)
   const callback = (changedIds: string[]) => {
     capturedIds = changedIds;
   };
   
   // After (accumulates)
   const allBatches: string[][] = [];
   const callback = (changedIds: string[]) => {
     allBatches.push([...changedIds]);
   };
   ```

## Verification
1. For each mock gap, verify the test could pass with broken implementation
2. Update mock to fail appropriately
3. Confirm test now fails with broken implementation
4. Fix implementation (if needed) and verify test passes

## Source Audits
- [[audit-mcp-server-test]]
- [[audit-mcp-transforms-test]]
- [[audit-mcp-handlers-test]]
- [[audit-file-watcher-test]]
- [[audit-docstore-watcher-test]]
- [[audit-embedding-transformers-test]]
- [[audit-watcher-file-events-test]]
