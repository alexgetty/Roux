# Decision - Graphology Lifecycle

**Status:** Decided
**Affects:** [[DocStore]], [[GraphCore]], [[StoreProvider]]

## Problem

DocStore uses graphology for in-memory graph operations (path finding, centrality, neighbor queries). But the lifecycle is undefined:

- When is the graph built?
- Is it persisted or rebuilt on every startup?
- How is it kept in sync with file changes?
- What's the memory footprint at scale?

This is the core of graph operations. Can't be vague.

## Options

### Graph Construction Timing

#### Option A: Build on startup from SQLite ✓ SELECTED

```
serve startup:
  1. Load all nodes from SQLite cache
  2. Build graphology graph in memory
  3. Ready to serve
```

**Pros:** Fast startup (SQLite is fast). Graph always matches cache.
**Cons:** Startup latency scales with node count. Memory usage scales with node count.

**Decision:** SQLite is already the cache. Loading from it is fast and simple.

#### Option B: Build on startup from files

```
serve startup:
  1. Scan directory
  2. Parse all files
  3. Build graphology graph
  4. Sync to SQLite cache
  5. Ready to serve
```

**Pros:** Files are source of truth. No cache staleness concerns.
**Cons:** Slow startup (file I/O + parsing). Redundant with `init`.

#### Option C: Lazy construction

```
serve startup:
  1. Load node metadata (no content) from SQLite
  2. Build minimal graph structure
  3. Ready to serve (fast)

on graph query:
  1. If graph not fully loaded, load remaining data
```

**Pros:** Fast startup. Memory efficient for large graphs with few queries.
**Cons:** First query is slow. Complexity.

### File Change Sync

#### Option A: Rebuild affected subgraph

```
file changed:
  1. Re-parse file
  2. Update node in SQLite
  3. Update node in graphology
  4. Update edges (remove old, add new)
  5. Invalidate centrality cache
```

**Pros:** Minimal work. Fast sync.
**Cons:** Edge updates are tricky (need to track what changed).

#### Option B: Full graph rebuild

```
file changed:
  1. Re-parse file
  2. Update SQLite
  3. Rebuild entire graphology graph from SQLite
```

**Pros:** Simple. No sync bugs. Consistent.
**Cons:** O(n) on every file change. Doesn't scale.

#### Option C: Incremental with debounce ✓ SELECTED

```
file changed:
  1. Queue change
  2. After 100ms debounce, process queue
  3. Batch update SQLite
  4. Batch update graphology
  5. Recompute centrality (piggybacked)
```

**Pros:** Handles rapid changes (autosave). Efficient batching.
**Cons:** 100ms delay before changes visible. More state to manage.

**Decision:** Autosave editors spam file changes. Debouncing prevents thrashing. 100ms is imperceptible. Centrality recomputation piggybacked onto same sync process (see below).

### Centrality Computation

#### Option A: Compute on startup, cache indefinitely

```
startup:
  1. Compute PageRank for all nodes
  2. Store in centrality table
  3. Never recompute

get_hubs:
  1. Read from cache
```

**Pros:** Fast hub queries. Simple.
**Cons:** Stale after any graph change. Wrong results.

#### Option B: Compute on demand, cache until invalidated

```
file changed:
  1. Mark centrality cache as stale

get_hubs:
  1. If stale, recompute PageRank
  2. Cache results
  3. Return from cache
```

**Pros:** Always correct. Lazy computation.
**Cons:** First hub query after changes is slow. Unpredictable latency.

#### Option C: Background recomputation

```
file changed:
  1. Mark centrality as stale
  2. Queue background recompute (low priority)

get_hubs:
  1. Return cached (possibly stale) with staleness indicator
  -- OR --
  1. Wait for recompute if in progress
```

**Pros:** Responsive queries. Eventually consistent.
**Cons:** Stale results possible. Complex scheduling.

#### Option D: Piggyback on file sync ✓ SELECTED

```
file changed:
  1. Queue change
  2. After 100ms debounce, process queue:
     - Update SQLite
     - Update graphology
     - Recompute centrality
  3. Done. Everything fresh.

get_hubs:
  1. Read from cache (always current)
```

**Pros:** Always correct. Fast queries. Single sync process. No stale flags or background jobs.
**Cons:** Sync takes slightly longer (centrality computation added).

**Decision:** Keep all update logic together. Centrality recomputation (~10ms at 500 nodes for PageRank, O(1) for in_degree) is absorbed into the debounced sync. No separate processes to track.

## Considerations

- 500 nodes: graphology graph is ~few MB. Startup from SQLite: <100ms.
- 10K nodes: graphology graph is ~50-100MB. Startup: 1-2s.
- PageRank on 500 nodes: ~10ms. On 10K nodes: ~500ms.
- Autosave editors trigger changes every 1-5 seconds
- Users expect <1s sync latency per MVP success criteria

## Questions to Resolve

1. ~~What's acceptable startup latency at 500, 1000, 5000 nodes?~~ Deferred to real measurement. SQLite load is fast enough for MVP.
2. ~~Should centrality results be allowed to be stale?~~ No. Recompute during sync.
3. ~~Is 100ms debounce acceptable for file sync?~~ Yes. Imperceptible to humans, prevents thrashing.
4. ~~Should we show progress during startup for large graphs?~~ Deferred. Not blocking MVP.

## Decision

| Sub-decision | Choice | Rationale |
|--------------|--------|-----------|
| Graph Construction | Build from SQLite on startup | SQLite is the cache. Fast and simple. |
| File Change Sync | Debounced incremental (100ms) | Handles autosave spam. Batch updates cleaner than individual edge diffs. |
| Centrality Computation | Piggyback on sync | Single update process. Always correct. No stale flags or background jobs. |

## Outcome

Decided. The graphology lifecycle is:

1. **Startup:** Load nodes/edges from SQLite → build graphology graph → ready
2. **File change:** Queue change → debounce 100ms → batch update SQLite + graphology + centrality → done
3. **Query:** Read from in-memory graph (always current after last sync)

## Related

- [[Decisions]] — Decision hub
- [[DocStore]] — Where this lives
- [[StoreProvider]] — Interface for graph ops
