---
id: BsUtp1boiXsH
title: mcp-server-inline-schemas
tags:
  - critical
  - modularity
  - refactor
---
# MCP Server Inline Schemas

**Severity:** Critical  
**Location:** `src/mcp/server.ts`  
**Lines:** 516

## Problem

`TOOL_SCHEMAS` is 290 lines of JSON Schema definitions inline with server logic. Schema definitions dominate the file while the server class itself is only ~80 lines.

## Specific Violations

- Lines 33-321: Schema definitions dominate the file
- Schema and handler definitions are divorced — schemas here, handlers in `handlers.ts`
- Changes to tool behavior require editing two distant files

## Recommended Fix

Option A: Move to `mcp/schemas.ts` — separate file for all schemas

Option B: Co-locate with handlers — each handler module exports its schema

Option B is preferred as it keeps schema and implementation together.

## Verification

After refactor:
- `server.ts` under 150 lines
- Schemas live adjacent to their handlers
- Adding a new tool only touches one location
