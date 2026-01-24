# Decision - Default Embeddings

**Status:** Decided
**Affects:** [[EmbeddingProvider]], [[Config]], [[MVP]]

## Problem

EmbeddingProvider enables semantic search, but the original design required explicit configuration:

```yaml
providers:
  embedding:
    type: ollama
    model: nomic-embed-text
```

This creates friction:
- User must install and run Ollama before Roux works
- Or configure OpenAI API key
- Semantic search—a core feature—requires extra setup

How do we make semantic search work out of the box?

## Options

### Option A: Require explicit configuration

Status quo. User must configure an embedding provider or semantic search is unavailable.

**Pros:** Explicit. No magic. User knows what they're getting.
**Cons:** Friction. Core feature requires setup. Bad first-run experience.

### Option B: Ollama as default, fail gracefully

Default to Ollama. If not running, disable semantic search silently.

**Pros:** Works for users who have Ollama.
**Cons:** Silent failure is confusing. "Why doesn't search work?"

### Option C: Python subprocess with sentence-transformers

Spawn Python process for embeddings. Use sentence-transformers library.

**Pros:** High quality models. Rich ecosystem.
**Cons:** Two runtimes. User needs Python installed. Packaging complexity.

### Option D: transformers.js as default fallback

Use transformers.js (ONNX models in Node.js) when no provider configured. Zero external dependencies.

**Pros:**
- Zero config—semantic search just works
- No external services
- No Python
- Models download automatically
- Pure npm install

**Cons:**
- Slower than Ollama for large batches
- Smaller model selection
- First run downloads ~90MB model

## Considerations

- MVP scale (hundreds to low thousands of docs) doesn't need fastest inference
- First-run experience matters more than batch performance
- Users who need better quality can upgrade to Ollama/OpenAI
- transformers.js ecosystem is maturing rapidly
- Provider interface means the default is swappable without code changes

## Decision

**Option D: transformers.js as default fallback**

## Outcome

### Architecture

```
Config specifies embedding provider?
    │
    ├─► Yes → Use configured provider (ollama, openai, etc.)
    │
    └─► No → Use TransformersEmbeddingProvider (local)
```

The fallback logic lives in the **config/bootstrap layer**, not the provider:

```typescript
function resolveEmbeddingProvider(config: Config): EmbeddingProvider {
  if (config.providers?.embedding) {
    return createProvider(config.providers.embedding);
  }
  return new TransformersEmbeddingProvider();
}
```

### Provider Implementation

TransformersEmbeddingProvider is a full [[EmbeddingProvider]] implementation:

```typescript
class TransformersEmbeddingProvider implements EmbeddingProvider {
  async embed(text: string): Promise<number[]>;
  async embedBatch(texts: string[]): Promise<number[][]>;
  dimensions(): number;   // 384 for default model
  modelId(): string;      // "Xenova/all-MiniLM-L6-v2"
}
```

It doesn't know it's a fallback. Just another provider.

### Default Model

**Xenova/all-MiniLM-L6-v2**
- 384 dimensions
- ~90MB download
- Good general-purpose semantic similarity

### Configuration

**Implicit (zero config):**
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
    model: Xenova/all-MiniLM-L6-v2
```

### First Run Behavior

Model downloads on first `roux init`:

```
$ roux init .
Downloading embedding model (first run only)... 92MB
Scanning files... 147 documents
Generating embeddings... done
```

### Upgrade Path

Users can switch to Ollama or OpenAI anytime via config. No code changes. The [[decisions/Vector Storage]] `on_model_change` setting handles the transition.

### Rationale

1. **Zero friction MVP** — `npm install -g roux && roux init .` gives full semantic search
2. **No external dependencies** — Works offline, no services to manage
3. **Clean architecture** — Default is just another provider, not special-cased
4. **Reversible** — Easy upgrade to better providers when needed
5. **Honest tradeoff** — Slightly slower inference in exchange for zero setup

## Related

- [[Decisions]] — Decision hub
- [[Transformers]] — Implementation details
- [[EmbeddingProvider]] — Interface definition
- [[Config]] — Configuration schema
- [[decisions/Vector Storage]] — Model change handling
