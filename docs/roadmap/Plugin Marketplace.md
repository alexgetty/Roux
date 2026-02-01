---
title: Plugin Marketplace
tags:
  - roadmap
type: Feature
status: Proposed
priority: P3
effort: XL
phase: Future
category: Plugin System
parent: '[[Plugin System]]'
---
# Plugin Marketplace

Community plugin distribution with trust model.

## Context

[[Plugin System]] mentions "future path to community extensions / marketplace." This is far-future scope requiring significant security and infrastructure work.

## Problem

Without a marketplace:
- Users manually install plugins (copy files, npm install)
- No discovery mechanism
- No trust/verification system
- No update notifications

## Proposal

### Registry

Central registry (like npm) for Roux plugins:

```bash
roux plugin search "project management"
roux plugin install roux-plugin-pm
roux plugin update --all
```

### Trust Tiers

1. **Official** — Built by Roux team, bundled or auto-installed
2. **Verified** — Reviewed by Roux team, signed
3. **Community** — Unreviewed, install-at-your-own-risk warning

### Verification Process

- Code review for security issues
- Automated scanning (secrets, malicious patterns)
- Test suite requirements
- License compatibility check

### Infrastructure Needs

- Registry server (or piggyback on npm)
- Code signing system
- Plugin metadata format (roux-plugin.json)
- Version resolution and compatibility matrix
- CDN for plugin distribution

### Revenue Consideration

Could enable paid plugins:
- Roux takes percentage
- License verification
- Payment processing integration

## Why Deferred

- Far future — need plugin ecosystem first
- Requires [[Plugin Sandboxing]] for safety
- Significant infrastructure investment
- Trust model needs careful design
- Alex indicated this is "future future future roadmap"

## Dependencies

- [[Plugin Sandboxing]] — can't safely run untrusted code without it
- [[Plugin Schema Migration]] — marketplace plugins need clean upgrades

## References

- Red-team audit (2026-01-25)
- [[Plugin System]]
