# Amazon Neptune

Enterprise cloud graph database. [[StoreProvider]] implementation for AWS-native deployments.

## Overview

Amazon Neptune is a managed graph database service on AWS. Supports both property graphs (Gremlin/openCypher) and RDF (SPARQL).

## Characteristics

- **Managed**: AWS handles operations
- **Multi-query**: Gremlin, openCypher, SPARQL
- **Enterprise**: HA, replication, encryption
- **AWS-native**: Integrates with AWS services

## Why Consider Neptune

- Already on AWS
- Need managed operations
- Compliance requirements (SOC, HIPAA)
- Integration with AWS analytics (S3, Glue, SageMaker)

## Query Languages

**openCypher** (recommended for Roux):
```cypher
MATCH (a:Person)-[:KNOWS*1..3]-(b:Person)
WHERE a.name = 'Alice'
RETURN DISTINCT b.name
```

**Gremlin**:
```groovy
g.V().has('name', 'Alice')
  .repeat(out('knows')).times(3)
  .dedup()
  .values('name')
```

## Tradeoffs vs Self-Hosted Neo4j

| Aspect | Neptune | Neo4j (Self-hosted) |
|--------|---------|---------------------|
| Operations | Managed | You manage |
| Cost model | Pay per use | Infrastructure cost |
| Customization | Limited | Full control |
| AWS integration | Native | Manual |
| Query language | Gremlin/openCypher | Cypher |

## Cost Considerations

- Instance hours
- I/O operations
- Storage
- Data transfer

Can be expensive for development/testing. Consider [[FalkorDB]] or [[Memgraph]] for non-production.

## Roadmap

Evaluation candidate for enterprise deployments. Not part of core roadmap unless specific need emerges.

## Related

- [[StoreProvider]] — Interface it would implement
- [[Neo4j]] — Primary enterprise alternative
- [[ArangoDB]] — Multi-model enterprise alternative
