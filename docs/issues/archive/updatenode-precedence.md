---
title: updatenode-precedence
tags:
  - issue
  - docstore
  - archived
---
# UpdateNode Precedence — ARCHIVED

> **Status:** Resolved. `NodeUpdates` type now excludes `outgoingLinks` — always derived from content.

## Original Problem

`updateNode` accepted `Partial<Node>`, allowing callers to pass both `content` and `outgoingLinks`. When both were provided, explicit `outgoingLinks` won, creating a mismatch between file content and graph state.

## Resolution

Created dedicated `NodeUpdates` type with only `title`, `content`, `tags`, `properties`. The `outgoingLinks` field is no longer settable — always derived from content parsing. Conflict scenario is now unrepresentable at compile time.
