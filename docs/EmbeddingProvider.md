---
title: Embeddingprovider
---
# Embedding

Vector generation for semantic search.

## Overview

The Embedding interface transforms text into vectors that capture meaning. This enables similarity search: find nodes that are semantically related even if they share no keywords.

## Interface

See `src/types/provider.ts` for the current `Embedding` interface definition. See [[decisions/Search Ownership]] and [[decisions/Vector Storage]] for rationale.

Key methods: `embed()`, `embedBatch()`, `dimensions()`, `modelId()`.

**Note:** Embedding is **stateless**. It generates vectors only. Storage and search are handled by [[StoreProvider]].

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

## Role in Search

Embedding's only job is converting text to vectors. Search orchestration (query → embed → search → rank) is handled by [[GraphCore]].

## Storage

Embeddings are persisted by [[StoreProvider]], not Embedding. See [[decisions/Vector Storage]].

- Embedding generates vectors (stateless)
- Store persists vectors alongside node data
- Store handles similarity search via `searchByVector()`

This keeps Embedding trivial to implement and swap. Vector storage is the Store's responsibility.

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

- [[decisions/Default Embeddings]] — Why Transformers is the default
- [[decisions/Search Ownership]] — Search orchestration
- [[decisions/Vector Storage]] — Where embeddings are stored
- [[GraphCore]] — Coordinates embedding with store for search
- [[StoreProvider]] — Works alongside for semantic search
- [[Transformers]] — Default local implementation
- [[Ollama]] — Local implementation (external service)
- [[OpenAI]] — Cloud implementation
- [[Structural Embeddings]] — Research direction
