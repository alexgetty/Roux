# Decision - Error Contract

**Status:** Decided
**Affects:** [[GraphCore]], all providers, [[MCP Server]]

## Problem

No defined behavior for when things fail:

- EmbeddingProvider unavailable → Does semantic search fail? Do graph ops still work?
- StoreProvider write fails → Retry? Surface to caller? Rollback?
- Provider throws exception vs returns null vs returns error object
- Partial failures (batch embed where some succeed)

External interfaces (MCP Server) need to report errors meaningfully to clients.

## Options

### Option A: Fail fast, fail loud

Any provider error throws. GraphCore doesn't catch. External interface handles.

```typescript
// GraphCore
async search(query: string): Promise<Node[]> {
  const vector = await this.embedding.embed(query);  // Throws if unavailable
  return this.store.searchByVector(vector);          // Throws if fails
}
```

**Pros:** Simple. Errors surface immediately. No silent failures.
**Cons:** No graceful degradation. One bad provider kills everything.

### Option B: Result types with errors

Return Result objects that can be success or failure.

```typescript
type Result<T> = { ok: true; value: T } | { ok: false; error: Error };

async search(query: string): Promise<Result<Node[]>> {
  const vectorResult = await this.embedding.embed(query);
  if (!vectorResult.ok) return vectorResult;
  // ...
}
```

**Pros:** Explicit error handling. Composable. Type-safe.
**Cons:** Verbose. Every caller must handle both cases.

### Option C: Graceful degradation

GraphCore catches provider errors and degrades functionality.

```typescript
async search(query: string): Promise<Node[]> {
  try {
    const vector = await this.embedding.embed(query);
    return this.store.searchByVector(vector);
  } catch (e) {
    // Fall back to keyword search
    return this.store.keywordSearch(query);
  }
}
```

**Pros:** Best UX—something always works. Resilient.
**Cons:** Silent degradation can hide problems. Complex fallback logic.

### Option D: Error events + degradation

Degrade gracefully but emit events for monitoring.

```typescript
async search(query: string): Promise<Node[]> {
  try {
    return await this.semanticSearch(query);
  } catch (e) {
    this.emit('provider-error', { provider: 'embedding', error: e });
    return this.keywordSearch(query);
  }
}
```

**Pros:** Best of both—works for users, visible to operators.
**Cons:** Adds event system complexity.

## Sub-decisions

### Required vs optional providers

Which providers must be present for GraphCore to function?

- Required: StoreProvider (no data = no graph)
- Optional: EmbeddingProvider (semantic search disabled), LLMProvider (assisted features disabled)

### Partial batch failures

`embedBatch(['a', 'b', 'c'])` where 'b' fails:

- Fail entire batch
- Return partial results + errors
- Skip failures, return what succeeded

### Timeout handling

Long-running operations (embedding large docs):

- Hard timeout, fail
- Soft timeout, warn and continue
- Configurable per-provider

## Considerations

- MVP is personal tool—fail loud is probably fine
- Production systems need graceful degradation
- MCP protocol has error response format we should use
- Observability matters even for personal use

## Decision

**New approach: Capability-based exposure + fail loudly on runtime errors.**

The original options assumed tools are always exposed and must handle unavailability. The chosen approach eliminates that category entirely by not exposing tools for unavailable capabilities.

## Outcome

### Core Principle: Two Categories Only

| Category | Definition | Behavior |
|----------|------------|----------|
| **Not configured** | Provider not in config | Tool not exposed. Not an error—capability doesn't exist. |
| **Runtime failure** | Provider configured but fails during operation | Fail loudly. Return error. System stays up. |

There is no "graceful degradation" or "silent fallback." If a tool exists, it works. If a provider fails, the call fails.

### Error Flow

```
User calls search()
    │
    ├─► EmbeddingProvider not configured?
    │       → search tool doesn't exist
    │       → LLM client never sees it
    │       → No error (capability absent)
    │
    └─► EmbeddingProvider configured?
            │
            ├─► embed() succeeds → return results
            │
            └─► embed() fails → throw error
                    → MCP returns error to client
                    → System stays up
                    → Other tools still work
```

### Sub-decisions

**Partial batch failures:**
Return partial results + errors for failures.

```typescript
interface BatchResult<T> {
  succeeded: Array<{ id: string; result: T }>;
  failed: Array<{ id: string; error: Error }>;
}
```

Rationale: Don't lose successful work. Let caller decide how to handle failures.

**Timeout handling:**
- Configurable per-provider in config
- Hard timeout—fail the call
- Default: 30 seconds for embeddings, 60 seconds for LLM

```yaml
providers:
  embedding:
    type: ollama
    timeout: 30000  # ms
```

**Error format:**
Use standard Error with clear message. MCP protocol handles serialization.

```typescript
throw new Error(`EmbeddingProvider failed: ${originalError.message}`);
```

### What This Eliminates

The original problem statement is largely dissolved:

| Original Question | Answer |
|-------------------|--------|
| EmbeddingProvider unavailable → semantic search fail? | Tool not exposed. Question doesn't arise. |
| Do graph ops still work? | Yes. They don't depend on EmbeddingProvider. |
| Provider throws vs returns null vs error object? | Throws. Fail loudly. |
| Partial failures? | Return both successes and failures. |

### Rationale

1. **Honest interface** — MCP only offers what works
2. **Error handling at the right layer** — LLM client explains missing capabilities to user
3. **Simple implementation** — No fallback logic, no "is available?" checks
4. **Clear failure mode** — If it's exposed and it breaks, that's a real error worth surfacing

## Related

- [[Decisions]] — Decision hub
- [[GraphCore]] — Orchestration and error handling
- [[MCP Server]] — Must surface errors to clients
- [[decisions/Provider Lifecycle]] — Related: what happens at startup
