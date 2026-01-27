---
title: Graph Health & Testing Framework
type: RFC
status: Draft
priority: High
phase: Post-MVP
tags:
  - roadmap
  - testing
  - rfc
---
# RFC: Graph Health & Testing Framework

**Status:** Draft  
**Type:** Core Feature Proposal  
**Origin:** Aggregated from beta user requests

---

## Source Documents

This proposal synthesizes requirements from three active Roux consumers:

- [[Testing Infrastructure Request - Eldhrimnir]] — Structured food ontology with strict schemas and hierarchy validation
- [[Testing Infrastructure Request - The Dataverse]] — Theoretical knowledge graph with verification chains and claim tracking
- [[Testing Infrastructure Request - Gettyverse]] — Personal vault with architectural link rules and hygiene checks

---

## Problem Statement

All three projects have independently built ad-hoc validation scripts that share common problems:

1. **Scripts print instead of return** — Can't integrate with test frameworks or CI
2. **No composition** — Can't run all checks as a unified suite
3. **Domain logic mixed with generic logic** — Ghost link detection is reusable; knowing which folder is "Ingredients" is not
4. **No severity levels** — Everything is pass/fail; no warnings vs errors distinction

Roux should provide a **graph health check framework** that:
- Handles common validation patterns generically
- Allows domain-specific configuration and custom validators
- Returns structured, programmatic results
- Integrates with standard test runners (Vitest, Jest) and CI pipelines

---

## Design Principles

### 1. Configuration Over Code (Where Possible)

Common checks should be configurable without writing JavaScript:

```yaml
# health-checks.yaml
ghostLinks:
  folders: [docs, notes]
  ignore: [/\.(jpg|png)$/i]

orphans:
  folders: [docs]
  exclude: [docs/index.md]
  minAge: 7
```

### 2. Escape Hatch for Domain Logic

When config isn't enough, custom validators provide full programmatic control:

```javascript
const requireNutrition = createValidator({
  name: 'ingredient-nutrition',
  filter: (node) => node.frontmatter.type === 'ingredient',
  validate: (node) => node.frontmatter.nutrition 
    ? { valid: true } 
    : { valid: false, error: 'Missing nutrition object' },
});
```

### 3. Severity Levels

Not all violations are equal. Framework supports:
- `error` — Blocks CI, must fix
- `warning` — Flagged but doesn't block
- `info` — Suggestions for improvement

Projects configure severity per-check.

### 4. Structured Output

All validators return structured results suitable for programmatic consumption:

```typescript
interface ValidationResult {
  valid: boolean;
  checkName: string;
  summary: string;
  errors: Array<{
    node: string;
    field?: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
    line?: number;
  }>;
}

interface HealthSuiteResult {
  overall: boolean;
  duration: number;
  checks: Record<string, ValidationResult>;
}
```

---

## Capability Matrix

Consolidated requirements across all three projects:

| Capability | Eldhrimnir | Dataverse | Gettyverse | Generic? |
|------------|------------|-----------|------------|----------|
| Ghost link detection | ✓ | ✓ | ✓ | **Core** |
| Orphan detection | ✓ | ✓ | ✓ | **Core** |
| Schema validation | ✓ | ✓ | ✓ (light) | **Core** |
| Custom validators | ✓ | ✓ | ✓ | **Core** |
| Health suite runner | ✓ | ✓ | ✓ | **Core** |
| Structured output | ✓ | ✓ | ✓ | **Core** |
| Hierarchy connectivity | ✓ | ✗ | ✗ | Core (configurable) |
| Link direction rules | ✗ | ✗ | ✓ | Core (configurable) |
| Index coverage | ✗ | ✓ | ✗ | Core (configurable) |
| Bidirectional link audit | ✗ | ✓ | ✓ | Core (configurable) |
| Status/verification chains | ✗ | ✓ | ✗ | Core (configurable) |
| Naming conventions | ✗ | ✗ | ✓ | Core (configurable) |
| Git staleness detection | ✗ | ✓ | ✗ | Plugin or extension |
| Stale todo detection | ✗ | ✗ | ✓ | Plugin or extension |
| Claim extraction | ✗ | ✓ | ✗ | Custom validator |

---

## Architecture Proposal

### Core Module vs Plugin

The testing framework should be a **core module** (`@roux/health-checks`), not a plugin:

**Rationale:**
1. Universal need — All three beta users need this
2. Graph-native — Validators need deep access to graph structure (links, neighbors, traversal)
3. Testing is foundational — It's how projects ensure graph integrity
4. Single dependency — Projects shouldn't need to install multiple packages for basic health checks

However, the architecture should be **extensible** so domain-specific capabilities (git integration, claim extraction) can be added without bloating core.

### Module Structure

```
@roux/health-checks/
├── core/
│   ├── runner.ts          # Health suite runner
│   ├── types.ts           # Result interfaces
│   └── config.ts          # Config loader (yaml/js)
├── validators/
│   ├── ghost-links.ts     # Built-in: broken wiki-links
│   ├── orphans.ts         # Built-in: nodes with no incoming links
│   ├── schema.ts          # Built-in: frontmatter validation
│   ├── hierarchy.ts       # Built-in: parent chain connectivity
│   ├── link-direction.ts  # Built-in: folder-based link rules
│   ├── index-coverage.ts  # Built-in: indices cover all nodes
│   ├── bidirectional.ts   # Built-in: reciprocal link suggestions
│   ├── naming.ts          # Built-in: filename pattern enforcement
│   └── status-chain.ts    # Built-in: status propagation checking
├── factory.ts             # createValidator() for custom validators
└── index.ts               # Public API
```

### Extension Points

For capabilities that require external dependencies or are highly domain-specific:

```typescript
// Example: Git staleness extension
import { createValidator } from '@roux/health-checks';
import { getGitModifiedDate } from './git-utils'; // Project-provided

const staleness = createValidator({
  name: 'verification-staleness',
  filter: (node) => !!node.frontmatter.verified,
  validate: async (node) => {
    const verified = new Date(node.frontmatter.verified);
    const modified = await getGitModifiedDate(node.path);
    return verified >= modified
      ? { valid: true }
      : { valid: false, error: 'Verified date is older than last modification' };
  },
});
```

---

## Proposed API

### Configuration (YAML or JS)

```yaml
# health-checks.yaml
ghostLinks:
  folders: [docs, notes]
  ignore: 
    - /\.(jpg|png|pdf)$/i
    - /^Templates\//

orphans:
  folders: [docs]
  exclude: [docs/index.md]
  minAge: 7
  severity: warning

schema:
  path: ./schema/data-model.yaml
  customTypes:
    duration: /^(indefinite|\d+\s*(min|hours?|days?))$/
    link: /^\[\[[^\]]+\]\]$/

hierarchy:
  nodeType: ingredient
  parentField: parent
  terminuses: [Animal Products, Plant Products, Fungi]

linkDirection:
  rules:
    - from: Library/**
      to: Notes/**
      allowed: false
      message: Library entries must not link to synthesis notes
```

### Programmatic API

```typescript
import { runHealthSuite, defineHealthSuite, createValidator } from '@roux/health-checks';

// Option 1: Load from config file
const results = await runHealthSuite(graph, { config: './health-checks.yaml' });

// Option 2: Define programmatically
const suite = defineHealthSuite({
  ghostLinks: { folders: ['docs'] },
  orphans: { folders: ['docs'], minAge: 7 },
  custom: [myCustomValidator],
});

const results = await runHealthSuite(graph, suite);
```

### Test Framework Integration

```typescript
// health.test.ts (Vitest)
import { describe, test, expect, beforeAll } from 'vitest';
import { runHealthSuite } from '@roux/health-checks';
import { loadGraph } from './utils';

let results: HealthSuiteResult;

beforeAll(async () => {
  const graph = await loadGraph('./docs');
  results = await runHealthSuite(graph, { config: './health-checks.yaml' });
});

describe('Graph Health', () => {
  test('no ghost links', () => {
    expect(results.checks['ghostLinks'].errors).toEqual([]);
  });

  test('no orphan nodes', () => {
    const errors = results.checks['orphans'].errors
      .filter(e => e.severity === 'error');
    expect(errors).toEqual([]);
  });

  test('schema compliance', () => {
    expect(results.checks['schema'].valid).toBe(true);
  });
});
```

### CLI (Secondary Priority)

```bash
roux health --config ./health-checks.yaml
roux health --check ghostLinks --check orphans
roux health --severity error  # Only show errors, not warnings
```

---

## Built-in Validators (Stable Version)

### Tier 1: Universal (MVP)

These are needed by all three projects and should ship first:

1. **ghostLinks** — Wiki-links that point to non-existent nodes
2. **orphans** — Nodes with zero incoming links
3. **schema** — Frontmatter validation against schema definition
4. **custom** — Escape hatch for project-specific validators

### Tier 2: Common Patterns (Post-MVP)

Configurable validators that address recurring needs:

5. **hierarchy** — Parent chain connectivity (Eldhrimnir)
6. **linkDirection** — Folder-based link rules (Gettyverse)
7. **indexCoverage** — Index documents reference all typed nodes (Dataverse)
8. **bidirectional** — Reciprocal link suggestions (Dataverse, Gettyverse)
9. **statusChain** — Status field propagation checking (Dataverse)
10. **naming** — Filename pattern enforcement (Gettyverse)

### Tier 3: Extensions (Future)

Capabilities that need external dependencies or are highly specialized:

11. **gitStaleness** — Compare frontmatter dates to git history (requires git)
12. **staleTodos** — Unchecked checkboxes older than N days (Gettyverse-specific pattern)
13. **claimExtraction** — Domain-specific claim patterns (Dataverse research use case)

---

## Schema Validation Design

Schema validation is complex enough to warrant its own design. Key decisions:

### Schema Format

**Option A: Custom YAML format** (current Eldhrimnir approach)
- Pro: Tailored to graph/wiki-link needs
- Con: Yet another schema language

**Option B: JSON Schema subset**
- Pro: Industry standard, tooling exists
- Con: Verbose, doesn't handle wiki-links natively

**Option C: Hybrid**
- Use JSON Schema for basic types
- Add custom types for graph-specific needs (`link`, `node-reference`)

**Recommendation:** Option C — leverage JSON Schema where it fits, extend for graph needs.

### Schema Application

Projects need different schema strategies:

1. **Eldhrimnir** — Strict. Every node has a type. Unknown fields rejected.
2. **Gettyverse** — Loose. Fields optional. Only validate if present.
3. **Dataverse** — Inherited. Base schema + type-specific extensions.

The framework should support all three modes:

```yaml
schema:
  path: ./schema.yaml
  mode: strict | loose | inherited
  allowUnknownFields: false | true
```

---

## Open Questions

### 1. Graph Access

Should validators receive:
- **GraphCore instance** — Full access, tight coupling
- **Read-only graph view** — Scoped access, better isolation
- **Node iterator + query functions** — Most flexible, most work

**Recommendation:** Read-only view with common query helpers (get node, get neighbors, get all links).

### 2. Async vs Sync

Large vaults benefit from async. Small vaults don't care.

**Recommendation:** Async by default. Validators are `async` functions. Runner handles concurrency.

### 3. MCP Integration

Should `mcp__roux__health_check` exist?

**Arguments for:**
- Run health checks from Claude without leaving chat
- Could suggest fixes interactively

**Arguments against:**
- Health checks are typically CI/dev-time concerns
- MCP adds complexity

**Recommendation:** Defer. Start with CLI and programmatic API. Add MCP if clear demand.

### 4. Auto-fix

Should validators be able to fix issues, not just report them?

**All three projects say:** Not blocking. Report-only is fine for v1.

**Recommendation:** Validators return issues. Fixers are a separate concern for v2.

### 5. Watch Mode

Run checks on file change during development.

**Recommendation:** Nice to have, not MVP. Projects can use their own file watchers.

---

## Implementation Phases

### Phase 1: Foundation (MVP)

- [ ] Core runner and result types
- [ ] Config loader (YAML + JS)
- [ ] Ghost link validator
- [ ] Orphan validator  
- [ ] Basic schema validator (loose mode)
- [ ] Custom validator factory
- [ ] Vitest integration example
- [ ] CLI with JSON output

### Phase 2: Common Patterns

- [ ] Hierarchy validator
- [ ] Link direction validator
- [ ] Index coverage validator
- [ ] Bidirectional link validator
- [ ] Status chain validator
- [ ] Naming convention validator
- [ ] Schema modes (strict, inherited)
- [ ] CLI with pretty output

### Phase 3: Polish & Extensions

- [ ] Git integration helpers
- [ ] Content-based validators (todo detection, patterns)
- [ ] Performance optimization (caching, incremental)
- [ ] MCP integration (if demand)
- [ ] Watch mode

---

## Migration Path for Beta Users

If Roux ships this framework:

### Eldhrimnir
1. Delete `scripts/validate-schema.js`, `check-hierarchy.js`, `find-ghosts.js`
2. Create `health-checks.yaml` with domain configuration
3. Create `health.test.ts` using Vitest
4. Add `npm test` to CI

### Dataverse
1. Delete `scripts/verify.py`, `scripts/queue.py`, `scripts/report.py`
2. Port claim extraction logic to custom validator
3. Create `health-checks.yaml` + `schema/dataverse-schema.yaml`
4. Create `health.test.ts`
5. CI integration

### Gettyverse
1. Create `health-checks.yaml` with link direction and naming rules
2. Create `health.test.ts` for blocking checks
3. Create separate advisory script for hygiene suggestions
4. Optional CI integration (likely advisory, not blocking)

---

## Success Criteria

The framework is successful when:

1. All three beta projects can delete their ad-hoc scripts
2. New health checks can be added with < 20 lines of config/code
3. CI integration works out of the box with standard test runners
4. Results are structured enough for dashboards or trend analysis
5. Domain-specific rules don't require forking the framework

---

## Critical Concerns

Issues that need resolution before implementation. Working through these one by one.

### 1. Schema Validation is Underspecified

**Status:** Open

**Problem:** Schema validation is Tier 1 MVP, but the design section punts with "Option C, figure it out later." This is the hardest validator to build — JSON Schema is a rabbit hole, custom YAML schema is a rabbit hole. Estimated complexity dwarfs ghost links + orphans combined.

**Options:**
- A) Break out schema validation into its own RFC
- B) Demote to Tier 2, ship MVP without it
- C) Pick a minimal subset (type + required only) and defer advanced features

**Recommendation:** Option A. Schema deserves focused design.

---

### 2. Core Module vs First Plugin

**Status:** Open

**Problem:** The rationale for "core module" is "all three need it" — but Roux doesn't have a plugin system yet. This could *be* the first plugin that proves out the plugin architecture. Shipping as core locks in the API before we know if plugin boundaries are right.

**Options:**
- A) Ship as core, refactor to plugin later if needed
- B) Build minimal plugin system first, health checks as first plugin
- C) Ship as standalone package (`@roux/health-checks`), decide core vs plugin later

**Recommendation:** Leaning C — standalone package sidesteps the question.

---

### 3. Duplicates Existing Link Resolution

**Status:** Open

**Problem:** Roux's link resolution logic already knows what's broken — `get_neighbors` and the graph builder already track unresolved links. Ghost link detection may be wrapping existing code or duplicating it.

**Action:** Audit existing link resolution code. Determine if ghost link validator is:
- A thin wrapper exposing existing data
- New logic that duplicates existing detection
- Extension that adds reporting/filtering on top

---

### 4. Graph Access Model is Architectural

**Status:** Open

**Problem:** Open Question #1 asks "what do validators receive?" but this isn't a detail — it's the architecture. Wrong choice makes custom validators painful or exposes too much internal state.

**Options:**
- A) Full GraphCore instance — maximum power, tight coupling
- B) Read-only view interface — isolation, but need to define the interface
- C) Node iterator + query callbacks — most flexible, most work to implement

**Dependencies:** This blocks custom validator API design.

---

### 5. Performance Model Unaddressed

**Status:** Open

**Problem:** 10 validators × 500 nodes × async operations = unknown. Document says "async by default" but doesn't discuss:
- Can validators share loaded graph state?
- Sequential vs parallel validator execution?
- Caching between runs?
- Early termination on first error?

**Action:** Add performance section with expected characteristics and constraints.

---

### 6. YAML Regex is UX Pain

**Status:** Open

**Problem:** Config examples show `/\.(jpg|png)$/i` in YAML. Regex in YAML is error-prone (escaping hell) and intimidating to non-developers.

**Options:**
- A) Glob patterns only (simpler, covers 90% of cases)
- B) Glob default, regex opt-in with explicit syntax (`regex:"/pattern/"`)
- C) Accept the pain, document clearly

**Recommendation:** Option B — globs for ignore patterns, regex only when explicitly needed.

---

### 7. Enforcement vs Suggestions Mental Model

**Status:** Open

**Problem:** Eldhrimnir wants strict enforcement (CI blocks on failure). Gettyverse wants advisory suggestions. Same framework, different expectations. Severity is per-check, but what if same check needs different severity in different projects?

**Current design:** Severity configured per-check in project config. This works but could be clearer.

**Action:** Validate that per-check severity in config is sufficient. Consider adding examples showing same validator with different severities.

---

### 8. Minimum Viable Validation

**Status:** Open — needs beta user input

**Question for beta users:** "If we shipped *only* ghost links, orphans, and custom validators — no schema validation, no hierarchy, no link direction — would that unblock you enough to delete your scripts?"

If yes → that's the real MVP.
If no → which specific validator is the blocker?

---

## Testing Taxonomy

This proposal addresses **Graph Health Checks** — validation of graph content and structure for consumer projects. It's distinct from other testing concerns in the Roux ecosystem:

| Concern | Scope | Who Writes | Who Runs |
|---------|-------|------------|----------|
| **Graph Health Checks** (this proposal) | Consumer graph content/structure | Consumer projects | Consumer CI |
| **Roux Unit/Integration Tests** | Roux's own code correctness | Roux maintainers | Roux CI |
| **E2E Tests** | Full user workflows | Roux maintainers | Roux CI |
| **Scale/Performance Tests** | Large vault behavior | Roux maintainers | Roux CI (periodic) |

Graph Health Checks are the only consumer-facing testing feature. The others are internal Roux quality concerns.

---

## Related Work

### Roux Internal Testing (Separate Concerns)

These documents track Roux's own test quality — not part of this proposal, but context for the broader testing picture:

- [[E2E Testing]] — End-to-end test infrastructure for CLI and MCP workflows
- [[Test Infrastructure Improvements]] — Test quality issues (mock duplication, magic numbers)
- [[Integration Test Gaps]] — Cross-component flow coverage
- [[Test Coverage Extensions]] — Edge case and stress testing (10k emoji paste, etc.)

### Scale & Performance Testing

Performance validation for large vaults — may inform health check performance requirements:

- [[Scale Testing]] — Performance at >200 nodes (vector search, searchByTags)
- [[Batch Operations Scale Testing]] — resolveNodes, listNodes at scale

### Related Features

Features that overlap with or inform health check design:

- [[Link Integrity]] — Handling broken links on node rename (Option 2 "reject breaking changes" aligns with ghost link detection)

### Test Gap Issues

Current test gaps that may surface requirements for the health check framework:

- [[cache-test-gaps]] — Cache layer test coverage
- [[cli-command-test-gaps]] — CLI command coverage
- [[docstore-parser-test-gaps]] — Parser edge cases
- [[vector-provider-edge-cases]] — Vector search edge cases
- [[watcher-event-coalescing-cache-state-assertions]] — File watcher test gaps

---

## Appendix: Requirements Traceability

Every capability in this proposal traces back to at least one beta user request:

| Capability | Source |
|------------|--------|
| Ghost links | Eldhrimnir, Dataverse, Gettyverse |
| Orphans | Eldhrimnir, Dataverse, Gettyverse |
| Schema validation | Eldhrimnir, Dataverse, Gettyverse (light) |
| Custom validators | Eldhrimnir, Dataverse, Gettyverse |
| Hierarchy connectivity | Eldhrimnir |
| Link direction rules | Gettyverse |
| Index coverage | Dataverse |
| Bidirectional links | Dataverse, Gettyverse |
| Status chains | Dataverse |
| Naming conventions | Gettyverse |
| Git staleness | Dataverse |
| Stale todos | Gettyverse |
| Claim extraction | Dataverse |
