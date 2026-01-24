# Decision - Performance Thresholds

**Status:** Deferred
**Affects:** [[MVP]], [[DocStore]], [[StoreProvider]]

**Deferred rationale:** MVP is about getting it working, not getting it working efficiently at scale. Specific thresholds will be defined based on real measurements after MVP ships.

## Problem

MVP success criteria includes:
- "Works on directory with 500+ nodes without degraded performance"
- "Changes reflected in queries within 1 second"

"Degraded performance" is undefined. We need measurable thresholds to know when MVP is complete and to guide implementation tradeoffs.

## Dimensions to Define

### Startup Time (`roux init`, `roux serve`)

How long can initialization take before it's unacceptable?

| Nodes | Acceptable | Stretch |
|-------|------------|---------|
| 100   | ?          | ?       |
| 500   | ?          | ?       |
| 1000  | ?          | ?       |
| 5000  | ?          | ?       |

Considerations:
- First-time init includes embedding generation (~100-500ms per doc with local models)
- Subsequent serve startup only loads cache
- Progress indication changes perception

### Query Latency

How fast should operations complete?

| Operation | Acceptable | Notes |
|-----------|------------|-------|
| `get_node` | ? | Single node fetch |
| `search` | ? | Semantic search, top 10 |
| `get_neighbors` | ? | Direct links |
| `find_path` | ? | BFS shortest path |
| `get_hubs` | ? | Centrality query |
| `create_node` | ? | Write + embed |
| `update_node` | ? | Write + re-embed |

### File Sync Latency

Already defined: <1 second from file save to query visibility.

### Memory Usage

What's acceptable RAM consumption?

| Nodes | Acceptable | Notes |
|-------|------------|-------|
| 100   | ?          |       |
| 500   | ?          |       |
| 1000  | ?          |       |
| 5000  | ?          |       |

Considerations:
- In-memory graphology graph
- SQLite cache (mostly on disk)
- Embedding model loaded (transformers.js)
- Should run on laptop without noticeable impact

## Proposed Thresholds

### Startup (cold, includes embedding generation)

| Nodes | Target | Maximum |
|-------|--------|---------|
| 100   | 10s    | 30s     |
| 500   | 45s    | 2min    |
| 1000  | 90s    | 4min    |

With progress indication, users tolerate longer waits.

### Startup (warm, cache exists)

| Nodes | Target | Maximum |
|-------|--------|---------|
| 100   | 500ms  | 2s      |
| 500   | 1s     | 5s      |
| 1000  | 2s     | 10s     |

### Query Latency (at 500 nodes)

| Operation | Target | Maximum |
|-----------|--------|---------|
| `get_node` | 10ms | 50ms |
| `search` (top 10) | 100ms | 500ms |
| `get_neighbors` | 20ms | 100ms |
| `find_path` | 50ms | 200ms |
| `get_hubs` | 50ms | 200ms |
| `create_node` | 500ms | 2s |
| `update_node` | 500ms | 2s |

Write operations include embedding generation, hence higher latency.

### Memory (steady state, after startup)

| Nodes | Target | Maximum |
|-------|--------|---------|
| 100   | 100MB  | 200MB   |
| 500   | 200MB  | 400MB   |
| 1000  | 300MB  | 600MB   |

Includes transformers.js model (~90MB baseline).

## Scale Boundaries

At what point do we warn users?

| Metric | Warning | Hard limit |
|--------|---------|------------|
| File count | 1000 | 10000 |
| Single file size | 100KB | 1MB |
| Total content size | 50MB | 500MB |

Warning: "Large directory detected. Initialization may be slow."
Hard limit: "Directory exceeds MVP limits. Consider upgrading to Neo4j store."

## Questions to Resolve

1. Are these thresholds reasonable for personal knowledge base use case?
2. Should hard limits exist, or just warnings?
3. How do we test/benchmark these consistently?
4. Should thresholds be documented to users or internal only?

## Decision

[Pending]

## Outcome

[Pending]

## Related

- [[Decisions]] — Decision hub
- [[MVP]] — Success criteria
- [[DocStore]] — Implementation that must meet these
