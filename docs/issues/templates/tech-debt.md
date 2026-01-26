---
title: Tech Debt
tags:
  - issue-template
---
# Tech Debt

Code that works but is suboptimal. Refactoring, cleanup, or architectural improvements.

## Agent Instructions

### 1. Understand Current State
- Read the code identified in the issue
- Understand WHY it's debt (fragility, duplication, poor abstraction)
- Identify all callers/dependents

### 2. Define Target State
- What should the code look like after?
- Is this a rename, restructure, or rewrite?
- Confirm the target doesn't change external behavior

### 3. Ensure Test Coverage First
- Run existing tests — they're your safety net
- If coverage is insufficient, file a [[Test Gap]] issue first
- Don't refactor untested code

### 4. Incremental Changes
- Small commits, each passing tests
- Rename → move → restructure (not all at once)
- Use IDE refactoring tools when possible

### 5. Update Documentation
- If public API changes, update docs
- If internal patterns change, update code comments
- Remove outdated comments that no longer apply

## Completion Criteria
- [ ] All tests pass (no new tests needed unless behavior changes)
- [ ] Code matches target state from issue
- [ ] No behavior changes (unless explicitly part of debt)
- [ ] Related docs updated
