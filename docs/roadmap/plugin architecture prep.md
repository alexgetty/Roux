---
id: upMcpR66lcS_
title: plugin architecture prep
tags:
  - roadmap
  - architecture
  - plugin
---
# Plugin Architecture Prep

**Status:** Ready for implementation (red team reviewed x3)

**Goal:** Prepare the provider system for a future unified plugin architecture by adding `id` fields, options object constructors, type guard validation, and clean shutdown.

## Key Decision: Cold Boot Only

**No runtime hot-swap.** Providers are configured once at startup and immutable for the lifetime of the process. Config changes take effect on next boot.

Process lifecycle:
1. Read config
2. Construct providers from config
3. Register (validate + assign)
4. Run (immutable — no replacement, no re-registration)
5. Shutdown (clean destroy)

This eliminates: lifecycle hooks, rollback logic, replacement guards, concurrent access windows during registration, and orphaned provider states. Hot-reload is deferred to [[roadmap/Plugin Hot Reload]] (P3) if consumer applications need it.

## Decisions

- **Synchronous registration:** Registration is validate-and-assign. No async hooks, no awaiting side effects.
- **Async fromConfig():** Stays async because DocStore `sync()` is inherently async. This is construction, not registration.
- **destroy() method:** Add to GraphCore for clean shutdown (process lifecycle, not plugin lifecycle).
- **Options objects:** Use options object pattern for all provider constructors per [[decisions/Options Object Pattern]].
- **No ProviderLifecycle:** Cut entirely. `onRegister`/`onUnregister` hooks are hot-swap machinery. Not needed for cold boot.

## Summary

| Task | Files | Breaking? |
|------|-------|-----------|
| 1. Add `id` field to interfaces | `types/provider.ts` | Yes |
| 2. Update type guards | `types/provider.ts` | No |
| 3. Update DocStore constructor | `providers/docstore/index.ts` + callers | Yes |
| 4. Update TransformersEmbedding constructor | `providers/embedding/transformers.ts` + callers | Yes |
| 5. Add type guard validation to registration | `core/graphcore.ts` | No |
| 6. Update fromConfig() | `core/graphcore.ts` | Yes (async) |
| 7. Add destroy() to GraphCore | `types/graphcore.ts`, `core/graphcore.ts` | No |
| 8. Update serve.ts | `cli/commands/serve.ts` | N/A |
| 9. Update tests | Multiple test files | N/A |

## Complete Blast Radius

### Provider Interfaces + Type Guards (Tasks 1-2)
- `src/types/provider.ts` — `isStoreProvider`, `isEmbeddingProvider` only
- `tests/unit/types/provider.test.ts`
- `tests/unit/embedding/transformers.test.ts` — has `isEmbeddingProvider` check

Note: `isVectorIndex` stays unchanged — VectorIndex does not get `id`.

### DocStore Options Object (Task 3)
- `src/providers/docstore/index.ts` — implementation
- `src/core/graphcore.ts` — `fromConfig()`
- `src/cli/commands/serve.ts` — CLI startup
- `tests/unit/docstore/docstore.test.ts`
- `tests/unit/docstore/watcher.test.ts`
- `tests/unit/cli/serve.test.ts`
- `tests/unit/cli/status.test.ts`
- `tests/unit/cli/viz.test.ts`
- `tests/integration/core/graphcore.integration.test.ts`
- `tests/integration/mcp/handlers.integration.test.ts`
- `tests/integration/watcher/file-events.test.ts`

### TransformersEmbedding Options Object (Task 4)
- `src/providers/embedding/transformers.ts` — implementation
- `src/core/graphcore.ts` — `fromConfig()`
- `src/cli/commands/serve.ts` — CLI startup
- `tests/unit/embedding/transformers.test.ts`
- `tests/integration/core/graphcore.integration.test.ts`
- `tests/integration/mcp/handlers.integration.test.ts`

### fromConfig() Async (Task 6)
- `src/core/graphcore.ts`
- `src/cli/commands/serve.ts`
- `tests/unit/core/graphcore.test.ts`
- `tests/integration/core/graphcore.integration.test.ts`
- `tests/unit/mcp/handlers.test.ts`
- `tests/unit/mcp/server.test.ts`
- `tests/integration/mcp/handlers.integration.test.ts`

## Execution Order (TDD)

**Phase 1: Provider Interfaces + Type Guards**
1. Write failing tests for `id` field validation in type guards
2. Add `ProviderBase` interface with `readonly id: string`
3. Update `Store` and `Embedding` to extend `ProviderBase`
4. Update `isStoreProvider` and `isEmbeddingProvider` to check `typeof obj.id === 'string' && obj.id.length > 0`
5. VectorIndex unchanged — internal to Store, not registered with GraphCore
6. Tests go green

**Phase 2: Provider Implementations**
1. Write failing tests for DocStore with options object and `id`
2. Update DocStore constructor to options object pattern
3. Add `readonly id` field (default: `'docstore'`)
4. Update all DocStore callers
5. Tests go green
6. Repeat for TransformersEmbedding (default id: `'transformers'`)

**Phase 3: GraphCore Registration Validation**
1. Write failing tests for type guard validation on registration
2. Update `registerStore()` and `registerEmbedding()` to validate via type guards before assignment
3. Registration stays synchronous — validate, assign, done
4. Tests go green

**Phase 4: GraphCore fromConfig()**
1. Write failing tests for async `fromConfig()`
2. Update `fromConfig()` to return `Promise<GraphCoreImpl>`
3. Construction is async (DocStore sync), registration is sync
4. Tests go green

**Phase 5: GraphCore destroy()**
1. Write failing tests for `destroy()` including idempotency
2. Implement `destroy()` — calls `close()` on store, nulls references
3. After destroy, operations throw (no silent failures)
4. Tests go green

**Phase 6: Update serve.ts + Final Verification**
1. Update serve.ts with `await GraphCoreImpl.fromConfig(config)`
2. Add destroy on shutdown
3. Run full test suite
4. Manual test: `npm run dev` starts MCP server

## Task Details

### Task 1: Add `id` Field to Provider Interfaces

**File:** `src/types/provider.ts`

```typescript
/** Base fields all providers must implement */
export interface ProviderBase {
  /** Unique identifier for this provider instance. Must be non-empty. */
  readonly id: string;
}

export interface Store extends ProviderBase {
  // ... existing methods unchanged
}

export interface Embedding extends ProviderBase {
  // ... existing methods unchanged
}

// VectorIndex does NOT extend ProviderBase — internal to Store
export interface VectorIndex {
  // ... existing methods unchanged (no id field)
}
```

### Task 2: Update Type Guards

**File:** `src/types/provider.ts`

Only update `isStoreProvider` and `isEmbeddingProvider`. `isVectorIndex` unchanged.

```typescript
export function isStoreProvider(value: unknown): value is Store {
  if (value === null || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    obj.id.length > 0 &&
    typeof obj.createNode === 'function' &&
    // ... rest unchanged
  );
}

export function isEmbeddingProvider(value: unknown): value is Embedding {
  if (value === null || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    obj.id.length > 0 &&
    typeof obj.embed === 'function' &&
    // ... rest unchanged
  );
}
```

### Task 3: Update DocStore

**File:** `src/providers/docstore/index.ts`

```typescript
export interface DocStoreOptions {
  sourceRoot: string;
  cacheDir: string;
  id?: string;
  vectorIndex?: VectorIndex;
  registry?: ReaderRegistry;
}

export class DocStore implements Store {
  readonly id: string;

  constructor(options: DocStoreOptions) {
    const { sourceRoot, cacheDir, id = 'docstore', vectorIndex, registry } = options;
    // ... existing constructor logic
    this.id = id;
  }

  // No onRegister/onUnregister — cold boot only
}
```

### Task 4: Update TransformersEmbedding

**File:** `src/providers/embedding/transformers.ts`

```typescript
export interface TransformersEmbeddingOptions {
  model?: string;
  dimensions?: number;
  id?: string;
}

export class TransformersEmbedding implements Embedding {
  readonly id: string;

  constructor(options: TransformersEmbeddingOptions = {}) {
    const { model, dimensions, id = 'transformers' } = options;
    // ... existing constructor logic
    this.id = id;
  }
}
```

### Task 5: GraphCore Registration (Synchronous)

**Files:** `src/types/graphcore.ts`, `src/core/graphcore.ts`

```typescript
// Interface — registration is sync
export interface GraphCore {
  registerStore(provider: Store): void;
  registerEmbedding(provider: Embedding): void;
  destroy(): void;
  // ... rest unchanged
}

// Implementation — validate and assign
registerStore(provider: Store): void {
  if (!isStoreProvider(provider)) {
    throw new Error('Invalid Store provider: missing required methods or id');
  }
  this.store = provider;
}

registerEmbedding(provider: Embedding): void {
  if (!isEmbeddingProvider(provider)) {
    throw new Error('Invalid Embedding provider: missing required methods or id');
  }
  this.embedding = provider;
}
```

### Task 6: fromConfig() (Async)

**File:** `src/core/graphcore.ts`

```typescript
static async fromConfig(config: RouxConfig): Promise<GraphCoreImpl> {
  // ... validation unchanged
  
  const core = new GraphCoreImpl();
  
  const store = new DocStore({ sourceRoot, cacheDir });
  await store.sync(); // Async construction concern, not registration
  core.registerStore(store); // Sync — validate and assign
  
  const embedding = new TransformersEmbedding({ model });
  core.registerEmbedding(embedding); // Sync
  
  return core;
}
```

### Task 7: destroy()

**File:** `src/core/graphcore.ts`

```typescript
destroy(): void {
  if (this.store?.close) {
    this.store.close();
  }
  this.store = null;
  this.embedding = null;
}
```

Simple, synchronous, idempotent. No lifecycle hooks to await, no error handling for hook failures.

## What Was Cut (and Why)

| Cut | Reason |
|-----|--------|
| `ProviderLifecycle` interface | Hot-swap machinery. Not needed for cold boot. |
| `onRegister()` / `onUnregister()` hooks | Same. Deferred to [[roadmap/Plugin Hot Reload]]. |
| Async registration methods | No hooks to await. Validate-and-assign is sync. |
| Rollback logic on registration | No replacement during runtime. Nothing to roll back. |
| Provider replacement guards | Immutable after boot. Config changes take effect on restart. |

## Red Team History

- **Round 1-2:** Identified blast radius, confirmed options object pattern, validated VectorIndex exclusion.
- **Round 3:** Found that all HIGH findings (concurrent access window, orphaned provider on failed replacement, reentrancy) stemmed from hot-swap complexity. Decision: cold boot only. Providers configured at startup, immutable during runtime. Config changes apply on next boot. All HIGHs resolved by elimination.

## References

- [[decisions/Options Object Pattern]] — constructor pattern
- [[Library vs Application Boundaries]] — Roux is a library, not a framework
- [[roadmap/Multi-Store Architecture]] — future multi-provider support
- [[GraphCore]] — orchestration hub
- [[decisions/Provider Lifecycle]] — lifecycle decisions
- [[roadmap/Plugin Hot Reload]] — deferred runtime swap capability
