---
tags:
  - consolidated
  - test-audit
  - errors
  - async
status: open
priority: high
title: consolidated-error-propagation-gaps
---

# Consolidated: Error Propagation and Async Failure Gaps

## Problem Pattern
Async operations (embedding, store calls, transform functions) can fail, but tests only cover success paths. When underlying operations throw, errors either propagate uncaught or are swallowed silently without test verification.

## Affected Locations

| File | Finding | Severity |
|------|---------|----------|
| tests/unit/mcp/transforms.test.ts | `nodeToResponse` error when `store.resolveTitles` throws | HIGH |
| tests/unit/mcp/transforms.test.ts | `nodeToContextResponse` parallel Promise.all failure | HIGH |
| tests/unit/mcp/handlers.test.ts | Transform layer errors not propagated through handlers | MEDIUM |
| tests/unit/mcp/server.test.ts | `dispatchTool` throwing non-Error values (string, undefined) | HIGH |
| tests/unit/embedding/transformers.test.ts | No error handling tests for pipeline initialization | HIGH |
| tests/unit/cli/serve.test.ts | Embedding failure during startup crashes serve | CRITICAL |
| tests/unit/cli/serve.test.ts | Watch callback embedding failure not tested | MEDIUM |
| tests/unit/cli/serve.test.ts | Cleanup on partial initialization failure | HIGH |
| tests/unit/docstore/cache.test.ts | `JSON.parse` error on corrupted data | MEDIUM |
| tests/unit/core/graphcore.test.ts | Search options (threshold, tags) unimplemented but untested | MEDIUM |
| tests/unit/docstore/watcher.test.ts | `vectorProvider.delete()` failure not tested | MEDIUM |

## Root Cause Analysis
Error paths are skipped because:
1. **Mocks always succeed**: Test mocks return resolved promises, never reject
2. **No failure injection**: Tests don't simulate underlying failures
3. **Graceful degradation unclear**: When errors occur, is it catch-and-log or propagate?

This leaves error handling code untested, leading to:
- Unhandled promise rejections in production
- Silent data loss when operations fail
- Unclear error messages when failures occur

## Fix Strategy

1. **Add rejection mocks to test files**:
   ```typescript
   it('propagates error when resolveTitles rejects', async () => {
     const store = createMockStore();
     (store.resolveTitles as Mock).mockRejectedValue(new Error('DB unavailable'));
     
     await expect(nodeToResponse(node, store, 'primary'))
       .rejects.toThrow('DB unavailable');
   });
   ```

2. **Test Promise.all partial failure**:
   ```typescript
   it('handles partial failure in batch operations', async () => {
     const store = createMockStore();
     let callCount = 0;
     (store.resolveTitles as Mock).mockImplementation(async () => {
       if (++callCount === 2) throw new Error('Second call fails');
       return new Map();
     });
     
     // Document expected behavior: fail fast? collect errors? partial results?
   });
   ```

3. **Test non-Error throw values**:
   ```typescript
   it('handles string thrown as error', async () => {
     (mockCore.getNode as Mock).mockRejectedValue('string error');
     const response = await executeToolCall(ctx, 'get_node', { id: 'x' });
     expect(response.isError).toBe(true);
   });
   
   it('handles undefined thrown as error', async () => {
     (mockCore.getNode as Mock).mockRejectedValue(undefined);
     const response = await executeToolCall(ctx, 'get_node', { id: 'x' });
     expect(response.isError).toBe(true);
   });
   ```

4. **Test cleanup on partial initialization**:
   ```typescript
   it('closes store when mcpServer.start() fails', async () => {
     const closeSpy = vi.spyOn(DocStore.prototype, 'close');
     
     // Mock transport to throw
     const badTransport = vi.fn().mockRejectedValue(new Error('Transport failed'));
     
     await expect(serveCommand(testDir, { transportFactory: badTransport }))
       .rejects.toThrow('Transport failed');
     
     expect(closeSpy).toHaveBeenCalled(); // Cleanup happened
   });
   ```

5. **Add graceful degradation tests**:
   ```typescript
   it('continues processing when one file embedding fails', async () => {
     // Mock embed to fail for specific file
     vi.spyOn(embedding, 'embed').mockImplementation(async (text) => {
       if (text.includes('bad')) throw new Error('Embedding failed');
       return [0.1, 0.2, 0.3];
     });
     
     // Verify other files still processed
   });
   ```

## Verification
1. For each error test, verify the expected behavior (throw vs catch-and-log)
2. Check that error messages are useful (include context, not just "Error")
3. Verify cleanup functions are called in finally blocks

## Source Audits
- [[audit-mcp-transforms-test]]
- [[audit-mcp-handlers-test]]
- [[audit-mcp-server-test]]
- [[audit-embedding-transformers-test]]
- [[audit-cli-serve-test]]
- [[audit-docstore-cache-test]]
- [[audit-core-graphcore-test]]
- [[audit-docstore-watcher-test]]
