---
title: Automated Documentation
tags:
  - roadmap
type: Feature
status: Planned
priority: P2
effort: M
phase: Post-MVP
category: Infrastructure
---
# Automated Documentation

**Status:** Planned

## Problem

Documentation drifts from code. Interface signatures in docs go stale when the source changes (e.g., `docs/storeprovider.md` is already missing methods that exist in the actual `StoreProvider` interface). Manual sync is error-prone and nobody remembers to do it.

## Goal

Generate documentation from source code so interface signatures, method lists, and type definitions stay accurate automatically. Docs should reflect the code, not someone's memory of the code.

## Scope

- Interface/type documentation generated from TypeScript source
- Method signatures and JSDoc pulled directly from definitions
- Architecture docs remain hand-written (narrative can't be generated)
- Generated sections clearly marked so hand-written context isn't overwritten

## Open Questions

- Build-time generation vs. CI check that flags drift?
- Output format: markdown files in `docs/`, or served separately?
- Which tool: TypeDoc, custom extractor, or something lighter?
