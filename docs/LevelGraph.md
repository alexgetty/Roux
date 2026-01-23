# LevelGraph

Embedded graph library. [[StoreProvider]] implementation using LevelDB.

## Overview

LevelGraph is a graph database built on LevelDB. It provides native graph operations without external servers, sitting between SQLite (relational) and full graph databases (infrastructure).

## Characteristics

- **Embedded**: No server, runs in-process
- **Graph-native**: Triple store with graph operations
- **Persistent**: Data survives restarts
- **Lightweight**: Minimal resource usage

## Why Consider LevelGraph

- Native graph queries (not SQL + application logic)
- No infrastructure overhead
- Good for moderate scale (~50-100K triples)
- JavaScript ecosystem native

## Tradeoffs

| Aspect | LevelGraph | SQLiteStore | Neo4j |
|--------|------------|-------------|-------|
| Query model | Triples | SQL | Cypher |
| Graph-native | Yes | No | Yes |
| Infrastructure | None | None | Server |
| Scale | Moderate | Moderate | High |
| Ecosystem | Smaller | Large | Large |

## Triple Store Model

Data stored as subject-predicate-object triples:
```
(alice, knows, bob)
(alice, worksAt, acme)
(bob, knows, charlie)
```

Query: "Who does alice know?"
```javascript
db.get({ subject: 'alice', predicate: 'knows' }, callback);
```

## Roadmap

Evaluation candidate for Phase 4. May or may not be implemented based on SQLiteStore experience.

## Related

- [[StoreProvider]] — Interface it would implement
- [[SQLiteStore]] — Alternative embedded option
- [[DocStore]] — Alternative file-based option
