# SurrealDB

Standalone multi-model database. [[StoreProvider]] implementation for moderate scale.

## Overview

SurrealDB is a multi-model database supporting documents, graphs, and relational data in one system. It offers graph operations without the infrastructure complexity of enterprise databases.

## Characteristics

- **Multi-model**: Documents + graphs + relations
- **Standalone**: Single server, moderate ops
- **Graph-native**: Built-in graph traversal
- **Modern**: WebSocket, real-time subscriptions

## Why Consider SurrealDB

- Graph operations without Neo4j complexity
- Single server, not cluster
- Good for 100K-1M node range
- Flexible schema

## Query Language

SurrealQL—SQL-like with graph extensions:

```sql
-- Create nodes
CREATE person:alice SET name = 'Alice', tags = ['researcher'];

-- Create edges
RELATE person:alice->knows->person:bob;

-- Graph traversal
SELECT ->knows->person FROM person:alice;

-- Path finding
SELECT * FROM person:alice->knows->*->knows WHERE id = person:charlie;
```

## Tradeoffs

| Aspect | SurrealDB | SQLiteStore | Neo4j |
|--------|-----------|-------------|-------|
| Infrastructure | Single server | None | Cluster |
| Scale | 100K-1M | ~100K | Millions |
| Query language | SurrealQL | SQL | Cypher |
| Graph-native | Yes | No | Yes |

## Roadmap

Evaluation candidate for Phase 4 (Additional Stores).

## Related

- [[StoreProvider]] — Interface it would implement
- [[FalkorDB]] — Alternative standalone graph DB
- [[Memgraph]] — Alternative in-memory graph
- [[Neo4j]] — Enterprise alternative
