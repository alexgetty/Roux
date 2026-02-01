---
title: Rest Api
tags:
  - roadmap
type: Feature
status: Proposed
priority: P3
effort: L
phase: Future
category: External APIs
---
# Feature - REST API

HTTP REST interface as alternative to MCP.

## Summary

Expose graph operations via standard REST endpoints.

## Current State

MVP: MCP only (stdio transport).

## Use Cases

- **Web apps:** Browser-based graph explorer
- **Integrations:** Zapier, webhooks, custom scripts
- **Non-MCP clients:** Any HTTP client

## Proposed

```
GET    /nodes/:id
GET    /nodes/:id/neighbors
POST   /nodes
PUT    /nodes/:id
DELETE /nodes/:id
GET    /search?q=...
GET    /tags
GET    /hubs?metric=in_degree
```

## Implementation

- HTTP framework (Express, Fastify, Hono)
- Reuse GraphCore operations
- JSON responses matching MCP shapes
- OpenAPI spec generation

## Authentication

- API key header for simple auth
- Optional OAuth for multi-user

## Complexity

Medium — straightforward REST wrapper around existing operations.

## References

- [[API]] — Interface options discussion
- [[MVP#Out of Scope]] — REST/GraphQL API listed
