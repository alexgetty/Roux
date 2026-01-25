---
type: Issue
severity: Low
component: MCP, Documentation
phase: Resolution
---

# Semantic vs Fuzzy Strategy Confusion

## Problem

Users expect `semantic` strategy to handle typos. It doesn't — embeddings encode meaning, not spelling.

**Reproduction:**
```json
{
  "names": ["garlic", "onyon", "chikken"],
  "strategy": "semantic"
}
```

**Result:**
- "garlic" → garlic.md (score: 1.0) ✓
- "onyon" → null (score: 0) ✗
- "chikken" → null (score: 0) ✗

**User expectation:** Typos should fuzzy-match via embedding similarity.

## Root Cause

This is working as designed. The confusion is conceptual:

| Strategy | What it matches | Best for |
|----------|-----------------|----------|
| `exact` | Case-insensitive title equality | Known exact names |
| `fuzzy` | String similarity (Dice coefficient) | Typos, pluralization, partial matches |
| `semantic` | Meaning similarity (cosine on embeddings) | Synonyms, related concepts, natural language |

"onyon" isn't a real word — the embedding model produces garbage vectors. The 0.7 threshold correctly rejects it.

**Fuzzy would work:**
```json
{
  "names": ["onyon", "chikken"],
  "strategy": "fuzzy"
}
```
- "onyon" → onion.md (high Dice similarity)
- "chikken" → chicken.md or chicken thigh.md

## Impact

User confusion. Not a bug, but documentation gap leads to incorrect strategy selection.

## Suggested Fix

Document strategy selection guidance in MCP Tools Schema:

> **When to use each strategy:**
> - `exact`: You know the exact title (case-insensitive)
> - `fuzzy`: User input with potential typos, abbreviations, or slight variations
> - `semantic`: Natural language queries, synonyms, or conceptually related terms
>
> **Example:** "chikken" → use `fuzzy`. "poultry leg meat" → use `semantic`.

## References

- Field report from Eldhrímnir vault testing (2026-01-24)
- `src/core/graphcore.ts:190-235` (semantic implementation)
- `src/providers/docstore/cache.ts:305-332` (fuzzy implementation)
