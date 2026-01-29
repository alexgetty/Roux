---
type: Enhancement
status: Proposed
priority: P3
effort: S
phase: Post-MVP
category: Infrastructure
---
## Category: Roadmap

## Observation

ID normalization happens in multiple places:
- `src/providers/docstore/parser.ts:normalizeId()` - main normalization function
- `src/providers/docstore/index.ts:normalizeWikiLink()` - inline normalization for wiki links

Both do similar work (lowercase, forward slashes) but `normalizeWikiLink` also handles extension addition.

## Consideration

Consider consolidating all ID normalization to a single module with clear functions:
- `normalizeId(path)` - for file paths
- `normalizeWikiLink(target)` - for wiki link targets (calls normalizeId + extension logic)

This would make the normalization contract clearer and easier to maintain.
