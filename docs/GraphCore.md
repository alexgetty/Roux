# GraphCore

The orchestration hub of Roux. Defines provider interfaces, routes requests, coordinates responses. Has zero functionality without providers.

## Overview

GraphCore is the invariant center of the [[GPI]]. It doesn't store data, generate embeddings, or perform any capability itself—it defines what it needs and delegates to providers.

Think of it as a switchboard: external interfaces call GraphCore, GraphCore routes to the appropriate provider(s), results flow back.

## Responsibilities

- **Define provider interfaces** — The contracts that all providers of a type must fulfill
- **Route operations** — Direct requests to the appropriate provider
- **Coordinate multi-provider ops** — e.g., semantic search requires [[EmbeddingProvider]] + [[StoreProvider]]
- **Maintain consistent query model** — Same queries regardless of what's plugged in

## Interface

```typescript
// Supporting types
interface SearchOptions {
  limit?: number;           // Max results (default: 10)
  threshold?: number;       // Min similarity score (0-1)
  tags?: string[];          // Filter by tags
}

interface NodeWithContext extends Node {
  neighbors?: Node[];       // Adjacent nodes (when depth > 0)
  incomingCount?: number;   // Number of nodes linking TO this node
  outgoingCount?: number;   // Number of nodes this links TO
}

// Core interface
interface GraphCore {
  // Provider registration
  registerStore(provider: StoreProvider): void;
  registerEmbedding(provider: EmbeddingProvider): void;
  registerLLM(provider: LLMProvider): void;
  // ... other providers

  // Unified operations (delegates to providers)
  search(query: string, options?: SearchOptions): Promise<Node[]>;
  getNode(id: string, depth?: number): Promise<NodeWithContext | null>;
  createNode(node: Partial<Node>): Promise<Node>;
  updateNode(id: string, updates: Partial<Node>): Promise<Node>;
  deleteNode(id: string): Promise<boolean>;

  // Graph operations
  getNeighbors(id: string, options: NeighborOptions): Promise<Node[]>;
  findPath(source: string, target: string): Promise<string[] | null>;
  getHubs(metric: Metric, limit: number): Promise<Array<[string, number]>>;
}
```

**GraphCore vs StoreProvider return types:** GraphCore returns enriched types (`Node`, `NodeWithContext`) while StoreProvider mutations return `void`. GraphCore hydrates responses by calling StoreProvider getters after mutations. This keeps StoreProvider simple (storage-focused) while GraphCore provides a richer API for external interfaces.

## Search Orchestration

See [[Decision - Search Ownership]].

GraphCore orchestrates semantic search by coordinating stateless providers:

```typescript
async search(query: string, limit: number): Promise<Node[]> {
  // 1. Generate query vector (stateless EmbeddingProvider)
  const vector = await this.embedding.embed(query);

  // 2. Find nearest neighbors (StoreProvider owns vector index)
  const results = await this.store.searchByVector(vector, limit);

  // 3. Hydrate full nodes
  return this.store.getNodes(results.map(r => r.id));
}
```

## Configuration Spectrum

Minimal (personal knowledge base):
- GraphCore + [[StoreProvider]] + [[EmbeddingProvider]]

Full-featured (production system):
- GraphCore + all providers installed

## Design Decisions

- **Provider lifecycle**: See [[Decision - Provider Lifecycle]] — config-driven, dynamic capability exposure
- **Error handling**: See [[Decision - Error Contract]] — capability-based tool exposure, fail loudly on runtime errors

## Open Questions (Deferred)

- **GraphCore API stability**: Version when we have external consumers beyond MVP.

## Data Model Primitives

GraphCore defines the core data types that all modules share:

- [[Node]] — The entity model (documents, concepts, any discrete unit)
- [[Edge]] — Relationships between nodes (currently implicit, future: typed edges)

These are internal to GraphCore—not architectural components, but the language everything speaks.

## Related

- [[GPI]] — What GraphCore serves
- [[StoreProvider]] — Data persistence
- [[EmbeddingProvider]] — Vector generation
- [[LLMProvider]] — Text generation
- [[MCP Server]] — Primary external interface
