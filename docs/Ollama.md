# Ollama

Local embedding and LLM provider. Implements both [[EmbeddingProvider]] and [[LLMProvider]].

## Overview

Ollama runs AI models locally. No data leaves your machine, no API costs, works offline. The default provider for Roux.

## Capabilities

**Embeddings** ([[EmbeddingProvider]])
- Models: nomic-embed-text, all-minilm, mxbai-embed-large
- Dimensions: 384-1024 depending on model
- Speed: Fast on modern hardware

**Text Generation** ([[LLMProvider]])
- Models: llama3.2, mistral, phi3, gemma
- Context: 2K-128K depending on model
- Speed: Depends on GPU/CPU

## Configuration

In `roux.yaml`:
```yaml
providers:
  embedding:
    type: ollama
    model: nomic-embed-text
    endpoint: http://localhost:11434

  llm:
    type: ollama
    model: llama3.2
    endpoint: http://localhost:11434
```

## Why Ollama

- **Privacy**: Data stays local
- **Cost**: No API fees
- **Offline**: Works without internet
- **Control**: Run what you want

## Tradeoffs vs Cloud

| Aspect | Ollama | OpenAI |
|--------|--------|--------|
| Privacy | Full | Data sent to API |
| Cost | Hardware only | Per-token |
| Quality | Good | Best (for now) |
| Speed | Hardware-dependent | Consistent |
| Offline | Yes | No |

## Hardware Requirements

**Minimum** (CPU inference):
- 8GB RAM
- Modern CPU
- Slow but works

**Recommended** (GPU inference):
- 16GB+ RAM
- NVIDIA GPU with 8GB+ VRAM
- Fast inference

## Setup

```bash
# Install
curl -fsSL https://ollama.com/install.sh | sh

# Pull models
ollama pull nomic-embed-text
ollama pull llama3.2

# Verify
ollama list
```

## Related

- [[EmbeddingProvider]] — Interface it implements
- [[LLMProvider]] — Interface it implements
- [[OpenAI]] — Cloud alternative
- [[Structural Embeddings]] — Research direction
