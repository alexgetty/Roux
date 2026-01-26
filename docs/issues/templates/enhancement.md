---
title: Enhancement
tags:
  - issue-template
---
# Enhancement

New functionality or capability. Something that doesn't exist yet.

## Agent Instructions

### 1. Clarify Requirements
- Read the issue thoroughly
- Identify acceptance criteria (explicit or implied)
- If ambiguous, ask before implementing
- Check for related issues or prior discussions

### 2. Design First
- Determine where new code belongs (which module/file)
- Identify integration points with existing code
- Consider error cases and edge conditions upfront
- For significant changes, write a brief design in the issue

### 3. TDD Implementation
- Write failing test for first acceptance criterion
- Implement minimal code to pass
- Repeat for each criterion
- Refactor only after green

### 4. Integration
- Ensure new code follows existing patterns
- Update any configuration or exports needed
- Wire up to calling code

### 5. Documentation
- Update relevant docs (API, architecture, README)
- Add JSDoc to new public functions
- Update MCP tool schemas if adding capabilities

## Completion Criteria
- [ ] All acceptance criteria met
- [ ] Tests exist for each criterion
- [ ] Full test suite passes
- [ ] Documentation updated
- [ ] No scope creep beyond issue description
