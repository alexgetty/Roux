---
priority: high
status: planned
title: MCP Discovery-Only Refactor
tags:
  - roadmap
  - priority-high
  - mcp
  - architecture
---

# Refactor MCP to Discovery-Only

## Context

LLMs consistently resist using MCP tools for markdown file operations, preferring direct Read/Write/Edit. Fighting this is counterproductive. The FileWatcher already syncs changes back to the graph, so direct file edits still work with Roux.

**New architecture:**
- MCP handles discovery and traversal (search, get_node, get_neighbors, etc.)
- LLMs read/write files directly via filesystem
- FileWatcher syncs changes back to the graph
- `get_node` returns `file_path` so LLMs know where to read

## Changes

### 1. Remove Enforcement Hook

**`src/cli/commands/init.ts`**
- Remove `ClaudeHook`, `ClaudeHookEntry`, `ClaudeSettings` interfaces
- Remove `HOOK_MARKER`, `ENFORCE_MCP_HOOK_COMMAND`, `ROUX_HOOK_ENTRY` constants
- Remove `hooksInstalled` from `InitResult` interface
- Remove hook installation logic from `initCommand`
- Remove `getStoreType` function
- Remove `updateClaudeSettings` function

**`tests/unit/cli/init.test.ts`**
- Remove entire "Claude Code hooks" describe block

### 2. Remove Write Operations from MCP

**`src/mcp/handlers.ts`**
- Remove `handleCreateNode`, `handleUpdateNode`, `handleDeleteNode` functions
- Remove from `dispatchTool` switch

**`src/mcp/server.ts`**
- Remove `create_node`, `update_node`, `delete_node` from `TOOL_SCHEMAS`
- Remove from `TOOLS` array

**`tests/unit/mcp/handlers.test.ts`**
- Remove tests for create/update/delete handlers

**`tests/integration/mcp/handlers.integration.test.ts`**
- Remove tests for create/update/delete operations

### 3. Update Response Format

**`src/mcp/types.ts`**
- Add `file_path?: string` to `NodeMetadataResponse`
- Remove `content` from `NodeResponse` (or remove `NodeResponse` entirely, use metadata only)
- Simplify `NodeWithContextResponse` (neighbors become metadata-only)
- Update `SearchResultResponse` to not extend with content

**`src/mcp/transforms.ts`**
- `nodeToResponse` → rename to `nodeToMetadataResponse`
  - Include `file_path` from `node.sourceRef?.path`
  - Truncate `properties.description` to 140 chars if present
  - No content field
- Remove content truncation logic (or simplify for description only)
- Update `nodeToContextResponse` for metadata-only neighbors

**`src/mcp/truncate.ts`**
- Simplify to only handle description truncation (140 chars)
- Or keep for backward compatibility, just unused for content

**`tests/unit/mcp/transforms.test.ts`**
- Update tests for new response format
- Add tests for `file_path` inclusion
- Add tests for description truncation

**`tests/unit/mcp/truncate.test.ts`**
- Update or simplify tests

### 4. Update Documentation

**`CLAUDE.md`**
Update "Use Roux MCP for all markdown operations" section to new workflow:

| Operation | Use This |
|-----------|----------|
| Search docs | `mcp__roux__search` |
| Find a doc | `mcp__roux__get_node` |
| Read content | `Read` (use file_path from get_node) |
| Edit content | `Edit` (FileWatcher syncs) |
| Find related | `mcp__roux__get_neighbors` |

## Files Changed

| File | Action |
|------|--------|
| `src/cli/commands/init.ts` | Remove hook code |
| `src/mcp/handlers.ts` | Remove create/update/delete |
| `src/mcp/server.ts` | Remove tool schemas |
| `src/mcp/types.ts` | Add file_path, remove content |
| `src/mcp/transforms.ts` | Add file_path, description truncation |
| `src/mcp/truncate.ts` | Simplify or keep |
| `tests/unit/cli/init.test.ts` | Remove hook tests |
| `tests/unit/mcp/handlers.test.ts` | Remove CRUD tests |
| `tests/unit/mcp/transforms.test.ts` | Update for new format |
| `tests/integration/mcp/handlers.integration.test.ts` | Remove CRUD tests |
| `CLAUDE.md` | Update MCP usage docs |

## Verification

```bash
# Run all affected tests
npm test -- tests/unit/cli/init.test.ts
npm test -- tests/unit/mcp/
npm test -- tests/integration/mcp/

# Full test suite
npm test

# Type check
npm run typecheck

# Manual verification
# 1. Start server: npx roux serve .
# 2. Call get_node via MCP inspector
# 3. Verify response has file_path, no content
# 4. Use Claude Code to read the file_path directly
```
