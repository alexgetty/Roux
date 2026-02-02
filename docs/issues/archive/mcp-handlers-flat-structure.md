---
id: CR4lGrb13qM7
title: mcp-handlers-flat-structure
tags:
  - critical
  - modularity
  - refactor
---
# MCP Handlers Flat Structure

**Severity:** Critical  
**Location:** `src/mcp/handlers.ts`  
**Lines:** 537  
**Functions:** 19  
**Exports:** 20

## Problem

Flat handler dump. Every MCP tool has its own `handle*` function in one file with no grouping by concern.

## Specific Violations

- Lines 38-66: `coerceLimit`, `coerceOffset`, `coerceDepth` are validation utilities with nearly identical patterns
- Lines 159, 208, 229, 418: Validation arrays (`VALID_DIRECTIONS`, `VALID_METRICS`, `VALID_TAG_MODES`, `VALID_STRATEGIES`) scattered throughout
- Lines 286-296, 490-498: `deriveTitle` and `sanitizeFilename` are string utilities, not handlers

## Recommended Split

1. `mcp/handlers/read.ts` — search, get_node, get_neighbors, find_path, get_hubs
2. `mcp/handlers/write.ts` — create_node, update_node, delete_node
3. `mcp/handlers/query.ts` — list_nodes, resolve_nodes, nodes_exist, search_by_tags
4. `mcp/validation.ts` — coercion functions, validation constants

## Verification

After refactor:
- No handler file exceeds 200 lines
- Validation logic is centralized
- Handler dispatch still works correctly
