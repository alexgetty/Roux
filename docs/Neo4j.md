# Neo4j

Enterprise graph database. [[StoreProvider]] implementation for production scale.

## Overview

Neo4j is the industry standard for graph databases. Native graph storage, Cypher query language, and proven scale to billions of nodes.

## Characteristics

- **Native graph**: Storage and processing optimized for graphs
- **Cypher**: The graph query language standard
- **Enterprise-ready**: Clustering, replication, security
- **Ecosystem**: Largest graph database ecosystem

## Why Neo4j

- Proven at massive scale
- Best tooling (Browser, Bloom, GDS)
- Most mature Cypher implementation
- Production-hardened

## When to Upgrade

From [[DocStore]] or [[SQLiteStore]] to Neo4j when:
- Node count exceeds 100K
- Complex traversal queries are slow
- Need clustering / high availability
- Need enterprise security features

## Query Language

Cypher—the standard:

```cypher
// Complex traversal
MATCH (a:Person)-[:KNOWS*1..5]-(b:Person)
WHERE a.name = 'Alice' AND b.name = 'Charlie'
RETURN DISTINCT nodes(path)

// Graph algorithms (GDS)
CALL gds.pageRank.stream('myGraph')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).name, score
ORDER BY score DESC
LIMIT 10
```

## Graph Data Science (GDS)

Neo4j's algorithm library:
- Centrality (PageRank, betweenness, closeness)
- Community detection (Louvain, Label Propagation)
- Path finding (Dijkstra, A*, Yen's K)
- Similarity (Jaccard, cosine, overlap)

Maps directly to [[AnalyticsProvider]] and [[StoreProvider]] operations.

## Infrastructure

- **AuraDB**: Managed cloud service
- **Self-hosted**: Single server or cluster
- **Desktop**: Local development

## Roadmap

Phase 2 deliverable. Migration tooling from DocStore → Neo4j.

## Related

- [[StoreProvider]] — Interface it implements
- [[DocStore]] — MVP store to migrate from
- [[FalkorDB]] — Lighter Cypher-compatible option
- [[Amazon Neptune]] — Enterprise cloud alternative
- [[ArangoDB]] — Enterprise multi-model alternative
