---
type: Epic
status: Planned
priority: P1
effort: XL
phase: Post-MVP
category: Testing
blockedBy: ["[[Plugin System]]"]
---
# RFC: Graph Health & Testing Framework

**Status:** Ready for Implementation
**Type:** Plugin (`@roux/health-checks`)
**Origin:** Aggregated from beta user requests
**Dependencies:** [[plugin-system]] (provides/needs model)

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

### Resolved

~~**Graph Access:**~~ Validators receive GraphCore via PluginContext. See Critical Concern #4.

~~**Async vs Sync:**~~ Async by default, parallel validator execution. See Critical Concern #5.

### Deferred (Post-MVP)

**MCP Integration:** Should health checks expose tools via MCP?

If yes, the plugin declares `needs: { exposure: ['mcp'] }` and GraphCore wires it. The validator results could become interactive — Claude suggests fixes.

Deferring because:
- Health checks are primarily CI/dev-time
- MVP focus is programmatic API + CLI
- MCP exposure is additive; can ship later without breaking changes

**Auto-fix:** Should validators fix issues, not just report?

All three beta projects say: not blocking. Report-only is fine for v1.

Deferring because:
- Separate concern from detection
- Requires careful UX (dry-run, confirmation, undo)
- Can be added as separate capability layer

**Watch Mode:** Run checks on file change.

Nice for DX but not MVP. Projects can use their own file watchers or integrate with existing tooling. Revisit when usage patterns are clearer.

---

## Implementation Phases

### Phase 1: Foundation (MVP)

- [ ] Plugin structure (`@roux/health-checks` package)
- [ ] Plugin registration with GraphCore (provides/needs)
- [ ] Health suite runner and result types
- [ ] Config loader (YAML with glob patterns, opt-in regex)
- [ ] Ghost link validator
- [ ] Orphan validator
- [ ] Schema validator (minimal: types, custom types, required/optional, strict/loose modes)
- [ ] Custom validator factory (`createValidator()`)
- [ ] Vitest integration example
- [ ] CLI with JSON output

### Phase 2: Common Patterns

- [ ] Hierarchy validator (parent chain connectivity)
- [ ] Link direction validator (folder-based rules)
- [ ] Index coverage validator
- [ ] Bidirectional link validator
- [ ] Naming convention validator
- [ ] Named pattern presets (date, kebab-case, etc.)
- [ ] CLI with pretty output

### Phase 3: Polish & Extensions

- [ ] Status chain validator (verification propagation)
- [ ] Git integration helpers (staleness detection)
- [ ] Content-based validators (todo detection, patterns)
- [ ] Schema inheritance/composition (if demand from Dataverse)
- [ ] MCP tool exposure (if demand)
- [ ] Watch mode
- [ ] Performance optimization (incremental checking)

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

**Status:** Resolved

**Problem:** Schema validation is Tier 1 MVP, but the design section punts with "Option C, figure it out later." This is the hardest validator to build — JSON Schema is a rabbit hole, custom YAML schema is a rabbit hole. Estimated complexity dwarfs ghost links + orphans combined.

**Resolution:** Scope to minimal common core. Advanced features (inheritance, type inference) were Dataverse-specific, and Dataverse is documentation-only — not load-bearing for MVP.

**Minimal Schema Validator (MVP):**
- Field type validation: `string`, `number`, `boolean`, `array`, `enum`
- Custom type registry: user provides regex pattern or validation function per type name
- Required/optional per field
- Mode flag: `strict` (unknown fields → error) vs `loose` (unknown fields → ignored)

**Deferred to post-MVP:**
- Schema inheritance/composition
- Type inference from path
- Status/verification chains

**Schema format decision:** Simple YAML, not JSON Schema. Example:

```yaml
# schema.yaml
fields:
  type:
    type: enum
    values: [ingredient, recipe, technique]
    required: false
  parent:
    type: link  # custom type
    required: false
  nutrition:
    type: object
    required: true  # only for strict mode
  tags:
    type: array
    items: string

customTypes:
  link: '^\[\[[^\]]+\]\]$'  # regex pattern
  duration: '^\d+\s*(min|hours?|days?)$'

mode: strict  # or 'loose'
```

This is implementable without a separate RFC.

---

### 2. Core Module vs First Plugin

**Status:** Resolved

**Problem:** The rationale for "core module" is "all three need it" — but Roux doesn't have a plugin system yet. This could *be* the first plugin that proves out the plugin architecture. Shipping as core locks in the API before we know if plugin boundaries are right.

**Resolution:** Health checks ships as a plugin (`@roux/health-checks`), following the package architecture now documented in [[plugin-system]].

**Package architecture (applies to all of Roux):**

| Layer | What | Package |
|-------|------|---------|
| **Core** | GraphCore, provider interfaces, plugin interface | `roux` |
| **Providers** | StoreProvider implementations | `@roux/docstore`, future `@roux/notion-store` |
| **Plugins** | Optional capabilities | `@roux/mcp`, `@roux/health-checks`, `@roux/tasks` |

Health checks is a plugin that:
- **provides:** validation tools (if we want MCP exposure later)
- **needs:** `graphAccess: read`

This discussion drove updates to [[plugin-system]] including:
- GraphCore as orchestrator (provides/needs model)
- Graceful degradation for unmet plugin needs
- Package architecture section

---

### 3. Duplicates Existing Link Resolution

**Status:** Resolved

**Problem:** Roux's link resolution logic already knows what's broken — `get_neighbors` and the graph builder already track unresolved links. Ghost link detection may be wrapping existing code or duplicating it.

**Finding:** `buildGraph()` in `src/graph/builder.ts:24` already identifies ghost links:
```typescript
if (!nodeIds.has(target)) continue;  // silently ignores
```

The check exists. It just discards the result instead of reporting it.

**Resolution:** Ghost link validator uses the same logic but collects instead of ignoring. Not duplication — we're exposing data that's already computed but thrown away.

Implementation approach:
```typescript
function findGhostLinks(nodes: Node[]): GhostLink[] {
  const nodeIds = new Set(nodes.map(n => n.id));
  const ghosts: GhostLink[] = [];

  for (const node of nodes) {
    for (const target of node.outgoingLinks) {
      if (!nodeIds.has(target)) {
        ghosts.push({ source: node.id, target });
      }
    }
  }
  return ghosts;
}
```

Could also consider exposing this from `buildGraph()` itself as a side-output, but that couples graph building to validation concerns. Keeping them separate is cleaner.

---

### 4. Graph Access Model is Architectural

**Status:** Resolved (by plugin system design)

**Problem:** Open Question #1 asks "what do validators receive?" but this isn't a detail — it's the architecture. Wrong choice makes custom validators painful or exposes too much internal state.

**Resolution:** Health checks is a plugin (see concern #2). The plugin system already defines the interface:

```typescript
// Health checks plugin declares
needs: { graphAccess: 'read' }

// Receives standard PluginContext
interface PluginContext {
  core: GraphCore;  // read-only access to graph operations
  // ...
}
```

Validators receive GraphCore through the plugin context. This is:
- Option A (GraphCore instance), but...
- Constrained by the `graphAccess: 'read'` declaration
- GraphCore can enforce read-only if a plugin only declares read access

Custom validators written by consumer projects also use GraphCore — they're just functions that take the plugin context and return results.

---

### 5. Performance Model Unaddressed

**Status:** Resolved

**Problem:** 10 validators × 500 nodes × async operations = unknown. Document says "async by default" but doesn't discuss execution model.

**Resolution:** Define the execution model:

**1. Shared graph state:** Yes. All validators receive the same GraphCore instance via PluginContext. Graph is loaded once, not per-validator.

**2. Validator execution:** Parallel by default. Validators are independent — ghost links doesn't need orphan results. Run with `Promise.all()`.

```typescript
const results = await Promise.all(
  validators.map(v => v.validate(context))
);
```

**3. Caching between runs:** Delegated to GraphCore. If GraphCore caches node data (it does, via DocStore cache), validators benefit automatically. Health checks doesn't add its own caching layer.

**4. Early termination:** Not by default. Run all validators, report all issues. Optional `failFast: true` config for CI that wants to exit on first error.

**5. Expected performance:** For MVP target (<500 nodes):
- Graph load: dominated by disk I/O, ~100-500ms
- Ghost links: O(n × avg_links), single pass, <50ms
- Orphans: O(n), single pass with incoming link count, <50ms
- Schema: O(n × fields), <100ms
- Total: <1s for typical vault

Scale testing deferred to post-MVP (see [[Scale Testing]]).

---

### 6. YAML Regex is UX Pain

**Status:** Resolved

**Problem:** Config examples show `/\.(jpg|png)$/i` in YAML. Regex in YAML is error-prone (escaping hell) and intimidating to non-developers.

**Resolution:** Option B — globs by default, regex opt-in.

Actual use cases from beta users:
- Ignore images: `*.jpg`, `*.png` → glob
- Ignore folders: `Templates/**`, `.obsidian/**` → glob
- Match dates: `YYYY-MM-DD.md` → named preset or regex

**Config syntax:**

```yaml
ghostLinks:
  ignore:
    - "*.jpg"              # glob (default)
    - "*.png"
    - "Templates/**"
    - regex: '^\d{4}-\d{2}-\d{2}\.md$'  # explicit regex

naming:
  rules:
    - glob: "Daily/*.md"
      pattern: date        # named preset
    - glob: "Notes/*.md"
      pattern:
        regex: '^[A-Z].*\.md$'  # explicit regex
```

**Named presets for common patterns:**
- `date` → `YYYY-MM-DD`
- `timestamp` → ISO 8601
- `kebab-case`, `Title Case`, etc.

Globs use standard micromatch syntax. Regex only when explicitly requested via `regex:` key.

---

### 7. Enforcement vs Suggestions Mental Model

**Status:** Resolved

**Problem:** Eldhrimnir wants strict enforcement (CI blocks on failure). Gettyverse wants advisory suggestions. Same framework, different expectations. Severity is per-check, but what if same check needs different severity in different projects?

**Resolution:** Per-check severity in config is correct. Projects configure what they need.

**Example — same validator, different projects:**

```yaml
# Eldhrimnir: strict, CI blocks
ghostLinks:
  severity: error          # CI fails on ghost links
  folders: [Recipes, Ingredients]

orphans:
  severity: error          # CI fails on orphans
```

```yaml
# Gettyverse: advisory, just report
ghostLinks:
  severity: warning        # Flagged but doesn't fail CI
  folders: [Notes, Library]

orphans:
  severity: info           # Just informational
  minAge: 7
```

**Runner respects severity:**

```typescript
const results = await runHealthSuite(graph, config);

// CI integration
if (results.checks.some(c => c.errors.some(e => e.severity === 'error'))) {
  process.exit(1);  // fail CI
}
// Warnings and info are logged but don't fail
```

The mental model: validators find issues, severity is a label, consumer decides what to do with each severity level.

---

### 8. Minimum Viable Validation

**Status:** Resolved

**Context:** Dataverse is documentation-only (Alex's project, not yet implementing). Eldhrimnir and Gettyverse are the load-bearing beta users.

**MVP scope confirmed:**
1. Ghost links — universal need
2. Orphans — universal need
3. Minimal schema validation — universal need (see concern #1 resolution)
4. Custom validators — escape hatch for domain logic

**Deferred from MVP:**
- Hierarchy connectivity (Eldhrimnir-specific, they can use custom validator)
- Link direction rules (Gettyverse-specific, they can use custom validator)
- Index coverage, bidirectional links, status chains, naming conventions

The custom validator escape hatch means project-specific needs don't block MVP. Projects can implement their own until Tier 2 ships.

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
