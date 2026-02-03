---
id: tjpxFoJE0zj8
title: Ghost Embedding Quality Monitoring
tags:
  - roadmap
  - ghost-nodes
  - semantic-search
---
# Ghost Embedding Quality Monitoring

Ghost nodes are embedded by title only (e.g., "API", "TODO"), which produces lower-dimensional semantic representations compared to full document embeddings.

## Current Behavior

```typescript
const textToEmbed = node.content ?? node.title;
```

Ghosts with short titles may pollute semantic search results because their embeddings have less semantic signal.

## Potential Solutions

1. **Penalty weight in search ranking**: Reduce ghost node scores by a configurable factor
2. **Ghost exclusion flag**: Add `excludeGhosts` option to semantic search
3. **Minimum title length threshold**: Don't embed ghosts with very short titles (< 3 words)
4. **Title augmentation**: Prefix ghost titles with context like "Missing page: {title}"

## Decision

Monitor for search pollution in real usage. If users report irrelevant ghost results, implement option 1 or 2.

## Related

- [[Ghost Nodes for Dangling Wikilinks]]
