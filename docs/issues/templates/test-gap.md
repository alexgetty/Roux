---
title: Test Gap
tags:
  - issue-template
---
# Test Gap

Missing test coverage for existing functionality. Code works but isn't verified.

## Agent Instructions

### 1. Identify Scope
- Read the issue to understand what's untested
- Locate the code in question
- Understand the expected behavior from code/docs

### 2. Enumerate Cases
- List all code paths that need coverage
- Include happy path, edge cases, error conditions
- Check for boundary conditions (empty, null, max values)

### 3. Write Tests
- One test per behavior, not per code path
- Tests should document intent — future reader learns expected behavior
- Use descriptive test names: `should reject negative limit`

### 4. Verify Coverage
- Run coverage report on the specific file
- Confirm new tests hit previously uncovered lines
- Don't chase 100% if remaining lines are trivial (type guards, etc.)

### 5. No Implementation Changes
- If tests reveal a bug, file a separate [[Bug]] issue
- Don't fix bugs discovered during test gap work
- Exception: obvious typos in error messages

## Completion Criteria
- [ ] All code paths identified in issue are now tested
- [ ] Tests are meaningful (not just line coverage)
- [ ] No implementation changes
- [ ] Coverage increased for target file(s)
