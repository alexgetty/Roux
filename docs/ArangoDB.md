# ArangoDB

Enterprise multi-model database. [[StoreProvider]] implementation combining documents, graphs, and key-value.

## Overview

ArangoDB is a multi-model database supporting documents, graphs, and key-value in one system. Useful when you need graph operations alongside other data models.

## Characteristics

- **Multi-model**: Documents + graphs + key-value
- **AQL**: Unified query language
- **Enterprise**: Clustering, replication, security
- **Flexible**: Schema-free with optional validation

## Why Consider ArangoDB

- Graph operations + document storage
- Single database for mixed workloads
- Joins across models
- Strong consistency

## Query Language

AQL (ArangoDB Query Language):

```aql
// Graph traversal
FOR v, e, p IN 1..3 OUTBOUND 'persons/alice' knows
  RETURN v.name

// With filtering
FOR v IN 1..5 OUTBOUND 'persons/alice' GRAPH 'social'
  FILTER v.tags ANY == 'researcher'
  RETURN v

// Shortest path
FOR v IN OUTBOUND SHORTEST_PATH 'persons/alice' TO 'persons/charlie' knows
  RETURN v.name
```

## Tradeoffs vs Neo4j

| Aspect | ArangoDB | Neo4j |
|--------|----------|-------|
| Data model | Multi-model | Graph-only |
| Query language | AQL | Cypher |
| Graph focus | One of many | Primary |
| Ecosystem | Smaller | Largest |
| Flexibility | Higher | Lower |

## When ArangoDB Fits

- Need documents AND graphs
- Mixed workload (some graph, some document)
- Want single database for everything
- AQL preference over Cypher

## Roadmap

Evaluation candidate for Phase 4 (Additional Stores). Lower priority than Neo4j.

## Related

- [[StoreProvider]] — Interface it would implement
- [[Neo4j]] — Primary enterprise alternative
- [[SurrealDB]] — Lighter multi-model option
- [[Amazon Neptune]] — Cloud alternative
