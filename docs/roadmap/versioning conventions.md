---
id: 2dEM7XTys1RL
title: Versioning Conventions
tags:
  - roadmap
  - versioning
  - research
type: Research
---
# Versioning Conventions

Research synthesis on semver, milestones, and release strategies for Roux.

## Semver Basics

The [Semantic Versioning 2.0.0 specification](https://semver.org/) defines MAJOR.MINOR.PATCH:

- **MAJOR**: Incompatible API changes
- **MINOR**: Backward-compatible new functionality  
- **PATCH**: Backward-compatible bug fixes

### Pre-1.0 Rules

Major version zero (0.y.z) is explicitly for initial development. The spec states:

> "Anything MAY change at any time. The public API SHOULD NOT be considered stable."

Convention: Start at 0.1.0, increment minor for each release. Breaking changes are expected and require no special ceremony.

### What 1.0 Signals

Per the spec, 1.0 means:
1. You have defined a public API
2. Users depend on that API
3. You commit to not breaking it without major version bumps

The official FAQ puts it simply: "If your software is being used in production, it should probably already be 1.0.0."

## Milestone Patterns

Projects use two distinct concepts that often get conflated:

### Milestones = Planning Artifacts

Internal checkpoints. Not versions. Examples:
- "v2 Milestone 3" = third development iteration toward v2
- Spring's M1/M2/M3 releases before RC

Key insight from [XWiki's practices](https://dev.xwiki.org/xwiki/bin/view/Community/VersioningAndReleasePractices/): "A customer knows about the version, but cannot target milestones. They post tickets to the version; the team decides which milestone."

### Releases = Delivery Artifacts

What users consume. The actual semver numbers. Multiple releases may occur within a milestone's scope.

### Examples from Real Projects

| Project | Pre-release Pattern | Post-1.0 Pattern |
|---------|---------------------|------------------|
| Rust | 0.x rapid iteration, alpha/beta/RC for 1.0 | 6-week cadence, editions for breaking changes |
| SQLite | n/a (started at 1.0) | X.Y.Z where X=3 since 2004, Y=features, Z=patches |
| TypeScript | Rejects semver entirely | Major = reached x.9, minor = may break your code |
| Prisma | 0.x-2.x non-semver, 3.x+ strict semver | 2-week releases, maturity levels for features |
| Zod | n/a | Subpath versioning (zod/v3, zod/v4) for gradual migration |

## 1.0 Criteria

Common thresholds synthesized from [Brian Aker's criteria](https://krow.livejournal.com/564980.html) and semver FAQ:

1. **Stable API** — interfaces are defined and you will honor them
2. **Bug flow tapered** — not fixing something new every day
3. **Features baked** — no half-implemented capabilities
4. **Production usage** — someone is using it for real work
5. **Documentation complete** — users can self-serve

### The Rust Standard

Rust's 1.0 added a specific promise: "code written against 1.0 will continue to compile in future versions." This [stability without stagnation](https://blog.rust-lang.org/2015/02/13/Final-1.0-timeline/) principle became a model for the ecosystem.

### The TypeScript Counter-Example

TypeScript explicitly [rejects strict semver](https://www.learningtypescript.com/articles/why-typescript-doesnt-follow-strict-semantic-versioning) because "every change to a compiler is a breaking change." They optimize for release cadence over compatibility promises.

## Recommendations for Roux

Given Roux is a GPI library (interface-focused, API-critical):

### Adopt Standard Semver

No creativity needed here. 0.x means unstable, 1.0 means stable API. Users understand this.

### Define 1.0 Criteria Now

Proposed threshold:

- [ ] Core GPI contract stable (search, CRUD, traversal, providers)
- [ ] MCP tool schemas frozen (LLMs depend on these)
- [ ] At least one real project (not Roux's own docs) in production
- [ ] Plugin system designed (even if not fully implemented)
- [ ] Bug rate below 1/week for 4 consecutive weeks

### Separate Milestones from Versions

Use milestones for planning, not versioning:

| Concept | Format | Example | Purpose |
|---------|--------|---------|---------|
| Milestone | Named goals | "Plugin System", "1.0 Ready" | Planning |
| Release | Semver | 0.2.0, 0.3.0 | Delivery |
| Prerelease | Semver + tag | 1.0.0-beta.1 | Testing |

### Version Numbering Strategy

```
0.1.x — MVP (current)
0.2.x — Post-MVP polish
0.3.x — Plugin system foundation
0.4.x — External integrations
...
1.0.0-beta.1 — API freeze, public testing
1.0.0-rc.1 — Bug fixes only
1.0.0 — Stable release
```

### What NOT to Do

- **TypeScript's approach**: Rejecting semver only works if you're Microsoft
- **Zod's subpath versioning**: Clever but adds cognitive load; simpler to just bump major
- **Time-based versions** (Ubuntu-style): Wrong fit for a library; ship when ready

## Sources

- [Semantic Versioning 2.0.0](https://semver.org/)
- [Rust 1.0 Timeline](https://blog.rust-lang.org/2015/02/13/Final-1.0-timeline/)
- [SQLite Version Numbers](https://www.sqlite.org/versionnumbers.html)
- [TypeScript's Release Process](https://github.com/microsoft/TypeScript/wiki/TypeScript's-Release-Process)
- [Prisma Releases and Maturity Levels](https://www.prisma.io/docs/orm/more/releases)
- [Zod Versioning](https://zod.dev/v4/versioning)
- [XWiki Versioning Practices](https://dev.xwiki.org/xwiki/bin/view/Community/VersioningAndReleasePractices/)
- [thoughtbot on Versioning](https://thoughtbot.com/blog/maintaining-open-source-projects-versioning)
