---
title: MCP Contract Violations Audit
tags:
  - Issue
  - red-team
  - mcp
  - audit
---
# MCP Contract Violations Audit

Red-team audit of contract mismatches between what MCP exposes vs. what underlying modules provide.

**Audit date:** 2026-01-25

---

## ~~Critical: `get_hubs` Metric Enum Mismatch~~ RESOLVED

Handler `VALID_METRICS` updated to match schema - both now only allow `in_degree` and `out_degree`.

---

## ~~High: `list_nodes` Path Filter Case Sensitivity~~ RESOLVED

Fixed — `LOWER()` applied to both sides of `LIKE` in `cache.ts`. Test added.

---

## ~~High: `searchByTags` Limit Not Passed to Store~~ RESOLVED

Fixed — `limit` now flows from handler → GraphCore → DocStore → Cache SQL `LIMIT ?` clause. No in-memory truncation.

---

## Medium (Logged to docs/issues/)

- `update_node` title schema says "renames file" but doesn't → `mcp-updatenode-title-rename-mismatch.md`
- `create_node` ID transformation undocumented → `mcp-createnode-id-transformation-undocumented.md`  
- `resolve_nodes` exact strategy threshold behavior unclear → `mcp-resolvenodes-exact-strategy-threshold-confusion.md`

## Low (No Action)

- Neighbor fetch duplication (inefficiency, not correctness)
- Search score approximation (documented behavior)
