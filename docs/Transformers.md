---
title: Transformers
---
# Transformers.js

Local embedding provider using ONNX models via transformers.js. Zero external dependencies. Default fallback when no embedding provider is configured.

## Overview

Transformers.js runs transformer models directly in Node.js using ONNX runtime. No Python, no external services. Models download automatically on first use.

## Why Default

| Criteria | Transformers.js | Ollama | OpenAI |
|----------|-----------------|--------|--------|
| Install friction | Zero (npm) | Medium (separate install) | API key required |
| External deps | None | Ollama service | Internet + API |
| First-run cost | Model download (~90MB) | Model download | None |
| Inference speed | Good | Better | Best (but latency) |
| Model quality | Good (MiniLM) | Excellent | Excellent |
| Offline capable | Yes | Yes | No |

For MVP scale (hundreds to low thousands of docs), Transformers.js is fast enough and removes all setup friction.

## Interface

Implements the `Embedding` interface (see `src/types/provider.ts`). The implementation class is `TransformersEmbedding` in `src/providers/embedding/transformers.ts`.

Key methods: `embed()`, `embedBatch()`, `dimensions()`, `modelId()`.

## Default Model

**Xenova/all-MiniLM-L6-v2**
- 384 dimensions
- ~90MB download
- Good general-purpose semantic similarity
- Fast inference

Other models available via config. See [Xenova's Hugging Face](https://huggingface.co/Xenova) for compatible models.

## Configuration

**Implicit (recommended for MVP):**
```yaml
providers:
  store:
    type: docstore
  # No embedding block - uses transformers.js automatically
```

**Explicit:**
```yaml
providers:
  embedding:
    type: local
    model: Xenova/all-MiniLM-L6-v2   # optional, this is default
```

## First Run Behavior

Model downloads automatically on first embedding request (~90MB). Cached in `~/.cache/transformers/` (or platform equivalent). Subsequent runs skip download.

## When to Upgrade

Consider switching to [[Ollama]] or [[OpenAI]] when:
- You need higher quality embeddings (nomic-embed-text, text-embedding-3-large)
- Batch processing of thousands of documents (Ollama is faster)
- You're already running Ollama for LLM features

The switch is config-only. No code changes.

## Related

- [[decisions/Default Embeddings]] — Why this is the default
- [[EmbeddingProvider]] — Interface this implements
- [[Ollama]] — Alternative for better models
- [[OpenAI]] — Alternative for cloud-based
- [[Config]] — Configuration options
