# GPI (Graph Programming Interface)

What Roux is. Like an API connects external systems to applications, a GPI connects you (human or machine) to graph-structured knowledge.

## Overview

GPI is the conceptual frame for everything Roux does. Every feature, every provider, every interface exists to serve one purpose: making graph-structured knowledge programmable.

**Core principle:** The graph is always the target structure. Data that isn't natively a graph gets transformed during ingestion. The query model stays constant regardless of source or storage.

## Why GPI?

Existing tools force a choice:
- **Graph databases** (Neo4j, FalkorDB) — Powerful but require infrastructure
- **Document tools** (Obsidian plugins) — No graph traversal, no semantic search
- **RAG frameworks** (LangChain) — No persistent graph, no co-authoring

GPI unifies these: start with human-editable files, scale to graph databases when needed—same interface throughout.

## What a GPI Provides

1. **Semantic search** — Find nodes by meaning, not just keywords
2. **Graph traversal** — Follow links, find paths, identify hubs
3. **CRUD operations** — Create, read, update, delete nodes programmatically
4. **Co-authoring** — Let AI assistants read and write knowledge alongside humans

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

## Related

- [[GraphCore]] — The hub that implements GPI
- [[MCP Server]] — Primary interface for AI co-authoring
- [[API]] — Programmatic access
- [[CLI]] — Terminal access
