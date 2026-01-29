---
type: Feature
status: Proposed
priority: P3
effort: XL
phase: Future
category: Storage & Providers
---

# Feature - Alternative Stores

Additional StoreProvider implementations beyond DocStore.

## Summary

Implement StoreProvider for native graph databases.

## Candidates

| Store | Type | Strengths |
|-------|------|-----------|
| Neo4j | Graph DB | Cypher queries, mature ecosystem |
| SurrealDB | Multi-model | Graph + document + vector in one |
| FalkorDB | Graph DB | Redis-compatible, fast |
| ArangoDB | Multi-model | Graph + document, flexible |

## Implementation Pattern

Each store implements StoreProvider interface:
```typescript
class Neo4jStore implements StoreProvider {
  createNode(node: Node): Promise<void>;
  getNeighbors(id: string, options: NeighborOptions): Promise<Node[]>;
  searchByVector(vector: number[], limit: number): Promise<VectorSearchResult[]>;
  // ... etc
}
```

## Benefits

- **Native graph ops:** Real graph traversal, not simulated
- **Scale:** Handle millions of nodes
- **Query flexibility:** Cypher, GQL, etc.

## Challenges

- **ID mapping:** Store-specific ID formats
- **Feature parity:** Not all stores have all features
- **Testing:** Need store-specific test infrastructure

## Complexity

High per store — each is a significant implementation effort.

## References

- [[StoreProvider]] — Interface definition
- [[Neo4j]], [[SurrealDB]], [[FalkorDB]], [[ArangoDB]] — Store-specific docs
- [[MVP#Out of Scope]] — Other stores listed
