---
type: Roadmap Feature
status: Proposed
priority: Low
phase: Post-MVP
parent: "[[CLI]]"
---

# Feature - Viz Theme

Light/dark theme option for `roux viz` command.

## Summary

Currently `roux viz` generates HTML with a hardcoded dark theme. Add `--theme` flag for light mode.

## Current State

Dark theme only:
- Background: `#1a1a2e`
- Nodes: `#0f4c75` with `#3282b8` stroke
- Links: `#4a4a6a`
- Text: `#e0e0e0`

## Proposed

```bash
roux viz                  # Default (dark)
roux viz --theme dark     # Explicit dark
roux viz --theme light    # Light mode
```

## Implementation

- Add `--theme` flag to viz command
- Create light theme color palette
- Pass theme to `generateHtml()` function

Light theme colors (suggested):
- Background: `#ffffff`
- Nodes: `#4a90d9` with `#2563eb` stroke
- Links: `#94a3b8`
- Text: `#1f2937`

## Complexity

Low — CSS variable swap, one new CLI flag.

## References

- [[CLI#Visualization]] — Viz command spec
- Phase 10 red-team audit (2026-01-24)
