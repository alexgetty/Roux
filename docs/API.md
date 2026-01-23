# API

REST and/or GraphQL interface for programmatic access.

## Overview

The API exposes Roux's [[GPI]] over HTTP. For web applications, services, and integrations that need programmatic access without MCP.

## Protocol Options

**REST**
- Standard HTTP verbs
- JSON responses
- Familiar to most developers

**GraphQL**
- Query exactly what you need
- Natural fit for graph data
- More complex to implement

Decision: TBD. Likely REST for MVP simplicity, GraphQL later if demand exists.

## Clients

- Web applications
- Backend services
- Custom integrations
- Automation scripts

## Endpoints (Conceptual)

```
GET  /nodes/:id           → Get node
GET  /nodes/:id/neighbors → Get neighbors
POST /nodes               → Create node
PUT  /nodes/:id           → Update node
DELETE /nodes/:id         → Delete node

GET  /search?q=...        → Semantic search
GET  /search/tags?tags=.. → Tag search
GET  /graph/path?from=&to=  → Find path
GET  /graph/hubs?metric=  → Get central nodes
```

## Authentication

TBD. Options:
- API keys (simple)
- OAuth (for user-facing apps)
- mTLS (for service-to-service)

## Roadmap

Not part of MVP. Future phase when product use cases emerge.

## Related

- [[GraphCore]] — Provides the operations
- [[GPI]] — What the API exposes
- [[MCP Server]] — Alternative interface for AI
- [[CLI]] — Alternative interface for terminal
