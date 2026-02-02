---
id: 8OS4c5VQOhuc
title: audit-mcp-server-test
tags:
  - test-audit
  - mcp
  - issue
status: open
severity: mixed
component: MCP
phase: current
---
# Test Audit: mcp/server.test.ts

> **Consolidated into:** [[consolidated-error-propagation-gaps]], [[consolidated-mock-quality]]

## Summary

The `server.test.ts` file covers core MCP server functionality but has significant gaps in edge case coverage, relies on fragile SDK mocking patterns, and lacks tests for error paths.

## Findings

### [HIGH] No Test for dispatchTool Throwing Non-McpError

**Problem:** `dispatchTool` can throw non-Error types (string, undefined) but these aren't tested through the full error path.

---

### [HIGH] Mock Store Missing `nodesExist` Default Behavior

**Problem:** The mock always returns empty Map regardless of input.

---

### [MEDIUM] No Test for Server Capabilities Object

**Problem:** The server's capability configuration isn't verified.

---

### [MEDIUM] VERSION Import Not Tested

**Problem:** `VERSION` is passed to Server but never verified.

---

### [MEDIUM] close() Test Only Verifies No Throw

**Problem:** Doesn't verify `server.close()` was actually called on underlying SDK Server.

---

### [MEDIUM] TOOL_SCHEMAS Maximum Values Not Tested

**Problem:** Maximum constraints in schemas aren't tested.
