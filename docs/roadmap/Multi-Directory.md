---
type: Feature
status: Proposed
priority: P2
effort: L
phase: Future
category: Storage & Providers
---

# Feature - Multi-Directory

Federate multiple source directories into single graph.

## Summary

Query across multiple document directories as a unified graph.

## Current State

MVP: Single source directory configured in `roux.yaml`.

## Use Cases

- **Work + Personal:** Query both vaults together
- **Monorepo docs:** Aggregate docs from multiple packages
- **Team knowledge:** Personal notes + shared wiki

## Proposed

```yaml
sources:
  - path: ~/notes
    prefix: personal
  - path: ~/work/docs
    prefix: work
  - path: /shared/wiki
    prefix: wiki
    readonly: true
```

## ID Namespacing

Prefix prevents collisions:
- `personal/ideas.md`
- `work/ideas.md`

Cross-directory links:
- `[[personal/ideas]]` — explicit prefix
- `[[ideas]]` — resolve in current directory first, then others

## Challenges

- **Conflict resolution:** Same filename in multiple directories
- **Write routing:** Which directory for `create_node`?
- **Performance:** Multiple file watchers, larger graph

## Complexity

Medium-High — affects config, ID resolution, write operations.

## References

- [[MVP#Out of Scope]] — "Multi-directory federation" listed
- [[Config]] — Source configuration
