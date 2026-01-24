# Decision - Edge Futureproofing

**Status:** Decided
**Affects:** [[Edge]], [[Node]], [[StoreProvider]], [[GraphCore]]

## Problem

MVP uses implicit edges:

```typescript
interface Node {
  outgoingLinks: string[];  // Just IDs, no metadata
}
```

The roadmap includes typed edges:

```typescript
interface Edge {
  source: string;
  target: string;
  type?: string;
  weight?: number;
  properties?: Record<string, any>;
}
```

Current `StoreProvider.getNeighbors(id, direction)` doesn't support filtering by edge type. If we add type filtering later, we break the interface.

## Options

### Option A: Add optional type param now

```typescript
getNeighbors(id: string, direction: Direction, type?: string): Promise<Node[]>;
```

MVP implementations ignore the param. Future implementations use it.

**Pros:** Interface stable. No breaking change later.
**Cons:** Param does nothing in MVP. Slight API awkwardness.

### Option B: Separate method for typed queries

```typescript
getNeighbors(id: string, direction: Direction): Promise<Node[]>;
getNeighborsByType(id: string, direction: Direction, type: string): Promise<Node[]>;  // Added later
```

**Pros:** MVP interface stays minimal. New method when needed.
**Cons:** Two methods for similar operation. Proliferating API surface.

### Option C: Options object pattern

```typescript
interface NeighborOptions {
  direction: Direction;
  type?: string;       // Future
  minWeight?: number;  // Future
  limit?: number;      // Future
}

getNeighbors(id: string, options: NeighborOptions): Promise<Node[]>;
```

**Pros:** Extensible forever. Single method.
**Cons:** More verbose for simple cases. Options object for one required param feels heavy.

### Option D: Accept the breaking change

Keep MVP minimal. Break interface when typed edges ship.

**Pros:** Simplest MVP. No premature abstraction.
**Cons:** Breaking change for anyone using v1 interface.

## Considerations

- Typed edges are Phase 3+ (after MVP, after structural embeddings)
- MVP users are likely us—breaking ourselves is fine
- But if we publish as npm package, interface stability matters
- Options pattern is common in mature APIs (good precedent)
- Edge types from frontmatter (e.g., `parent: [[X]]`) could come earlier than full Edge model

## Decision

**Option C: Options object pattern.**

## Outcome

### Interface

```typescript
interface NeighborOptions {
  direction: Direction;
  type?: string;       // Future: filter by edge type
  minWeight?: number;  // Future: filter by edge weight
  limit?: number;      // Future: cap results
}

getNeighbors(id: string, options: NeighborOptions): Promise<Node[]>;
```

### MVP Usage

```typescript
// All options except direction are optional
getNeighbors(id, { direction: 'out' })
getNeighbors(id, { direction: 'both' })
```

MVP implementations ignore unrecognized options. Future implementations use them.

### Why Options Object

1. **Infinite extensibility** — Add fields without breaking callers
2. **Start minimal** — MVP just uses `{ direction }`, everything else optional
3. **No breaking changes** — Interface stable forever
4. **Self-documenting** — Named fields clearer than positional params
5. **Consistent pattern** — Can apply same pattern to other methods if needed

### Cost

15 extra characters per call vs positional params. Trivial.

### Applies To

This pattern should be used for any StoreProvider method likely to gain options:

| Method | Options Object? |
|--------|-----------------|
| `getNeighbors` | Yes — `NeighborOptions` |
| `findPath` | Consider — could add `maxDepth`, `edgeTypes` |
| `getHubs` | Consider — already has `metric`, `limit` |
| `searchByVector` | Consider — could add filters |

For MVP, only `getNeighbors` needs the options pattern. Others can adopt it when extended.

### Rationale

Aligns with project philosophy: start light, don't close doors. The marginal verbosity cost is nothing compared to never having to version the interface for edge features.

## Related

- [[Decisions]] — Decision hub
- [[Edge]] — Relationship model
- [[Node]] — Contains outgoingLinks
- [[StoreProvider]] — Defines getNeighbors
- [[IngestionProvider]] — May need edge types for inference
