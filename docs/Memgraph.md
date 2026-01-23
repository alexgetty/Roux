# Memgraph

Standalone in-memory graph database. [[StoreProvider]] implementation for high-speed graph operations.

## Overview

Memgraph is an in-memory graph database optimized for real-time analytics and fast traversals. Data lives in RAM with optional persistence.

## Characteristics

- **In-memory**: Extremely fast reads
- **Cypher**: Standard query language
- **Streaming**: Built-in stream processing
- **MAGE**: Graph algorithm library

## Why Consider Memgraph

- Fastest traversals of standalone options
- Real-time analytics built-in
- Cypher compatibility (Neo4j migration path)
- Good for hot data / active graphs

## Query Language

Cypher—same as [[FalkorDB]] and [[Neo4j]]:

```cypher
// All standard Cypher works
MATCH (a:Person)-[:KNOWS*1..3]-(b:Person)
WHERE a.name = 'Alice'
RETURN DISTINCT b.name
```

## MAGE Algorithms

Built-in graph algorithms:
- PageRank
- Betweenness centrality
- Community detection
- Shortest paths

These map well to [[StoreProvider]] operations like `getHubs`.

## Tradeoffs

| Aspect | Memgraph | FalkorDB | Neo4j |
|--------|----------|----------|-------|
| Storage | In-memory | In-memory + disk | Disk + cache |
| Speed | Fastest | Fast | Fast |
| Data durability | Optional | Yes | Yes |
| RAM requirements | High | Moderate | Lower |

## Use Case Fit

Best for:
- Frequently accessed graphs
- Real-time traversal requirements
- Analytics workloads
- Graphs that fit in RAM

Not ideal for:
- Large cold data
- Cost-sensitive deployments
- Infrequent access patterns

## Roadmap

Evaluation candidate for Phase 4 (Additional Stores).

## Related

- [[StoreProvider]] — Interface it would implement
- [[FalkorDB]] — Alternative Cypher-based DB
- [[SurrealDB]] — Alternative standalone DB
- [[Neo4j]] — Enterprise alternative
