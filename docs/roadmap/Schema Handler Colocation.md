---
title: Schema Handler Colocation
tags:
  - roadmap
type: Enhancement
status: Proposed
priority: P3
effort: S
phase: Post-MVP
category: MCP Tools
---
# Schema-Handler Co-location

**Type:** Roadmap / Enhancement  
**Locations:** 
- `src/mcp/server.ts` (schemas)
- `src/mcp/handlers.ts` (handlers)

## Current State

Tool schemas live in `server.ts` (290 lines of JSON Schema), while handlers live in `handlers.ts`. They should live together or be generated from a single source of truth.

## Problem

- Adding a tool requires editing two files
- Schema and handler can drift out of sync
- Hard to see full tool definition at a glance

## Potential Patterns

### Option A: Co-located exports
```typescript
// mcp/handlers/search.ts
export const searchSchema = { ... };
export function handleSearch(core, args) { ... }
```

### Option B: Single definition object
```typescript
export const searchTool = {
  schema: { ... },
  handler: (core, args) => { ... }
};
```

### Option C: Generated from types
Use TypeScript types to generate JSON Schema, keeping single source of truth.

## Recommendation

Implement alongside [[mcp-handlers-flat-structure]] refactor. When splitting handlers into modules, co-locate schemas.
