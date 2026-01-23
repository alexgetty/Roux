# Node

The canonical data model. All modules speak Node.

## Overview

A Node represents a single piece of knowledge in the graph—a document, concept, entity, or any discrete unit. Every provider that touches data must understand and produce Nodes.

Format conversion happens at store boundaries only. Internally, everything is a Node.

## Interface

```typescript
interface Node {
  id: string;                        // Canonical identifier (portable across stores)
  title: string;                     // Display name
  content: string;                   // Full text content
  tags: string[];                    // Classification
  outgoingLinks: string[];           // Edges to other nodes (by id)
  properties: Record<string, any>;   // Extensible metadata
  sourceRef?: SourceRef;             // Origin tracking
}

interface SourceRef {
  type: 'file' | 'api' | 'manual';   // Where it came from
  path?: string;                     // File path if applicable
  lastModified?: Date;               // Last known modification
}
```

## Node Identity

See [[Decision - Node Identity]] for full rationale.

`Node.id` is the **canonical, portable identifier**. It must:
- Survive migration between any two stores unchanged
- Be valid as a string in all target stores (Neo4j, SurrealDB, etc.)
- Be the stable reference for all edges (`outgoingLinks`)

**ID Resolution Order:**
1. Frontmatter `id` field (if present)
2. Derived from source (e.g., filename in DocStore)

**MVP:** IDs derived from filename, Obsidian-compatible. Case-insensitive matching.

**Store-agnostic:** Each StoreProvider maps canonical IDs to native storage. Internal/auto-generated IDs (e.g., Neo4j numeric IDs) are never exposed.

## Design Decisions

**Why `outgoingLinks` not `edges`?**
Edges are directional. A Node knows what it links *to*, not what links to it. Bidirectional queries are the StoreProvider's job.

**Why `properties` as a bag?**
Different use cases need different metadata. A document node might have `wordCount`, a person node might have `birthDate`. The bag allows extension without schema changes.

**Why `sourceRef`?**
Nodes can come from files, APIs, or manual creation. Tracking origin enables sync logic (has the source changed?) and debugging (where did this come from?).

## Open Questions (Deferred)

- **Edge Properties**: See [[Decision - Edge Futureproofing]]. MVP uses simple links.
- **Node Versioning**: Not MVP. Last write wins. Track history in future phases.
- **Soft Deletes**: Hard delete for MVP. Revisit when versioning is addressed.
- **Schema Evolution**: Address when Node interface actually changes. Premature to solve now.

## Related

- [[GraphCore]] — Operates on Nodes
- [[Edge]] — The relationship model (complements Node)
- [[StoreProvider]] — Persists and retrieves Nodes
- [[Wiki-links]] — How links become `outgoingLinks`
- [[Graph Projection]] — Inferring Nodes from flat files
