---
id: KVfTufD_GNOj
title: Fragment Links
tags:
  - roadmap
type: Feature
status: Proposed
priority: P3
effort: M
phase: Post-MVP
category: Graph & Links
---
# Feature - Fragment Links

Support heading and block-level link targets.

## Summary

Enable `[[Note#Heading]]` and `[[Note#^blockid]]` to resolve to specific locations within a note.

## Current State

MVP strips fragments silently. `[[Note#Heading]]` resolves to `Note`, ignoring `#Heading`.

## Proposed

### Heading Links
```markdown
[[GraphCore#Provider Registration]]
```
Resolves to the "Provider Registration" heading in GraphCore.md.

### Block Links
```markdown
[[GraphCore#^abc123]]
```
Resolves to a specific block with ID `^abc123`.

## Implementation

### Parsing
- Extract fragment from link syntax
- Store as separate field: `{ target: "graphcore", fragment: "provider-registration" }`

### Resolution
- Heading: Slugify heading text, match against parsed headings
- Block: Match `^blockid` pattern in content

### MCP Response
Include fragment in response for client-side navigation:
```json
{
  "id": "notes/graphcore.md",
  "fragment": "provider-registration",
  "title": "GraphCore"
}
```

## Complexity

Low-Medium — parsing is simple, resolution requires heading extraction.

## References

- [[Wiki-links#Fragment Syntax]] — Syntax definition
- [[decisions/MVP Scope Clarifications]] — Strip silently for MVP
- [[decisions/Node Identity]] — Fragment handling
