---
id: j6M20xuTTVdv
title: options object pattern
tags:
  - decision
  - api
  - style
---
# Options Object Pattern

**Status:** Accepted  
**Date:** 2025-01-30

## Decision

All constructors and functions with more than 2 parameters MUST use an options object pattern.

```typescript
// BAD: Positional parameters
constructor(
  sourceRoot: string,
  cacheDir: string,
  vectorIndex?: VectorIndex,
  registry?: ReaderRegistry,
  id?: string
)

// GOOD: Options object
interface DocStoreOptions {
  sourceRoot: string;
  cacheDir: string;
  id?: string;
  vectorIndex?: VectorIndex;
  registry?: ReaderRegistry;
}

constructor(options: DocStoreOptions)
```

## Context

Positional parameters create problems:
1. **Breaking changes** — Adding a new parameter requires updating all call sites
2. **Awkward optionals** — Callers must pass `undefined` for skipped optional params
3. **Order dependency** — Parameter meaning depends on position, not name
4. **Poor readability** — `new Foo('a', 'b', null, null, 'c')` is opaque

## Rationale

Options objects solve all these issues:
1. **Additive changes** — New optional fields don't break existing callers
2. **Named parameters** — Skip what you don't need: `{ sourceRoot, cacheDir, id }`
3. **Self-documenting** — Field names visible at call site
4. **IDE support** — Autocomplete shows available options

## Scope

Applies to:
- Class constructors
- Factory functions
- Any function with 3+ parameters
- Any function likely to grow parameters

Exceptions:
- Simple utilities with stable signatures (e.g., `cosineSimilarity(a, b)`)
- Internal helpers unlikely to change

## Migration

When refactoring existing positional APIs:
1. Create options interface
2. Update constructor/function signature
3. Update all call sites (search for usages)
4. Update tests

Since our user base is small (internal only), prefer clean breaks over deprecation periods.

## Examples

### Provider Constructors

```typescript
interface TransformersEmbeddingOptions {
  model?: string;
  dimensions?: number;
  id?: string;
}

constructor(options: TransformersEmbeddingOptions = {})
```

### GraphCore Methods

Methods with complex signatures should also use this pattern:

```typescript
interface SearchOptions {
  limit?: number;
  threshold?: number;
  tags?: string[];
}

search(query: string, options?: SearchOptions): Promise<Node[]>
```

(GraphCore already does this correctly.)

## Related

- [[GraphCore]] — Already uses options pattern for search/list operations
- `docs/issues/docstore-constructor-options-object.md` — Specific issue that prompted this decision
