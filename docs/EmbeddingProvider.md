# EmbeddingProvider

Vector generation for semantic search.

## Overview

EmbeddingProvider transforms text into vectors that capture meaning. This enables similarity search: find nodes that are semantically related even if they share no keywords.

## Interface

See [[Decision - Search Ownership]] and [[Decision - Vector Storage]] for rationale.

```typescript
interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  dimensions(): number;   // Vector dimensions for storage allocation
  modelId(): string;      // For tracking which model generated vectors
}
```

**Note:** EmbeddingProvider is **stateless**. It generates vectors only. Storage and search are handled by [[StoreProvider]].

## Implementations

**Local (zero config)**
- [[Transformers]] — Default. ONNX models via transformers.js. No external dependencies.

**Local (external service)**
- [[Ollama]] — Better models, faster batch processing. Requires Ollama installed.

**Cloud**
- [[OpenAI]] — High quality, API costs

**Research**
- [[Structural Embeddings]] — Graph-aware vectors (experimental)

## Default Behavior

If no embedding provider is configured, the system uses [[Transformers]] automatically. This enables semantic search out of the box with zero setup.

```yaml
# Embeddings just work - uses transformers.js
providers:
  store:
    type: docstore
```

## How Semantic Search Works

1. User queries: "notes about distributed systems"
2. EmbeddingProvider converts query to vector
3. Vector similarity search finds nearest neighbors
4. Results ranked by distance, returned as Nodes

## Storage

Embeddings are persisted by [[StoreProvider]], not EmbeddingProvider. See [[Decision - Vector Storage]].

- EmbeddingProvider generates vectors (stateless)
- StoreProvider stores vectors alongside node data
- StoreProvider handles similarity search via `searchByVector()`

This keeps EmbeddingProvider trivial to implement and swap. Vector storage is the Store's responsibility.

**Provider swap behavior** (system-level `on_model_change` setting):
- `lazy` (default): New/updated nodes use new provider. Old embeddings untouched.
- `eager`: Model change triggers background re-embed of all nodes.

Manual override: `roux sync --full` forces complete re-embed regardless of setting.

## Open Questions (Deferred — Research Phase)

These are [[Structural Embeddings]] research questions, not MVP blockers:

- **Embedding Composition**: How to combine content + structure vectors. Phase 1 research.
- **Incremental Structure Updates**: Recomputation strategy. Phase 1 research.
- **Dimensionality**: Model-dependent. Use provider defaults for MVP.
- **Chunking Strategy**: Embed whole doc for MVP. Chunking is future optimization.

## Related

- [[Decision - Default Embeddings]] — Why Transformers is the default
- [[Decision - Search Ownership]] — Search orchestration
- [[Decision - Vector Storage]] — Where embeddings are stored
- [[GraphCore]] — Coordinates embedding with store for search
- [[StoreProvider]] — Works alongside for semantic search
- [[Transformers]] — Default local implementation
- [[Ollama]] — Local implementation (external service)
- [[OpenAI]] — Cloud implementation
- [[Structural Embeddings]] — Research direction
