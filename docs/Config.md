# Configuration

Canonical schema for `roux.yaml`. Created by `roux init`, lives in project root. See [[Decision - CLI Workflow]] for init/serve relationship.

**MVP note:** MVP is zero-config. Only DocStore + transformers.js. `roux init` creates defaults with no prompts. Ollama/OpenAI embedding options are future.

## Full Schema

```yaml
# Source files
source:
  path: .                           # Directory to scan (relative to config file)
  include: ["*.md"]                 # Glob patterns to include
  exclude: []                       # Patterns to exclude (e.g., [".obsidian/*", ".git/*"])
  # Note: .roux/ is always excluded (hardcoded). Cannot be overridden.

# Cache location
cache:
  path: .roux/                      # SQLite cache directory

# System settings
system:
  on_model_change: lazy             # lazy | eager (see below)

# Provider configuration
providers:
  store:                            # REQUIRED - no store = no Roux
    type: docstore                  # docstore (MVP), neo4j, surrealdb, etc.
    # Type-specific options below

  embedding:                        # OPTIONAL - defaults to local (transformers.js)
    type: local                     # local | ollama | openai
    # Type-specific options below

  llm:                              # OPTIONAL - enables assisted features
    type: ollama                    # ollama | openai
    # Type-specific options below
```

## Provider-Specific Options

### DocStore (MVP)

```yaml
providers:
  store:
    type: docstore
    # No additional options - uses source.path
```

### Local Embedding (Default)

Uses [[Transformers|transformers.js]] with ONNX models. Zero external dependencies.

```yaml
providers:
  embedding:
    type: local
    model: Xenova/all-MiniLM-L6-v2   # Optional, this is default
```

**Note:** If `providers.embedding` is omitted entirely, `local` is used automatically. Semantic search works out of the box.

### Ollama Embedding (Future)

**Not MVP.** Will be added if transformers.js quality proves insufficient.

```yaml
providers:
  embedding:
    type: ollama
    model: nomic-embed-text         # Model name
    endpoint: http://localhost:11434  # Ollama API endpoint
    timeout: 30000                  # Request timeout (ms)
```

### OpenAI Embedding (Future)

**Not MVP.** Will be added if transformers.js quality proves insufficient.

```yaml
providers:
  embedding:
    type: openai
    model: text-embedding-3-small   # Model name
    # API key from OPENAI_API_KEY env var
    timeout: 30000                  # Request timeout (ms)
```

### Ollama LLM

```yaml
providers:
  llm:
    type: ollama
    model: llama3.2                 # Model name
    endpoint: http://localhost:11434
    timeout: 60000                  # LLM calls can be slow
```

### OpenAI LLM

```yaml
providers:
  llm:
    type: openai
    model: gpt-4o-mini
    timeout: 60000
```

## Field Reference

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `source.path` | No | `.` | Directory to scan |
| `source.include` | No | `["*.md"]` | File patterns to include |
| `source.exclude` | No | `[]` | File patterns to exclude |
| `cache.path` | No | `.roux/` | Cache directory |
| `system.on_model_change` | No | `lazy` | Embedding regeneration strategy |
| `providers.store` | **Yes** | - | Store configuration |
| `providers.store.type` | **Yes** | - | Store type identifier |
| `providers.embedding` | No | `local` | Embedding provider (defaults to transformers.js) |
| `providers.embedding.timeout` | No | `30000` | Timeout in ms |
| `providers.llm` | No | - | LLM provider |
| `providers.llm.timeout` | No | `60000` | Timeout in ms |

## on_model_change Behavior

See [[Decision - Vector Storage]].

| Mode | Behavior |
|------|----------|
| `lazy` (default) | New/updated nodes use new embedding model. Existing embeddings untouched. |
| `eager` | Model change triggers background re-embed of all nodes. |

**Manual override:** `roux sync --full` forces complete re-embed regardless of setting.

**Dimension mismatch:** If new embedding model has different dimensions than existing vectors, `roux serve` will warn and refuse to start. Run `roux sync --full` to regenerate all embeddings with the new model.

## Example Configurations

### Minimal (recommended)

```yaml
providers:
  store:
    type: docstore
```

Capabilities: CRUD, graph traversal, tag search, **semantic search** (via default local embeddings).

### With Ollama Embeddings

```yaml
providers:
  store:
    type: docstore
  embedding:
    type: ollama
    model: nomic-embed-text
```

Capabilities: Same as minimal, but with higher quality embeddings. Requires Ollama running.

### Full Stack

```yaml
source:
  path: ./docs
  include: ["*.md", "*.txt"]
  exclude: ["_drafts/*", "_templates/*"]

cache:
  path: .roux/

system:
  on_model_change: lazy

providers:
  store:
    type: docstore
  embedding:
    type: ollama
    model: nomic-embed-text
    endpoint: http://localhost:11434
  llm:
    type: ollama
    model: llama3.2
    endpoint: http://localhost:11434
```

Capabilities: All features including LLM-assisted tools.

## Validation

On `roux init` and `roux serve`:

1. Check `roux.yaml` exists (or create with defaults)
2. Validate required fields present (`providers.store.type`)
3. Validate provider types are recognized
4. Validate referenced paths exist
5. Test provider connectivity (can we reach Ollama? OpenAI API key valid?)

Startup fails fast on validation errors with clear messages.

## Environment Variables

Sensitive values should use environment variables:

| Variable | Used By | Purpose |
|----------|---------|---------|
| `OPENAI_API_KEY` | OpenAI providers | API authentication |

Future: Support `${ENV_VAR}` syntax in config values.

## Related

- [[CLI]] - Commands that use config
- [[Decision - CLI Workflow]] - init/serve relationship, config creation
- [[Decision - Provider Lifecycle]] - How providers are loaded
- [[Decision - Vector Storage]] - on_model_change rationale
- [[Decision - Default Embeddings]] - Why embedding defaults to local
