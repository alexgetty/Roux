---
id: upMcpR66lcS_
title: plugin architecture prep
tags:
  - roadmap
  - architecture
  - plugin
---
# Plugin Architecture Prep

**Status:** Ready for implementation (red team reviewed x2)

**Goal:** Prepare the provider system for a future unified plugin architecture by adding `id` fields, lifecycle hooks, and runtime validation.

## Decisions

- **Async registration:** Confirmed. Registration methods become async to properly await lifecycle hooks.
- **destroy() method:** Confirmed. Add to GraphCore for clean shutdown.
- **Options objects:** Use options object pattern for all provider constructors per [[decisions/Options Object Pattern]].

## Summary

| Task | Files | Breaking? |
|------|-------|-----------|
| 1. Add `id` field to interfaces | `types/provider.ts` | Yes |
| 2. Add lifecycle interface | `types/provider.ts` | No (optional) |
| 3. Update type guards | `types/provider.ts` | No |
| 4. Update GraphCore registration | `types/graphcore.ts`, `core/graphcore.ts` | Yes (async) |
| 4b. Update fromConfig() | `core/graphcore.ts` | Yes (async) |
| 5. Add destroy() to GraphCore | `types/graphcore.ts`, `core/graphcore.ts` | No |
| 6. Update DocStore | `providers/docstore/index.ts` + 10 callers | Yes |
| 7. Update TransformersEmbedding | `providers/embedding/transformers.ts` + 5 callers | Yes |
| 8. Update serve.ts | `cli/commands/serve.ts` | N/A |
| 9. Update tests | Multiple test files | N/A |

## Complete Blast Radius

### Async Registration (Task 4, 4b)
- `src/core/graphcore.ts`
- `src/types/graphcore.ts`
- `src/cli/commands/serve.ts`
- `tests/unit/core/graphcore.test.ts`
- `tests/integration/core/graphcore.integration.test.ts`
- `tests/unit/mcp/handlers.test.ts`
- `tests/unit/mcp/server.test.ts`
- `tests/integration/mcp/handlers.integration.test.ts`

### DocStore Options Object (Task 6)
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

### TransformersEmbedding Options Object (Task 7)
- `src/providers/embedding/transformers.ts` — implementation
- `src/core/graphcore.ts` — `fromConfig()`
- `src/cli/commands/serve.ts` — CLI startup
- `tests/unit/embedding/transformers.test.ts`
- `tests/integration/core/graphcore.integration.test.ts`
- `tests/integration/mcp/handlers.integration.test.ts`

### Type Guard Updates (Task 3)
- `src/types/provider.ts` — `isStoreProvider`, `isEmbeddingProvider` only
- `tests/unit/types/provider.test.ts`
- `tests/unit/embedding/transformers.test.ts` — has `isEmbeddingProvider` check

Note: `isVectorIndex` stays unchanged — VectorIndex does not get `id`.

## Execution Order (TDD)

**Phase 1: Type Guards**
1. Write failing tests for `id` field validation in type guards
2. Update `isStoreProvider` and `isEmbeddingProvider` to check `typeof obj.id === 'string' && obj.id.length > 0`
3. Tests go green

**Phase 2: Provider Interfaces**
1. Add `ProviderBase` and `ProviderLifecycle` interfaces
2. Update `Store` and `Embedding` to extend them
3. VectorIndex unchanged — internal to Store, not registered with GraphCore

**Phase 3: Provider Implementations**
1. Write failing tests for DocStore with options object and `id`
2. Update DocStore constructor to options object pattern
3. Add `id` field, `onRegister()`, `onUnregister()` to DocStore
4. Update all 10 DocStore callers
5. Tests go green
6. Repeat for TransformersEmbedding (5 callers)

**Phase 4: GraphCore Registration**
1. Write failing tests for async registration, type guard validation, lifecycle hooks
2. Update `registerStore()` and `registerEmbedding()` to be async
3. Add type guard validation
4. Add lifecycle hook calls with error handling
5. Tests go green

**Phase 5: GraphCore fromConfig()**
1. Write failing tests for async `fromConfig()`
2. Update `fromConfig()` to return `Promise<GraphCoreImpl>`
3. Tests go green

**Phase 6: GraphCore destroy()**
1. Write failing tests for `destroy()` including idempotency and re-registration
2. Implement `destroy()`
3. Tests go green

**Phase 7: Update serve.ts**
1. Update serve.ts with await and error handling:
```typescript
const core = new GraphCoreImpl();
try {
  await core.registerStore(store);
  await core.registerEmbedding(embedding);
} catch (err) {
  store.close(); // Clean up if registration fails
  throw err;
}
```

**Phase 8: Final Verification**
1. Run full test suite
2. Manual test: `npm run dev` starts MCP server

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
  // ... existing 16 methods unchanged
}

export interface Embedding extends ProviderBase {
  // ... existing 4 methods unchanged
}

// VectorIndex does NOT extend ProviderBase — internal to Store
export interface VectorIndex {
  // ... existing 5 methods unchanged (no id field)
}
```

### Task 2: Add Lifecycle Interface

**File:** `src/types/provider.ts`

```typescript
/** Optional lifecycle hooks for providers */
export interface ProviderLifecycle {
  /** Called after registration with GraphCore. Errors propagate to caller. */
  onRegister?(): Promise<void>;
  /** Called before provider is replaced or GraphCore is destroyed. Best-effort, errors logged. */
  onUnregister?(): Promise<void>;
}

export interface Store extends ProviderBase, ProviderLifecycle { ... }
export interface Embedding extends ProviderBase, ProviderLifecycle { ... }
```

### Task 3: Update Type Guards

**File:** `src/types/provider.ts`

Only update `isStoreProvider` and `isEmbeddingProvider`. `isVectorIndex` unchanged.

```typescript
export function isStoreProvider(value: unknown): value is Store {
  if (value === null || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    obj.id.length > 0 &&  // Non-empty validation
    typeof obj.createNode === 'function' &&
    // ... rest unchanged
  );
}

export function isEmbeddingProvider(value: unknown): value is Embedding {
  if (value === null || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    obj.id.length > 0 &&  // Non-empty validation
    typeof obj.embed === 'function' &&
    // ... rest unchanged
  );
}
```

### Task 4: Update GraphCore Registration

**Files:** `src/types/graphcore.ts`, `src/core/graphcore.ts`

```typescript
// Interface
export interface GraphCore {
  registerStore(provider: Store): Promise<void>;
  registerEmbedding(provider: Embedding): Promise<void>;
  destroy(): Promise<void>;
  // ... rest unchanged
}

// Implementation with error handling
async registerStore(provider: Store): Promise<void> {
  if (!provider) {
    throw new Error('Store provider is required');
  }
  if (!isStoreProvider(provider)) {
    throw new Error('Invalid Store provider: missing required methods or id');
  }

  // Unregister previous provider (best-effort)
  if (this.store?.onUnregister) {
    try {
      await this.store.onUnregister();
    } catch (err) {
      console.warn('Store onUnregister failed:', err);
    }
  }

  this.store = provider;

  // onRegister errors propagate — store is set, caller must handle
  if (provider.onRegister) {
    try {
      await provider.onRegister();
    } catch (err) {
      // Rollback: clear the store reference
      this.store = null;
      throw err;
    }
  }
}
```

**Invariant:** If `onRegister()` throws, `this.store` is NOT set (rolled back).

### Task 4b: Update fromConfig()

**File:** `src/core/graphcore.ts`

```typescript
static async fromConfig(config: RouxConfig): Promise<GraphCoreImpl> {
  // ... validation unchanged
  
  const core = new GraphCoreImpl();
  
  const store = new DocStore({ sourceRoot, cacheDir });
  await core.registerStore(store);
  
  const embedding = new TransformersEmbedding({ model });
  await core.registerEmbedding(embedding);
  
  return core;
}
```

### Task 5: Add destroy() to GraphCore

**File:** `src/core/graphcore.ts`

```typescript
async destroy(): Promise<void> {
  // Idempotent: no-op if already destroyed
  if (!this.store && !this.embedding) {
    return;
  }

  // Unregister in reverse order (best-effort)
  if (this.embedding?.onUnregister) {
    try {
      await this.embedding.onUnregister();
    } catch (err) {
      console.warn('Embedding onUnregister failed:', err);
    }
  }
  if (this.store?.onUnregister) {
    try {
      await this.store.onUnregister();
    } catch (err) {
      console.warn('Store onUnregister failed:', err);
    }
  }

  this.embedding = null;
  this.store = null;
}
```

### Task 6: Update DocStore

**File:** `src/providers/docstore/index.ts`

```typescript
export interface DocStoreOptions {
  sourceRoot: string;
  cacheDir: string;
  id?: string;
  vectorIndex?: VectorIndex;
  registry?: ReaderRegistry;
}

export class DocStore extends StoreProvider {
  readonly id: string;

  constructor(options: DocStoreOptions) {
    const { sourceRoot, cacheDir, id = 'docstore', vectorIndex, registry } = options;
    // ... existing constructor logic
    this.id = id;
  }

  async onRegister(): Promise<void> {
    await this.sync();
  }

  async onUnregister(): Promise<void> {
    this.close();
  }

  // close() is already idempotent (stopWatching and cache.close are safe to call twice)
}
```

### Task 7: Update TransformersEmbedding

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
    const { 
      model = DEFAULT_MODEL, 
      dimensions = DEFAULT_DIMENSIONS, 
      id = 'transformers-embedding' 
    } = options;
    this.id = id;
    this.model = model;
    this.dims = dimensions;
  }

  async onRegister(): Promise<void> {
    // No-op: pipeline is lazy-loaded on first embed() call
  }

  async onUnregister(): Promise<void> {
    // Release reference for GC
    // NOTE: @xenova/transformers may not truly unload from GPU memory
    this.pipe = null;
  }
}
```

### Task 9: Test Cases

**Update Mock Factories** (`tests/unit/core/graphcore.test.ts`):
```typescript
const createMockStore = (overrides?: Partial<Store>): Store => ({
  id: 'test-store',  // NEW
  createNode: vi.fn().mockResolvedValue(undefined),
  // ... existing mocks
  ...overrides,
});

const createMockEmbedding = (overrides?: Partial<Embedding>): Embedding => ({
  id: 'test-embedding',  // NEW
  embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  // ... existing mocks
  ...overrides,
});
```

**Update transformers.test.ts:**
The existing test `it('passes isEmbeddingProvider runtime check')` will need to verify `id` is present after TransformersEmbedding is updated.

**Type Guard Tests:**
```typescript
it('returns false when id is missing');
it('returns false when id is empty string');
it('returns false when id is not a string');
```

**Registration Tests:**
```typescript
it('rejects store without id');
it('rejects store with empty id');
it('calls onRegister when registering store');
it('calls onUnregister when replacing store');
it('propagates onRegister errors');
it('does not set store if onRegister throws');  // NEW: invariant test
it('continues registration if previous onUnregister throws');
```

**Destroy Tests:**
```typescript
it('calls onUnregister on store');
it('calls onUnregister on embedding');
it('continues destroy if onUnregister throws');
it('clears provider references after destroy');
it('is idempotent (no-op on second call)');
it('allows re-registration after destroy');
```

**DocStore Idempotency Test:**
```typescript
it('close() is idempotent', () => {
  const store = new DocStore({ sourceRoot: '/tmp', cacheDir: '/tmp/.cache' });
  store.close();
  expect(() => store.close()).not.toThrow();
});
```

## Files Modified

| File | Type of Change |
|------|----------------|
| `src/types/provider.ts` | Add `ProviderBase`, `ProviderLifecycle`, update guards |
| `src/types/graphcore.ts` | Async registration, add `destroy()` |
| `src/core/graphcore.ts` | Validation, lifecycle, `destroy()`, async `fromConfig()` |
| `src/providers/docstore/index.ts` | Options object, `id`, lifecycle hooks |
| `src/providers/embedding/transformers.ts` | Options object, `id`, lifecycle hooks |
| `src/cli/commands/serve.ts` | Await registration, error handling |
| `tests/unit/types/provider.test.ts` | id validation tests |
| `tests/unit/core/graphcore.test.ts` | Mock factories, registration/destroy tests |
| `tests/unit/embedding/transformers.test.ts` | Verify id, options constructor |
| `tests/unit/docstore/docstore.test.ts` | Options constructor |
| `tests/unit/docstore/watcher.test.ts` | Options constructor |
| `tests/unit/cli/serve.test.ts` | Options constructor, async |
| `tests/unit/cli/status.test.ts` | Options constructor |
| `tests/unit/cli/viz.test.ts` | Options constructor |
| `tests/integration/core/graphcore.integration.test.ts` | Options, async |
| `tests/integration/mcp/handlers.integration.test.ts` | Options, async |
| `tests/integration/watcher/file-events.test.ts` | Options constructor |

## Migration Guide

For any code implementing `Store` or `Embedding`:

1. Add `readonly id: string` property
2. Add `id` to constructor (via options object)
3. Optionally implement `onRegister()` and `onUnregister()`

Lifecycle hooks are optional — existing implementations work without them.

## Verification Checklist

```bash
# 1. Find any remaining positional constructor calls
grep -r "new DocStore(" src/ tests/ --include="*.ts" | grep -v "sourceRoot:"
grep -r "new TransformersEmbedding(" src/ tests/ --include="*.ts" | grep -v "model:"

# 2. Run full test suite
npm test

# 3. Manual verification
npm run dev  # Should start MCP server with lifecycle hooks called
```

## Resolved Decisions

1. **destroy() method:** ✅ Add to GraphCore, idempotent
2. **Async registration:** ✅ Breaking change accepted
3. **sync() vs onRegister:** Keep `sync()` public, have `onRegister` call it
4. **VectorIndex:** Does NOT get `id` or lifecycle — internal to Store
5. **Error handling:** onRegister errors propagate (with rollback), onUnregister errors logged
6. **Options objects:** Use for all provider constructors
7. **onRegister rollback:** If onRegister throws, store is NOT set (added per M1)

## Related

- [[Library vs Application Boundaries]] — Plugin vs app distinction
- [[roadmap/Multi-Store Architecture]] — Future multi-store support (depends on this)
- [[GraphCore]] — Core orchestration hub
- [[decisions/Options Object Pattern]] — Constructor pattern decision
- [[decisions/Provider Lifecycle]] — Update after this ships
