---
id: KCE3EPHHsm4s
title: Ghost Retention Configuration
tags:
  - roadmap
  - ghosts
  - configuration
---
# Ghost Retention Configuration

Configurable policies for orphaned ghost nodes (ghosts with zero incoming links).

## Context

Initial implementation auto-deletes orphaned ghosts. But there are interesting use cases for other behaviors.

## Options to Support

### Retain Indefinitely
- `ghostRetention: 'keep'`
- Preserves "wanted pages" signal forever
- Useful for knowledge bases where broken links are tracked as TODOs

### TTL with Warning
- `ghostRetention: { ttl: '30d', warn: true }`
- Orphaned ghosts survive for N days
- Optional warning/prompt before deletion
- Grace period for "removed a link but might add it back"

### Auto-delete (current default)
- `ghostRetention: 'delete'`
- No incoming links = immediate removal
- Keeps graph clean

## Implementation Notes

- Config lives in `roux.config.js` or `.rouxrc`
- TTL tracking requires `orphanedAt` timestamp on ghosts
- Warning system could integrate with CLI or external notifications

## Related

- [[ghost nodes for dangling wikilinks]]
