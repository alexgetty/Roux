---
type: Issue
priority: Low
component: CLI
status: open
title: Init Malformed Json Test Gap
tags:
  - issue
  - cli
  - testing
severity: Medium
phase: MVP
---

# Init Malformed JSON Test Gap

## Problem

`src/cli/commands/init.ts:67-71` silently recovers from malformed `.mcp.json`. Behavior is intentional but untested.

## Impact

If error handling regresses, init could throw instead of recovering gracefully.

## Suggested Fix

```typescript
it('handles malformed .mcp.json gracefully', async () => {
  const mcpPath = join(testDir, '.mcp.json');
  await writeFile(mcpPath, '{ invalid json', 'utf-8');

  await initCommand(testDir);

  const content = await readFile(mcpPath, 'utf-8');
  const config = JSON.parse(content);
  expect(config.mcpServers.roux).toBeDefined();
});
```

## References

- Red-team audit (2026-01-24)
