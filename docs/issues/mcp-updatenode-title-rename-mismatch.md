---
title: MCP update_node Title Rename Mismatch
tags:
  - issue
  - mcp
  - archived
type: Issue
severity: Medium
component: MCP
phase: MVP
---
# update_node Title Rename Mismatch — ARCHIVED

> **Status:** Moved to roadmap. See [[update_node File Rename]].

## Original Problem

Schema claims title change "renames file." It doesn't — only updates frontmatter. Incoming-link check guards a rename that never happens.

## Resolution

Decided to implement actual file rename as a feature rather than fix the schema to match broken behavior. Roadmap item created at `docs/roadmap/updatenode-file-rename.md`.
