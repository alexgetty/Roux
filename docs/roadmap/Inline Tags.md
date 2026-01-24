---
type: Roadmap Feature
status: Proposed
priority: Medium
phase: Post-MVP
parent: "[[DocStore]]"
---

# Feature - Inline Tags

Parse `#tag` syntax in markdown content.

## Summary

Recognize Obsidian-style inline tags in addition to frontmatter YAML tags.

## Current State

MVP: Tags from frontmatter YAML only.
```yaml
---
tags: [project, important]
---
```

Content like `This is #important` is treated as plain text.

## Proposed

Parse inline `#tag` patterns and merge into node's tag array.

```markdown
---
tags: [project]
---

This is an #important note about #algorithms.
```

Results in: `tags: ["project", "important", "algorithms"]`

## Edge Cases

- Nested tags: `#parent/child` — flatten or preserve hierarchy?
- Code blocks: Don't parse `#include` in code
- URLs: Don't parse `https://example.com#anchor`
- Escaped: `\#notag` should not be parsed

## Implementation

- Regex scan of content (outside code blocks)
- Merge with frontmatter tags (dedupe)
- Store unified array in SQLite

## Complexity

Medium — parsing is tricky, edge cases matter.

## References

- [[DocStore#Tags]] — Current implementation
- [[decisions/MVP Scope Clarifications]] — Deferred decision
