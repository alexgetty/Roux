---
title: SanitizeFilename Edge Cases
tags:
  - issue
  - mcp
  - testing
---
# SanitizeFilename Edge Cases

## Problem

**Location:** `tests/unit/mcp/handlers.test.ts:853-891`

Tests verify `'!!!'` → `'untitled'` and spaces → hyphens, but missing edge cases.

## Untested Cases

| Input | Expected | Tested |
|-------|----------|--------|
| `'!!!'` | `'untitled'` | ✓ |
| `'!!!hello'` | `'hello'` | ✗ |
| `'hello!!!'` | `'hello'` | ✗ |
| `'---'` | `'untitled'` | ✗ |
| `'--hello--'` | `'hello'` | ✗ |

## Suggested Tests

```typescript
it('strips leading special characters', () => {
  expect(sanitizeFilename('!!!hello')).toBe('hello');
});

it('strips trailing special characters', () => {
  expect(sanitizeFilename('hello!!!')).toBe('hello');
});

it('returns untitled for all-hyphen input', () => {
  expect(sanitizeFilename('---')).toBe('untitled');
});

it('strips leading and trailing hyphens', () => {
  expect(sanitizeFilename('--hello--')).toBe('hello');
});
```

## References

- Red team round 5 #3
- Red team round 7 #4
