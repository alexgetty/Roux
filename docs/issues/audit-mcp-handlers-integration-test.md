---
tags:
  - test-audit
  - integration
  - mcp
status: open
title: audit-mcp-handlers-integration-test
---

# Test Audit: handlers.integration.test.ts

## Summary

The MCP handlers integration test has reasonable happy-path coverage but lacks edge case testing, concurrent access scenarios, and is missing integration tests for `handleResolveNodes`. Response shape assertions are weak in several places.

## Findings

### [HIGH] Missing Integration Test for handleResolveNodes

**Location:** `tests/integration/mcp/handlers.integration.test.ts` - absent

**Problem:** `handleResolveNodes` is imported but never tested in integration tests. Unit tests exist at `tests/unit/mcp/handlers.test.ts:1405-1489` but only with mocked core. No real-filesystem test verifies:
- Fuzzy resolution with actual DocStore data
- Semantic resolution with actual embeddings
- Filter options (`tag`, `path`) against real indexed data

**Evidence:** `handleResolveNodes` is not imported in the integration test file (check imports lines 8-22):
```typescript
import {
  handleSearch,
  handleGetNode,
  // ... many handlers ...
  handleListNodes,
  handleNodesExist,
  // handleResolveNodes is MISSING
} from '../../../src/mcp/handlers.js';
```

**Fix:** Add integration tests for `handleResolveNodes`:
1. Test fuzzy resolution: create "Chicken Thigh.md", resolve "chiken thigh" (typo)
2. Test semantic resolution: create "poultry.md", resolve "bird meat" 
3. Test with tag/path filters against real data

**Verification:** Run `vitest tests/integration/mcp/handlers.integration.test.ts` and confirm new tests pass with real filesystem.

---

### [HIGH] Weak Assertion on NodeWithContextResponse

**Location:** `tests/integration/mcp/handlers.integration.test.ts:149-151`

**Problem:** Test checks `'incomingNeighbors' in result!` but doesn't verify the actual neighbor content. A bug could return empty arrays when there should be data.

**Evidence:**
```typescript
it('returns node with context at depth=1', async () => {
  await writeMarkdownFile(
    'parent.md',
    '---\ntitle: Parent\n---\nLinks to [[test-node]].'
  );
  await store.sync();

  const result = await handleGetNode(ctx, { id: 'test-node.md', depth: 1 });

  expect(result).not.toBeNull();
  expect(result!.id).toBe('test-node.md');
  // Should have context fields
  expect('incomingNeighbors' in result!).toBe(true);  // WEAK
  expect('outgoingNeighbors' in result!).toBe(true);  // WEAK
  // Missing: expect(result!.incomingNeighbors).toHaveLength(1);
  // Missing: expect(result!.incomingNeighbors[0].id).toBe('parent.md');
});
```

**Fix:** Assert actual neighbor arrays contain expected data:
```typescript
expect(result!.incomingNeighbors).toHaveLength(1);
expect(result!.incomingNeighbors[0].id).toBe('parent.md');
expect(result!.incomingCount).toBe(1);
expect(result!.outgoingNeighbors).toHaveLength(0);
expect(result!.outgoingCount).toBe(0);
```

**Verification:** After fix, intentionally break neighbor logic in `nodeToContextResponse` and confirm test fails.

---

### [MEDIUM] No Test for direction='both' in handleGetNeighbors

**Location:** `tests/integration/mcp/handlers.integration.test.ts:160-201`

**Problem:** Tests cover `direction: 'out'` and `direction: 'in'` but not `direction: 'both'` (the default). The handler at `handlers.ts:164` defaults to `'both'` but no integration test verifies this works correctly.

**Evidence:** 
```typescript
// Tested:
direction: 'out'  // line 174
direction: 'in'   // line 185
// NOT tested:
direction: 'both' // default case
```

**Fix:** Add test:
```typescript
it('returns both incoming and outgoing neighbors with default direction', async () => {
  const results = await handleGetNeighbors(ctx, { id: 'center.md' });
  // Should return leaf-a and leaf-b (outgoing from center)
  expect(results.length).toBeGreaterThanOrEqual(2);
});
```

**Verification:** Run test, then break `direction: 'both'` logic and confirm failure.

---

### [MEDIUM] handleRandomNode tag filter never tested

**Location:** `tests/integration/mcp/handlers.integration.test.ts:305-346`

**Problem:** `handleRandomNode` tests exist but the `tags` filter is never exercised. Handler at `handlers.ts:263-271` accepts tags parameter but no integration test verifies it filters correctly.

**Evidence:**
```typescript
it('returns a random node', async () => {
  const result = await handleRandomNode(ctx, {});  // No tags filter
  // ...
});

it('returns null when no nodes exist', async () => {
  const result = await handleRandomNode(emptyCtx, {});  // No tags filter
  // ...
});
```

**Fix:** Add test:
```typescript
it('returns random node filtered by tag', async () => {
  await writeMarkdownFile('tagged.md', '---\ntags:\n  - special\n---\nTagged.');
  await writeMarkdownFile('untagged.md', '---\n---\nNo tags.');
  await store.sync();

  // Run multiple times to ensure filter works (not just luck)
  for (let i = 0; i < 10; i++) {
    const result = await handleRandomNode(ctx, { tags: ['special'] });
    expect(result).not.toBeNull();
    expect(result!.id).toBe('tagged.md');
  }
});
```

**Verification:** Run test, then break tag filter in core and confirm failure.

---

### [MEDIUM] No include_content Parameter Testing

**Location:** `tests/integration/mcp/handlers.integration.test.ts:88-116` (handleSearch), `160-201` (handleGetNeighbors)

**Problem:** `handleSearch` and `handleGetNeighbors` support `include_content` parameter (see `handlers.ts:100, 166`) but integration tests never verify this. Unit tests cover it, but real filesystem behavior untested.

**Evidence:** Grep for `include_content` in integration test file returns no matches.

**Fix:** Add tests:
```typescript
it('excludes content by default', async () => {
  const results = await handleSearch(ctx, { query: 'static types' });
  expect('content' in results[0]!).toBe(false);
});

it('includes content when include_content is true', async () => {
  const results = await handleSearch(ctx, { query: 'static types', include_content: true });
  expect(results[0]!.content).toBeDefined();
  expect(results[0]!.content).toContain('TypeScript');
});
```

**Verification:** Run tests, verify response shapes match expected metadata-only vs full content.

---

### [MEDIUM] handleUpdateNode Missing Title Update Verification

**Location:** `tests/integration/mcp/handlers.integration.test.ts:414-420`

**Problem:** Test updates content but never verifies a successful title update (non-rename case). The `title` update path is only tested in the error case (LINK_INTEGRITY).

**Evidence:**
```typescript
it('updates node content', async () => {
  const result = await handleUpdateNode(ctx, {
    id: 'to-update.md',
    content: 'Updated content.',  // Only content
  });
  expect(result.content).toBe('Updated content.');
});

it('updates node tags', async () => { /* only tags */ });

// Missing: successful title update without incoming links
```

**Fix:** Add test:
```typescript
it('updates node title when no incoming links', async () => {
  const result = await handleUpdateNode(ctx, {
    id: 'to-update.md',
    title: 'New Title',
  });
  expect(result.title).toBe('New Title');
  
  // Verify persisted
  const retrieved = await store.getNode('to-update.md');
  expect(retrieved!.title).toBe('New Title');
});
```

**Verification:** Run test, break title update in core, confirm failure.

---

### [MEDIUM] handleListNodes offset Parameter Not Tested

**Location:** `tests/integration/mcp/handlers.integration.test.ts:484-533`

**Problem:** Tests verify `limit` and `total` behavior but never test `offset` pagination. Handler at `handlers.ts:425` supports offset but integration test doesn't verify it.

**Evidence:**
```typescript
it('returns total matching nodes, not just returned slice', async () => {
  const result = await handleListNodes(ctx, { limit: 2 });
  // Tests limit but not offset
});
```

**Fix:** Add test:
```typescript
it('respects offset for pagination', async () => {
  const page1 = await handleListNodes(ctx, { limit: 2, offset: 0 });
  const page2 = await handleListNodes(ctx, { limit: 2, offset: 2 });
  
  expect(page1.nodes).toHaveLength(2);
  expect(page2.nodes).toHaveLength(2);
  
  // Verify different nodes returned
  const page1Ids = page1.nodes.map(n => n.id);
  const page2Ids = page2.nodes.map(n => n.id);
  expect(page1Ids).not.toEqual(page2Ids);
});
```

**Verification:** Run test, break offset handling, confirm failure.

---

### [LOW] No Test for handleCreateNode with explicit title

**Location:** `tests/integration/mcp/handlers.integration.test.ts:353-367`

**Problem:** Test creates node with derived title but never tests explicit `title` parameter. Handler supports it at `handlers.ts:301, 333`.

**Evidence:**
```typescript
it('creates a new node', async () => {
  const result = await handleCreateNode(ctx, {
    id: 'New Note.md',
    content: 'This is new content.',
    tags: ['new', 'test'],
    // Missing: title: 'Custom Title'
  });
  expect(result.title).toBe('New Note');  // Derived, not explicit
});
```

**Fix:** Add test:
```typescript
it('uses explicit title when provided', async () => {
  const result = await handleCreateNode(ctx, {
    id: 'file.md',
    content: 'Content.',
    title: 'Custom Display Title',
  });
  expect(result.title).toBe('Custom Display Title');
});
```

**Verification:** Run test, break explicit title handling, confirm failure.

---

### [LOW] handleFindPath Self-Path Not Tested

**Location:** `tests/integration/mcp/handlers.integration.test.ts:203-236`

**Problem:** No test for `source === target` case. What happens when finding path from node to itself?

**Evidence:** Only tests:
- Path exists between different nodes
- No path exists (disconnected)

**Fix:** Add test:
```typescript
it('returns single-node path for same source and target', async () => {
  const result = await handleFindPath(ctx, {
    source: 'start.md',
    target: 'start.md',
  });
  expect(result).not.toBeNull();
  expect(result!.path).toEqual(['start.md']);
  expect(result!.length).toBe(0);
});
```

**Verification:** Run test, verify behavior matches expectation (or document if this should return null).

---

### [LOW] No McpError Code Assertions

**Location:** Throughout file (lines 110, 114-115, 389, 439, 455)

**Problem:** Tests use `.rejects.toThrow(McpError)` but don't verify the error code. A bug could throw wrong error code (e.g., `NODE_NOT_FOUND` instead of `INVALID_PARAMS`).

**Evidence:**
```typescript
await expect(
  handleSearch(noEmbeddingCtx, { query: 'test' })
).rejects.toThrow(McpError);  // PROVIDER_ERROR expected but not asserted
```

**Fix:** Assert error codes:
```typescript
await expect(
  handleSearch(noEmbeddingCtx, { query: 'test' })
).rejects.toMatchObject({
  code: 'PROVIDER_ERROR',
});
```

**Verification:** Change error code in handler, confirm test fails.

---

## References

- Unit tests: `tests/unit/mcp/handlers.test.ts`
- Implementation: `src/mcp/handlers.ts`
- Related issues:
  - `docs/issues/mcp-integration-test-gaps.md` (overlaps with missing integration tests)
  - `docs/issues/MCP Layer Gaps.md` (broader MCP issues)
