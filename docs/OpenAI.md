# OpenAI

Cloud embedding and LLM provider. Implements both [[EmbeddingProvider]] and [[LLMProvider]].

## Overview

OpenAI provides state-of-the-art embeddings and language models via API. Higher quality than local models, but requires internet and has per-token costs.

## Capabilities

**Embeddings** ([[EmbeddingProvider]])
- Models: text-embedding-3-small, text-embedding-3-large, text-embedding-ada-002
- Dimensions: 256-3072 (configurable for v3 models)
- Quality: Best-in-class semantic similarity

**Text Generation** ([[LLMProvider]])
- Models: gpt-4o, gpt-4-turbo, gpt-3.5-turbo
- Context: 4K-128K depending on model
- Quality: Industry-leading

## Configuration

In `roux.yaml`:
```yaml
providers:
  embeddings:
    type: openai
    model: text-embedding-3-small
    # API key from environment: OPENAI_API_KEY

  llm:
    type: openai
    model: gpt-4o
```

## Why OpenAI

- **Quality**: Best embedding and generation quality
- **Reliability**: Consistent performance
- **No hardware**: Works on any machine
- **Latest models**: Access to newest capabilities

## Tradeoffs vs Ollama

| Aspect | OpenAI | Ollama |
|--------|--------|--------|
| Quality | Best | Good |
| Privacy | Data sent to API | Full local |
| Cost | Per-token | Hardware only |
| Reliability | High | Hardware-dependent |
| Offline | No | Yes |

## Cost Considerations

**Embeddings** (text-embedding-3-small):
- ~$0.02 per 1M tokens
- 1K documents ≈ 500K tokens ≈ $0.01

**Generation** (gpt-4o):
- ~$5 per 1M input tokens
- ~$15 per 1M output tokens

For personal knowledge bases, costs are minimal. For production at scale, budget carefully.

## Setup

```bash
# Set API key
export OPENAI_API_KEY=sk-...

# Or in .env file
OPENAI_API_KEY=sk-...
```

## Related

- [[EmbeddingProvider]] — Interface it implements
- [[LLMProvider]] — Interface it implements
- [[Ollama]] — Local alternative
