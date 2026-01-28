---
title: StoreProvider Architecture
tags:
  - architecture
  - refactor
  - store-provider
---
# StoreProvider Architecture

**Status:** Open  
**Depends on:** [[Provider Interface Naming Convention]] (must complete first)

## Problem

GraphManager currently lives inside DocStore (a specific storage implementation). This is wrong. The graph is a **common abstraction** that should be owned by the StoreProvider layer, not reimplemented in each storage backend.

## Current (Wrong)

```
GraphCore → StoreInterface → DocStore (owns GraphManager + files + cache)
```

Each storage backend would need to reimplement graph coordination. DRY violation.

## Correct Design

```
GraphCore → StoreInterface (contract)
                 ↑ implements
            StoreProvider (abstract, owns GraphManager)
                 ↑ extends
            DocStore / Neo4jStore (storage I/O only)
```

The graph is identical regardless of storage backend. Graph management lives at the common layer.

## Implementation

### Phase 1: Create StoreProvider abstract class

**File:** `src/providers/store.ts`

```typescript
import { GraphManager } from '../graph/manager.js';
import type { StoreInterface, NeighborOptions, Metric, CentralityMetrics } from '../types/provider.js';
import type { Node } from '../types/node.js';

export abstract class StoreProvider implements StoreInterface {
  protected graphManager = new GraphManager();

  // === Abstract: implementations provide storage I/O ===
  
  protected abstract loadAllNodes(): Promise<Node[]>;
  protected abstract getNodesByIds(ids: string[]): Promise<Node[]>;
  
  // === Concrete: graph ops identical across all stores ===
  
  async getNeighbors(id: string, options: NeighborOptions): Promise<Node[]> {
    if (!this.graphManager.isReady()) return [];
    const neighborIds = this.graphManager.getNeighborIds(id, options);
    return this.getNodesByIds(neighborIds);
  }

  async findPath(source: string, target: string): Promise<string[] | null> {
    if (!this.graphManager.isReady()) return null;
    return this.graphManager.findPath(source, target);
  }

  async getHubs(metric: Metric, limit: number): Promise<Array<[string, number]>> {
    if (!this.graphManager.isReady()) return [];
    return this.graphManager.getHubs(metric, limit);
  }

  // === Protected: subclasses call after mutations ===
  
  protected async rebuildGraph(): Promise<Map<string, CentralityMetrics>> {
    const nodes = await this.loadAllNodes();
    return this.graphManager.build(nodes);
  }
  
  /** Override to persist centrality metrics. Default: no-op. */
  protected onCentralityComputed(centrality: Map<string, CentralityMetrics>): void {
    // Subclasses override to store centrality
  }
  
  /** Rebuild graph and notify subclass of new centrality. */
  protected async syncGraph(): Promise<void> {
    const centrality = await this.rebuildGraph();
    this.onCentralityComputed(centrality);
  }
}
```

### Phase 2: DocStore extends StoreProvider

```typescript
export class DocStore extends StoreProvider implements StoreInterface {
  // Remove: private graphManager (inherited)
  // Remove: getNeighbors, findPath, getHubs (inherited)
  
  // Implement abstract methods
  protected async loadAllNodes(): Promise<Node[]> {
    return this.cache.getAllNodes();
  }
  
  protected getNodesByIds(ids: string[]): Promise<Node[]> {
    return Promise.resolve(this.cache.getNodes(ids));
  }
  
  // Override hook to persist centrality
  protected onCentralityComputed(centrality: Map<string, CentralityMetrics>): void {
    const now = Date.now();
    for (const [id, metrics] of centrality) {
      this.cache.storeCentrality(id, 0, metrics.inDegree, metrics.outDegree, now);
    }
  }
  
  // Update mutation methods to use syncGraph()
  async sync(): Promise<void> {
    // ... existing file processing ...
    await this.syncGraph(); // replaces direct graphManager.build() call
  }
}
```

### Phase 3: Update exports

**File:** `src/providers/index.ts`

```typescript
export { StoreProvider } from './store.js';
export { DocStore } from './docstore/index.js';
// ... other exports
```

## Key Files

| File | Change |
|------|--------|
| `src/types/provider.ts` | No changes (interface stays same) |
| `src/providers/store.ts` | **NEW** — StoreProvider abstract class |
| `src/providers/docstore/index.ts` | Extends StoreProvider, shrinks ~30 lines |
| `src/graph/manager.ts` | No changes |

## Test Strategy

1. **New tests:** `tests/providers/store.test.ts` — unit tests for StoreProvider
   - Test graph ops with mock implementation
   - Test graceful degradation (graph not ready)
   - Test syncGraph calls onCentralityComputed
   
2. **Existing tests:** All DocStore tests pass unchanged
   - StoreInterface contract unchanged
   - Behavior identical, just restructured

## Benefits

1. **DRY** — graph logic isn't duplicated across store implementations
2. **Consistency** — all stores have identical graph behavior  
3. **Cleaner separation** — DocStore is purely about files
4. **Future-proof** — Neo4jStore, PostgresStore get graph ops for free

## Verification

```bash
npm run typecheck   # No type errors
npm test            # All 1021+ tests pass
```
