---
title: Gpi
---
# GPI (Graph Programming Interface)

What Roux is. Like an API connects external systems to applications, a GPI connects you (human or machine) to graph-structured knowledge.

## The Thesis

Knowledge is fundamentally relational. Ideas connect to other ideas. Documents reference other documents. Concepts build on concepts. Yet most knowledge tools treat content as isolated documents searchable only by keywords.

Graph databases understand relationships but require infrastructure and expertise. Document tools like Obsidian enable linking but offer no programmatic access. RAG frameworks add semantic search but lose the graph structure entirely.

A GPI bridges these worlds: make graph-structured knowledge programmable, queryable, and accessible to both humans and AI—regardless of how it's stored.

## What Makes This Different

**It's not just "a graph database with an API."**

A GPI is defined by four commitments:

1. **Graph as the canonical structure** — Data that isn't natively a graph gets transformed into one during ingestion. A markdown file with wiki-links becomes nodes and edges. The underlying format is an implementation detail.

2. **Semantic understanding built in** — Nodes aren't just searchable by keywords. Embedding providers enable "find notes about distributed systems" even when those words don't appear.

3. **Human-editable sources** — Unlike graph databases that require specialized tools, a GPI can operate on formats humans already use (markdown, text, eventually more). No lock-in.

4. **AI co-authoring as a first-class operation** — The interface assumes AI agents will read and write knowledge alongside humans. MCP isn't an afterthought—it's a primary interface.

## What a GPI Provides

- **Semantic search** — Find nodes by meaning, not just keywords
- **Graph traversal** — Follow links, find paths, identify hubs
- **CRUD operations** — Create, read, update, delete nodes programmatically
- **Co-authoring** — Let AI assistants read and write knowledge alongside humans

## The Stack

```
┌─────────────────────────────┐
│     External Interfaces     │  ← How you access the GPI
│   MCP Server, API, CLI      │
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│          GraphCore          │  ← The GPI hub
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│          Providers          │  ← Capabilities
│  Store, Embedding, LLM...   │
└─────────────────────────────┘
```

GraphCore is the invariant center. It defines interfaces but has zero capabilities without providers. This enables configurations from "point at a folder" to "production-scale graph database"—same queries, same results.

## Why Now?

Large language models changed the game. Suddenly:
- AI can traverse and reason about knowledge graphs
- AI can co-author content in human-readable formats
- AI can extract structure from unstructured text
- Products differentiate by how well they manage knowledge

We're building infrastructure for this new reality.

## Related

- [[GraphCore]] — The hub that implements GPI
- [[MCP Server]] — Primary interface for AI co-authoring
- [[API]] — Programmatic access
- [[CLI]] — Terminal access
