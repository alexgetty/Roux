# AnalyticsProvider

Graph health and metrics.

## Overview

AnalyticsProvider monitors graph quality and surfaces insights. It detects structural issues (orphans, dead-ends), computes graph statistics, and tracks usage patterns.

## Interface

```typescript
interface AnalyticsProvider {
  // Structural analysis
  findOrphans(): Promise<Node[]>;              // Nodes with no connections
  findDeadEnds(): Promise<Node[]>;             // Nodes with no outgoing links
  findBridges(): Promise<Edge[]>;              // Edges whose removal disconnects graph

  // Connectivity
  getComponents(): Promise<Component[]>;       // Connected components
  getDiameter(): Promise<number>;              // Longest shortest path
  getDensity(): Promise<number>;               // Edge count / possible edges

  // Centrality (if not in StoreProvider)
  computePageRank(): Promise<Map<string, number>>;
  computeBetweenness(): Promise<Map<string, number>>;

  // Statistics
  getStats(): Promise<GraphStats>;

  // Usage patterns
  trackQuery(query: QueryEvent): void;
  getQueryPatterns(): Promise<QueryPattern[]>;
}

interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  avgDegree: number;
  clustering: number;
  tagDistribution: Record<string, number>;
}
```

## Use Cases

**Graph Health Dashboard**
- How many orphans exist?
- What's the connectivity like?
- Are there isolated clusters?

**Content Maintenance**
- Find notes that need links
- Identify dead-end articles
- Surface under-connected concepts

**Performance Monitoring**
- Query patterns and latencies
- Cache hit rates
- Common search terms

## Relationship to StoreProvider

Some operations overlap with [[StoreProvider]] (e.g., `getHubs`). The division:

- **StoreProvider**: Operations needed for queries (path finding, neighbor lookup)
- **AnalyticsProvider**: Batch analysis for insights (orphan detection, full graph stats)

## Related

- [[GraphCore]] — Exposes analytics to external interfaces
- [[StoreProvider]] — Provides raw graph data
- [[Node]] — What gets analyzed
