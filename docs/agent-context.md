---
title: Agent Context
tags:
  - agent
  - context
  - rules
---
# Agent Context

**MANDATORY: Include this document's contents in every agent spawn.**

This is the critical subset of project rules that agents must follow. The full rules live in `CLAUDE.md` and `docs/TDD.md`, but agents don't automatically receive that context.

## TDD Requirements

**Strict TDD. No exceptions.**

> **STOP. Before you edit any file in `src/`, ask yourself:**
> 1. Have I written or modified a test in `tests/` for this change?
> 2. Did I run that test and watch it fail?
>
> If the answer to either is "no", you are violating TDD. Step back. Write the test first.

### Rules

- Never write implementation code without a failing test first
- Red → Green → Refactor. Always.
- **100% coverage required. No untested code ships.**
- No flaky tests. A test that sometimes passes and fails is broken.
- **Never loosen tests to make code pass.** Fix the code or fix a genuinely broken test.

### Workflow

1. Write a failing test that asserts expected behavior
2. Run the test — confirm it fails (red)
3. Write the minimum implementation to pass
4. Run the test — confirm it passes (green)
5. Refactor if needed, keeping tests green

### Test Coverage Standards

- **Exhaustive coverage for type guards**: If a type guard checks N conditions, there must be N tests verifying each condition causes failure when violated
- **Parameterized tests for method validation**: When validating interfaces with multiple methods, use `it.each()` to cover all methods systematically
- **No spot-checking**: Testing 3 of 16 methods is insufficient. Test all of them.

## Code Style

- **Comments**: Only when adding information invisible to the code itself
- **Single source of truth**: Every type/constant has exactly one canonical definition
- **Graceful degradation**: Features that fail should degrade, not crash

## Git

- NEVER commit unless explicitly asked
- NEVER add Claude attribution to commits

## Documentation

When changing behavior, update:
- MCP tool schemas if tool behavior changes
- Type definitions and JSDoc comments
- Architecture docs in `docs/` if documented behavior changes
