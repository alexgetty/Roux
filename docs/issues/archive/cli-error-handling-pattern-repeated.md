---
title: CLI Error Handling Pattern Repeated
tags:
  - dry
  - medium-priority
  - refactor
---
## Priority: MEDIUM

## Problem

The CLI error output pattern is repeated verbatim 3 times.

## Location

`src/cli/index.ts:58-63, 106-111, 146-149`

## Evidence

```typescript
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Unknown error'
  );
  process.exit(1);
}
```

This exact block appears in `status`, `serve`, and `viz` command handlers.

## Fix

Extract to utility:

```typescript
function handleCliError(error: unknown): never {
  console.error(error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
}
```

## Verification

CLI commands still exit with code 1 on error.
