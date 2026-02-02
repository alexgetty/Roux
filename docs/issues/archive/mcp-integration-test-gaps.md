---
id: Hum72w9L2nbb
title: MCP Integration Test Gaps
tags:
  - issue
  - mcp
  - testing
  - integration
type: '[[Test Gap]]'
priority: Medium
component: '[[MCP]]'
status: open
---
# MCP Integration Test Gaps

Missing integration tests for MCP handlers.

## 1. No Integration for list_nodes, resolve_nodes, nodes_exist

**Location:** `tests/integration/mcp/handlers.integration.test.ts`

Unit tests exist but no real-filesystem integration coverage for these newer tools.

## 2. Delete Chain Not Verified End-to-End

**Location:** `tests/unit/mcp/handlers.test.ts:676-699`

`handleDeleteNode` tests use mocked `core.deleteNode`. No integration test verifies full chain: handler → core → store → vectorProvider.delete.

**Fix:** Add integration test that creates node with embedding, deletes via handler, verifies embedding actually gone.

## 3. 60s Warmup Timeout Without Validation

**Location:** `tests/integration/mcp/handlers.integration.test.ts`

`beforeAll` warmup doesn't assert model loaded correctly. Failed load would cascade as confusing errors.

## ~~4. handleListNodes Total Bug~~ ✅ FIXED

~~Returns `total: nodes.length` which is returned count, not total matching nodes pre-pagination.~~

**Fixed:** Already resolved in commit `ffee09c`. Integration tests added verifying total with limit, tag filter, and path filter.

## References

- Red team round 3 #7
- Red team round 10
