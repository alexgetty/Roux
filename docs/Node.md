---
title: Node
---
# Node

The canonical data model. All modules speak Node.

## Overview

A Node represents a single piece of knowledge in the graph—a document, concept, entity, or any discrete unit. Every provider that touches data must understand and produce Nodes.

Format conversion happens at store boundaries only. Internally, everything is a Node.

## Interface

See `src/types/node.ts` for the current interface definition. Key fields:

- `id` — Canonical identifier (store-specific format)
- `title` — Display name
- `content` — Full text content
- `tags` — Classification array
- `outgoingLinks` — Edges to other nodes (by id)
- `properties` — Extensible metadata (`Record<string, unknown>`)
- `sourceRef` — Optional origin tracking (file path, last modified, etc.)

## Node Identity

`Node.id` is the **canonical identifier within a StoreProvider**. Each store uses IDs optimized for its context. See specific store docs for ID format and generation rules:

- [[DocStore]] — File path-based IDs, Obsidian-compatible
- Neo4j (future) — Neo4j-native conventions

IDs are not portable across stores. Migration tooling handles ID translation and link rewriting.

## Design Decisions

**Why `outgoingLinks` not `edges`?**
Edges are directional. A Node knows what it links *to*, not what links to it. Bidirectional queries are the Store's job.

**Note on MCP responses:** When nodes are returned via MCP, `outgoingLinks` (IDs) are enriched to `links` (ID + title pairs) using `Store.resolveTitles()`. This provides semantic context for LLM reasoning. See [[MCP Tools Schema]] for response formats.

**Why `properties` as a bag?**
Different use cases need different metadata. A document node might have `wordCount`, a person node might have `birthDate`. The bag allows extension without schema changes.

**Reserved names:**
`id`, `title`, and `tags` are reserved—they map to dedicated Node fields and never appear in `properties`. When stores parse source data:

| Field | Behavior | In properties? |
|-------|----------|----------------|
| `id` | Maps to Node.id | No |
| `title` | Maps to Node.title | No |
| `tags` | Maps to Node.tags | No |
| anything else | Passed through | Yes |

Reserved names are never duplicated into `properties`.

**Why `sourceRef`?**
Nodes can come from files, APIs, or manual creation. Tracking origin enables sync logic (has the source changed?) and debugging (where did this come from?).

## Open Questions (Deferred)

- **Edge Properties**: See [[decisions/Edge Futureproofing]]. MVP uses simple links.
- **Node Versioning**: Not MVP. Last write wins. Track history in future phases.
- **Soft Deletes**: Hard delete for MVP. Revisit when versioning is addressed.
- **Schema Evolution**: Address when Node interface actually changes. Premature to solve now.

## Related

- [[GraphCore]] — Operates on Nodes
- [[Edge]] — The relationship model (complements Node)
- [[StoreProvider]] — Persists and retrieves Nodes
- [[Wiki-links]] — How links become `outgoingLinks`
- [[Graph Projection]] — Inferring Nodes from flat files
