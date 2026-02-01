---
title: Script Extensions
tags:
  - roadmap
type: Feature
status: Planned
priority: P2
effort: L
phase: Post-MVP
category: CLI & Visualization
---
# Feature - Script Extensions

Project-level custom scripts exposed as MCP tools, CLI commands, and API endpoints.

## Summary

Enable users to register custom Node/JS scripts that extend Roux with project-specific functionality. Scripts run in-process with permission-scoped access to the graph API.

## Use Cases

- **Validators**: Check markdown against formatting rules before writes
- **Aggregators**: Compute derived values across tagged documents
- **Transformers**: Normalize content structure
- **Analyzers**: Generate reports from graph data

## Architecture

Scripts are Node modules that export a standard interface:

```typescript
import type { ScriptContext, ScriptResult } from 'roux';

export const meta: ScriptMeta = {
  name: 'validate-recipe',
  description: 'Check recipe markdown against formatting rules',
  permissions: ['read', 'validate'],
  args: { strict: { type: 'boolean', default: false } }
};

export async function execute(ctx: ScriptContext): Promise<ScriptResult> {
  const node = await ctx.getNode(ctx.targetId);
  if (missingField) return ctx.warn('Missing required field');
  return ctx.approve();
}
```

## Configuration

```yaml
# roux.yaml
scripts:
  path: scripts/
  definitions:
    - name: validate-recipe
      entry: ./validate-recipe.ts
      permissions: [read, validate]
```

## Permission Model

| Permission | Grants |
|------------|--------|
| `read` | search, get_node, get_neighbors, etc. |
| `write` | create_node, update_node, delete_node |
| `validate` | Called before writes; can approve/reject/warn |

## Validation Queue

When validation scripts reject or warn, writes are queued for user confirmation:

- Queued writes stored in `.roux/pending-writes/{uuid}.json`
- User must explicitly confirm or cancel
- Never auto-overwrite on validation failure

## Exposure

- **MCP**: Each script becomes `script_{name}` tool with typed args
- **CLI**: `roux script <name> [--args]`
- **API**: `POST /scripts/{name}` (when REST API implemented)

## Implementation Phases

1. **Core**: Types, loader, executor with permission-scoped context
2. **MCP**: Dynamic tool registration, dispatch handling
3. **Queue**: Pending writes, confirm/cancel tools
4. **CLI**: `roux script` and `roux queue` commands

## Dependencies

- [[GraphCore]] (for API access)
- [[MCP Server]] (for tool registration)
- [[CLI]] (for command integration)

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Runtime | Node/JS | Same process, direct API, no IPC |
| Location | `scripts/` | Convention over configuration |
| Tool exposure | One per script | Better LLM discoverability |
| Validation failure | Queue write | User always decides |

## References

- [[MCP Server#Dynamic Tools]] — Tool registration pattern
- [[Provider Lifecycle]] — Capability-based exposure
