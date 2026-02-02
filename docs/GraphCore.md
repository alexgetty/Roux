---
id: Mj_KIxby9dUk
title: Graphcore
---
# GraphCore

The orchestration hub of Roux. Defines provider interfaces, routes requests, coordinates responses. Has zero functionality without providers.

## Overview

GraphCore is the invariant center of the [[GPI]]. It doesn't store data, generate embeddings, or perform any capability itself—it defines what it needs and delegates to providers.

Think of it as a switchboard: external interfaces call GraphCore, GraphCore routes to the appropriate provider(s), results flow back.

GraphCore is deliberately **schema-agnostic**—it stores whatever properties applications give it without validation. Domain-specific logic (task schemas, validation rules, business logic) belongs in the application layer, not here. See [[Library vs Application Boundaries]] for the full distinction.

## Responsibilities

- **Define provider interfaces** — The contracts that all providers of a type must fulfill
- **Route operations** — Direct requests to the appropriate provider
- **Coordinate multi-provider ops** — e.g., semantic search requires [[EmbeddingProvider]] + [[StoreProvider]]
- **Maintain consistent query model** — Same queries regardless of what's plugged in

## Interface

See `src/types/graphcore.ts` for the current interface definition. Key operations:

- **Provider registration** — `registerStore()`, `registerEmbedding()`
- **CRUD** — `search()`, `getNode()`, `createNode()`, `updateNode()`, `deleteNode()`
- **Graph** — `getNeighbors()`, `findPath()`, `getHubs()`
- **Discovery** — `searchByTags()`, `getRandomNode()`
- **Batch** — `listNodes()`, `resolveNodes()`

**GraphCore vs Store return types:** GraphCore returns enriched types (`Node`, `NodeWithContext`) while Store mutations return `void`. GraphCore hydrates responses by calling Store getters after mutations. This keeps Store simple (storage-focused) while GraphCore provides a richer API for external interfaces.

## Search Orchestration

See [[decisions/Search Ownership]].

GraphCore orchestrates semantic search by coordinating stateless providers: embed the query via [[EmbeddingProvider]], find nearest neighbors via Store's vector index, then hydrate full nodes.

## Configuration Spectrum

Minimal (personal knowledge base):
- GraphCore + [[StoreProvider]] + [[EmbeddingProvider]]

Full-featured (production system):
- GraphCore + all providers installed

## Design Decisions

- **Provider lifecycle**: See [[decisions/Provider Lifecycle]] — config-driven, dynamic capability exposure
- **Error handling**: See [[decisions/Error Contract]] — capability-based tool exposure, fail loudly on runtime errors

## Open Questions (Deferred)

- **GraphCore API stability**: Version when we have external consumers beyond MVP.

## Data Model Primitives

GraphCore defines the core data types that all modules share:

- [[Node]] — The entity model (documents, concepts, any discrete unit)
- [[Edge]] — Relationships between nodes (currently implicit, future: typed edges)

These are internal to GraphCore—not architectural components, but the language everything speaks.

## Related

- [[GPI]] — What GraphCore serves
- [[Library vs Application Boundaries]] — What belongs in Roux vs applications
- [[StoreProvider]] — Data persistence
- [[EmbeddingProvider]] — Vector generation
- [[MCP Server]] — Primary external interface
- [[decisions/Graphology Lifecycle]] — Graph construction and sync timing
