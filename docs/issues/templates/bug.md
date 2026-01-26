---
title: Bug
tags:
  - issue-template
---
# Bug

Defect in existing functionality. Something that worked (or should work) doesn't.

## Agent Instructions

### 1. Reproduce
- Read the issue description and identify reproduction steps
- Confirm the bug exists in current code
- Note exact error messages, stack traces, or unexpected behavior

### 2. Write Failing Test
- Create a test that captures the bug
- Test MUST fail before your fix
- Test should be minimal — isolate the exact failure

### 3. Fix
- Make the smallest change that fixes the bug
- Don't refactor surrounding code
- Don't fix adjacent issues you notice

### 4. Verify
- Run the new test — must pass
- Run full test suite — no regressions
- Manual verification if the test can't capture all aspects

### 5. Check for Variants
- Search for similar patterns in codebase
- If the bug could exist elsewhere, note it (new issue) but don't fix in same PR

## Completion Criteria
- [ ] Failing test exists that reproduces the bug
- [ ] Test passes after fix
- [ ] Full test suite passes
- [ ] No unrelated changes in diff
