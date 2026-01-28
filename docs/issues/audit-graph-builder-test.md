---
tags:
  - test-audit
  - graph
status: open
title: audit-graph-builder-test
---

# Test Audit: graph/builder.test.ts

## Summary

The test suite covers core happy paths but has significant gaps around edge cases, error conditions, and boundary validation. The duplicate node ID case is already documented in [[Graph Test Coverage]] but several additional gaps exist.

## Findings

### [HIGH] No test for duplicate node IDs (known, but not fixed)

**Location:** `tests/unit/graph/builder.test.ts` - missing test
**Problem:** `buildGraph` calls `graph.addNode(node.id)` without checking if the node already exists. Graphology throws `Graph.addNode: The "a.md" node already exists in the graph.` on duplicates. This is already noted in [[Graph Test Coverage]] but remains unimplemented.
**Evidence:** 
```typescript
// src/graph/builder.ts:14-16
for (const node of nodes) {
  graph.addNode(node.id);  // throws if duplicate
  nodeIds.add(node.id);
}
```
**Fix:** Add test confirming expected behavior (throw or dedupe - decision pending per [[Graph Test Coverage]]).
**Verification:** Test should either expect a throw or expect last-wins deduplication.

### [MEDIUM] No test for empty string node ID

**Location:** `tests/unit/graph/builder.test.ts` - missing test
**Problem:** The function accepts nodes with empty string IDs (`id: ''`). Graphology allows empty string as a node key. This may or may not be valid depending on business rules.
**Evidence:**
```typescript
// No validation in buildGraph
export function buildGraph(nodes: Node[]): DirectedGraph {
  const graph = new DirectedGraph();
  for (const node of nodes) {
    graph.addNode(node.id);  // accepts ''
```
**Fix:** Add test that documents behavior for empty string IDs. Either:
- Expect it to work (if valid)
- Expect a validation error (if invalid, requires implementation change)
**Verification:** `buildGraph([createNode({ id: '' })]).hasNode('')` confirms behavior.

### [MEDIUM] No test for whitespace-only node ID

**Location:** `tests/unit/graph/builder.test.ts` - missing test
**Problem:** Similar to empty string, nodes with whitespace-only IDs (`id: '   '`) are accepted. Links like `outgoingLinks: ['   ']` would create edges to whitespace nodes.
**Evidence:** No validation in `buildGraph` for whitespace IDs.
**Fix:** Add test documenting whitespace ID behavior.
**Verification:** `buildGraph([createNode({ id: '  ' })]).hasNode('  ')` confirms behavior.

### [MEDIUM] No test for case sensitivity of node IDs

**Location:** `tests/unit/graph/builder.test.ts` - missing test
**Problem:** The codebase normalizes IDs to lowercase elsewhere (see [[roux-id-normalization-bug]]), but `buildGraph` treats `A.md` and `a.md` as different nodes. If a node has `outgoingLinks: ['A.md']` but only `a.md` exists, the link is ignored.
**Evidence:**
```typescript
// src/graph/builder.ts:24
if (!nodeIds.has(target) || seen.has(target)) {
  continue;  // Set.has is case-sensitive
}
```
**Fix:** Add test showing case-sensitive behavior. Consider whether `buildGraph` should normalize IDs.
**Verification:** 
```typescript
const nodes = [
  createNode({ id: 'a.md', outgoingLinks: ['B.md'] }),
  createNode({ id: 'b.md' }),  // lowercase
];
const graph = buildGraph(nodes);
expect(graph.hasDirectedEdge('a.md', 'b.md')).toBe(false);  // link broken
```

### [LOW] Test helper creates minimal Node without optional fields

**Location:** `tests/unit/graph/builder.test.ts:5-13`
**Problem:** The `createNode` helper omits optional Node fields (`plugins`, `sourceRef`). While these aren't used by `buildGraph`, tests should document that these fields are ignored.
**Evidence:**
```typescript
const createNode = (overrides: Partial<Node> = {}): Node => ({
  id: 'test.md',
  title: 'Test',
  content: '',
  tags: [],
  outgoingLinks: [],
  properties: {},
  ...overrides,
});
// Missing: plugins, sourceRef
```
**Fix:** No action needed, but consider adding one test explicitly showing `plugins` and `sourceRef` don't affect graph building.
**Verification:** Pass nodes with `plugins` and `sourceRef` populated, verify graph structure unchanged.

### [LOW] No test for very large node counts

**Location:** `tests/unit/graph/builder.test.ts` - missing test
**Problem:** No performance boundary test. Building a graph with 10,000+ nodes may reveal performance issues or memory constraints.
**Evidence:** All tests use 1-4 nodes.
**Fix:** Add a test with ~1000 nodes to establish baseline behavior (not necessarily asserting timing, just that it completes).
**Verification:** `buildGraph(Array.from({ length: 1000 }, (_, i) => createNode({ id: `${i}.md` })))` completes.

### [LOW] Assertions don't verify node attributes aren't stored

**Location:** `tests/unit/graph/builder.test.ts:23-36`
**Problem:** Tests verify nodes exist but don't verify that node attributes (title, content, tags) aren't stored on the graph. The current implementation only stores node IDs, not full Node objects. This is correct for graphology usage but isn't explicitly tested.
**Evidence:**
```typescript
// Test only checks existence
expect(graph.hasNode('a.md')).toBe(true);
// Doesn't verify:
// expect(graph.getNodeAttributes('a.md')).toEqual({});
```
**Fix:** Add explicit assertion that graph nodes have no attributes (only structure is stored).
**Verification:** `expect(graph.getNodeAttributes('a.md')).toEqual({})` confirms no leakage.

## References

- [[Graph Test Coverage]] — Related coverage gaps (duplicate ID case documented there)
- [[roux-id-normalization-bug]] — ID case normalization issues elsewhere in codebase
