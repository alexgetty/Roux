---
type: Feature
status: Proposed
priority: P3
effort: M
phase: Future
category: Storage & Providers
---

# Multi-Filetype Support

## Context

Currently `create_node` requires `.md` extension. When we add support for other file types (`.html`, `.txt`, etc.), we'll need to revisit extension handling and disambiguation.

## Considerations

- How to handle extension inference vs explicit specification
- Content-type detection
- Parser routing based on extension
- Schema changes to `create_node`

## References

- [[Create Node API Consolidation Brief]] — Decision #2 notes this as future work
