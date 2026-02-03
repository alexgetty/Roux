---
id: qO6SfVd7CvbL
tags:
  - spec
  - roux
status: draft
date created: 2026-02-02T00:00:00.000Z
---
# Roux Feature Requests

Feature requests generated from MCP server testing session (2026-02-02).

---

## 1. Ghost Nodes

**Status:** Spec written, handed off to Roux agent

**Problem:** Wikilinks to non-existent pages create dangling edges with raw filenames as IDs instead of proper nodes.

**Solution:** Create real nodes (with nanoids) for ghost pages. Content is null, but they're fully indexed and traversable.

See separate spec document for full details.

---

## 2. Get Local Graph

**Operation:** `get_local_graph(id, depth=2)`

**Returns:**
```json
{
  "nodes": [Node, Node, ...],
  "edges": [
    { "source": "id1", "target": "id2" },
    ...
  ]
}
```

**Use case:** Retrieve the full topology around a node for visualization or multi-hop traversal. Unlike `get_neighbors` (flat list, immediate links only), this returns structure across multiple hops.

**Parameters:**
- `id`: Starting node
- `depth`: How many hops to traverse (default 2)
- `direction`: `in`, `out`, `both` (default `both`)

---

## 3. Missing Link Suggestions

**Operation:** `suggest_links(id, limit=10)`

**Returns:** Nodes semantically similar to the input that aren't already linked.

**Use case:** Discovery engine. "This note is conceptually related to these other notes you haven't connected yet." Powers explicit link strengthening of the content graph.

**Implementation:** Filtered similarity search using existing embeddings, excluding current neighbors.

---

## 4. Exact Text Search

**Operation:** `search(query, mode="semantic" | "exact")`

**Use case:** Sometimes you need literal substring matching, not conceptual similarity. Find `"encode-transmit-decode"` exactly.

**Implementation:** Add `mode` parameter to existing search. Defaults to `semantic` (current behavior). `exact` uses full-text search.

---

## 5. Graph Stats

**Operation:** `get_stats()`

**Returns:**
```json
{
  "total_nodes": 436,
  "total_edges": 1842,
  "ghost_nodes": 23,
  "orphan_nodes": 12,
  "average_degree": 4.2,
  "most_connected": { "id": "...", "title": "...", "degree": 67 }
}
```

**Use case:** Vault health dashboard. Quick snapshot without multiple queries.

**Note:** Planned as part of Roux testing/health module.

---

## 6. Link Context

**Operation:** Optional parameter on `get_node`, `get_neighbors`, `get_local_graph`

**Parameter:** `include_link_context: boolean`

**Returns:** For each link, include the sentence or paragraph where it appears.

```json
{
  "id": "5OK8...",
  "title": "Wisdom",
  "context": "Knowledge becomes Wisdom when tempered by experience and reflection."
}
```

**Use case:** Understand *why* two notes are connected without reading full content.

---

## Already Planned (Confirmed)

These were suggested but already on the roadmap:

- **Orphan/Ghost filtering:** `list_nodes(ghost: include | only | exclude)` and similar for orphans
- **Health module:** Testing and graph health utilities

---

## Priority

If shipping incrementally:

1. **Ghost Nodes** — Fixes a data integrity issue
2. **Get Local Graph** — Unlocks graph traversal at scale
3. **Missing Link Suggestions** — Turns embeddings into a discovery engine
4. **Exact Text Search** — Low-hanging fruit, high utility
5. **Graph Stats** — Nice-to-have, probably comes with health module
6. **Link Context** — Useful but scope creep risk
