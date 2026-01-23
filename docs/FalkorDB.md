# FalkorDB

Standalone graph database. [[StoreProvider]] implementation for graph-native storage.

## Overview

FalkorDB (formerly RedisGraph) is a property graph database. It provides Cypher queries and native graph operations at moderate infrastructure cost.

## Characteristics

- **Graph-native**: Property graph model
- **Cypher**: Industry-standard query language
- **Fast**: In-memory with persistence
- **Standalone**: Single server operation

## Why Consider FalkorDB

- Same query language as Neo4j (Cypher)
- Lower infrastructure than Neo4j cluster
- Native graph operations
- Good migration path to Neo4j if needed

## Query Language

Cypher—the graph query standard:

```cypher
// Create nodes
CREATE (a:Person {name: 'Alice', tags: ['researcher']})

// Create edges
MATCH (a:Person {name: 'Alice'}), (b:Person {name: 'Bob'})
CREATE (a)-[:KNOWS]->(b)

// Traversal
MATCH (a:Person {name: 'Alice'})-[:KNOWS]->(friend)
RETURN friend

// Path finding
MATCH path = shortestPath((a:Person)-[:KNOWS*]-(b:Person))
WHERE a.name = 'Alice' AND b.name = 'Charlie'
RETURN path
```

## Tradeoffs

| Aspect | FalkorDB | SurrealDB | Neo4j |
|--------|----------|-----------|-------|
| Query language | Cypher | SurrealQL | Cypher |
| Infrastructure | Single server | Single server | Cluster |
| Scale | Moderate | Moderate | High |
| Migration to Neo4j | Easy | Harder | N/A |

## Roadmap

Evaluation candidate for Phase 4 (Additional Stores).

## Related

- [[StoreProvider]] — Interface it would implement
- [[SurrealDB]] — Alternative standalone DB
- [[Memgraph]] — Alternative in-memory graph
- [[Neo4j]] — Enterprise alternative (same query language)
