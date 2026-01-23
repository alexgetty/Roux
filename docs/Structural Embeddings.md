# Structural Embeddings

Research: graph-aware vectors that capture both content and position.

## Overview

Standard embeddings capture what a node *says*. Structural embeddings capture where a node *sits* in the graph. Combining both could improve retrieval for graph-structured knowledge.

## The Problem

Text embeddings are content-only:
- "Machine learning note" and "ML algorithms note" are similar
- But one might be a hub connecting 50 concepts
- The other might be an isolated leaf
- Text embeddings don't capture this difference

## Approaches

**Node2Vec**
- Random walks on graph → word2vec on paths
- Captures local and global structure
- Proven, well-understood

**GraphSAGE**
- Neural network aggregates neighbor features
- Can use content as node features
- More complex, potentially more powerful

**Hybrid**
- Content vector (from [[EmbeddingProvider]])
- Structure vector (from graph position)
- Combine at query time or pre-compute

## Open Questions

- **Approach selection**: Node2Vec vs GraphSAGE vs something else? Each has tradeoffs for different graph densities.
- **Composition**: If we have content and structure vectors separately, how do we combine? Concatenate? Weighted sum? Query-time blending?
- **Incremental updates**: When neighbors change, how do we update structural embeddings efficiently?
- **Evaluation**: How do we measure if structural embeddings actually improve retrieval?

## Experiment Design

1. Build test graph with known structure
2. Create queries that should benefit from structure (e.g., "important nodes about X")
3. Compare retrieval:
   - Content-only
   - Structure-only
   - Combined
4. Measure precision, recall, user preference

## Roadmap

Phase 1: Research. Implement after MVP proves core architecture.

## Related

- [[EmbeddingProvider]] — Interface for any embedding approach
- [[Ollama]] — Content embedding provider
- [[OpenAI]] — Content embedding provider
- [[GraphCore]] — Would coordinate structural embedding generation
