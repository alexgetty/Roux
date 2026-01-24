# Decision - Provider Lifecycle

**Status:** Decided
**Affects:** [[GraphCore]]

## Problem

GraphCore open questions include:
- "Should providers self-register or be explicitly configured?"
- No defined initialization order
- No concept of required vs optional providers
- No health checks or readiness signals

How does Roux start up? How does it know it's ready to serve?

## Options

### Option A: Explicit registration, fail if missing required

```typescript
const core = new GraphCore();
core.registerStore(new DocStore(config));      // Required - throws if not called
core.registerEmbedding(new OllamaEmbedding()); // Required for search
await core.initialize();                        // Validates, connects, ready
```

**Pros:** Explicit. Clear what's configured. Fail fast on misconfiguration.
**Cons:** Verbose setup. User must know what's required.

### Option B: Config-driven with auto-instantiation

```typescript
const core = await GraphCore.fromConfig({
  store: { type: 'docstore', path: './docs' },
  embedding: { type: 'ollama', model: 'nomic-embed-text' },
});
```

**Pros:** Declarative. Config file friendly. Less boilerplate.
**Cons:** Magic. Harder to customize. Must maintain type registry.

### Option C: Builder pattern

```typescript
const core = await GraphCore.builder()
  .withStore(new DocStore(config))
  .withEmbedding(new OllamaEmbedding())
  .withLLM(new OllamaLLM())  // Optional
  .build();
```

**Pros:** Fluent API. Clear optional vs required via method naming.
**Cons:** More code to maintain. Intermediate builder state.

### Option D: Dependency injection container

Use a DI framework. Providers registered by interface, resolved at runtime.

**Pros:** Flexible. Testable. Standard pattern.
**Cons:** Adds framework dependency. Overkill for MVP.

## Sub-decisions

### Initialization order

Some providers may depend on others:
- Store must init before anything reads/writes
- Embedding may need store for cached vectors

Options:
- Explicit ordered phases: `store.init()` → `embedding.init()` → ...
- Dependency declaration: providers declare what they need
- Parallel init with await on dependencies

### Health checks

How to know if a provider is working?

```typescript
interface Provider {
  health(): Promise<{ ok: boolean; message?: string }>;
}
```

When to check:
- At startup only
- Periodic background checks
- On-demand / lazy

### Hot reload

Can providers be swapped at runtime?

- No: restart required for config changes
- Yes: `core.registerStore(newStore)` replaces existing

## Considerations

- MVP: single user, single config, restart is fine
- CLI already defines `roux.yaml` config format
- Testing needs easy mock injection
- Future: multi-tenant might need per-request provider selection

## Decision

**Option B: Config-driven** with dynamic capability exposure.

## Outcome

### Core Principle: Capabilities, Not Requirements

The system runs with whatever providers are configured. Missing providers aren't errors—they're absent capabilities. The interface surface (MCP tools) reflects what's actually available.

### Startup Flow

```
1. Load roux.yaml
2. Validate StoreProvider config (required—fail if missing)
3. Instantiate StoreProvider, verify connection
4. For each optional provider in config:
   - Instantiate
   - Verify connection (warn on failure, continue without)
5. Build capability map from successful providers
6. Expose MCP tools based on capability map
7. Ready to serve
```

### Provider Categories

| Category | Providers | Behavior if Missing |
|----------|-----------|---------------------|
| **Required** | StoreProvider | Startup fails. No store = no data = nothing works. |
| **Optional** | EmbeddingProvider, LLMProvider, future providers | Tools requiring this provider not exposed. Not an error. |

### Dynamic Tool Surface

MCP tools are exposed based on available providers:

| Tool | Requires | Exposed if... |
|------|----------|---------------|
| `get_node`, `create_node`, etc. | StoreProvider | Always (store is required) |
| `get_neighbors`, `find_path`, `get_hubs` | StoreProvider | Always |
| `search` (semantic) | StoreProvider + EmbeddingProvider | EmbeddingProvider configured |
| `summarize_node`, `suggest_tags` | StoreProvider + LLMProvider | LLMProvider configured |

If a provider isn't configured, its dependent tools simply don't exist. No error, no fallback—the capability isn't offered.

### Sub-decisions

| Sub-decision | Choice | Rationale |
|--------------|--------|-----------|
| **Init order** | Store first, then optional providers | Store is foundation. Others may depend on it. |
| **Health checks** | Startup only for MVP | Personal tool. Restart is acceptable. |
| **Hot reload** | No. Restart required. | MVP simplicity. Revisit for multi-tenant. |

### Example Configurations

**Minimal (file access only):**
```yaml
providers:
  store:
    type: docstore
    path: ./docs
```
Tools: CRUD, graph traversal, tag search. No semantic search.

**With embeddings:**
```yaml
providers:
  store:
    type: docstore
    path: ./docs
  embedding:
    type: ollama
    model: nomic-embed-text
```
Tools: All above + semantic search.

**Full:**
```yaml
providers:
  store:
    type: docstore
    path: ./docs
  embedding:
    type: ollama
    model: nomic-embed-text
  llm:
    type: ollama
    model: llama3.2
```
Tools: All capabilities.

### Rationale

This design enables:
1. **Progressive enhancement** — Start minimal, add capabilities as needed
2. **No false promises** — MCP only offers what it can deliver
3. **Clean error model** — Misconfiguration isn't an error; runtime failure is
4. **Simpler code** — No "is provider available?" checks in every handler

## Related

- [[Decisions]] — Decision hub
- [[GraphCore]] — Where lifecycle lives
- [[decisions/Error Contract]] — What happens when providers fail
- [[CLI]] — Reads config, creates providers
