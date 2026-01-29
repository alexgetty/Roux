---
type: RFC
status: Proposed
priority: P2
effort: S
phase: Post-MVP
category: Testing
parent: "[[Testing Framework]]"
---

# RFC: Graph Health Check Framework for Roux

**From:** Eldhrimnir (consumer project)
**To:** Roux (platform)
**Type:** Feature Request
**Status:** Draft

## Summary

Eldhrimnir needs a testable, CI-integrated way to validate graph data integrity. We currently have ad-hoc scripts that work but don't compose well and can't run as automated tests.

We're requesting that Roux provide a **graph health check framework** — generic validators with programmatic APIs that domain projects can configure and extend.

---

## Current Pain Points

1. **Scripts print instead of return** — Can't programmatically inspect results or integrate with test frameworks
2. **Domain logic mixed with generic logic** — Ghost link detection is reusable; knowing what folder "Ingredients" lives in is not
3. **No composition** — Can't run "all health checks" as a suite
4. **No CI integration** — Must manually remember to run scripts

---

## What Eldhrimnir Needs

### 1. Schema Validation

**The check:** Every node's frontmatter conforms to a schema definition.

**Generic parts Roux should provide:**
- Schema validation engine
- Field type validators: `string`, `number`, `boolean`, `array`, `enum`, `object`
- Wiki-link type: `link` (validates `[[...]]` format)
- Required/optional field handling
- Unknown field detection

**Domain-specific parts Eldhrimnir provides:**
- The schema definition (`data-model.yaml`)
- Custom field types if needed (e.g., `duration`, `duration_range`)

**Ideal interface:**

```javascript
import { validateSchema } from '@roux/health-checks';

const results = await validateSchema(vault, {
  schema: './schema/data-model.yaml',
  customTypes: {
    duration: (value) => /^(indefinite|\d+\s*(min|hours?|days?))$/.test(value),
    link: (value) => /^\[\[[^\]]+\]\]$/.test(value),
  },
});

// results: { valid: boolean, errors: ValidationError[], warnings: ValidationWarning[] }
```

### 2. Link Integrity

**The check:** Wiki-links point to nodes that exist (no ghosts).

**Generic parts Roux should provide:**
- Extract all wiki-links from vault
- Compare against existing nodes
- Report ghosts with reference counts and source locations
- Optionally: orphan detection (nodes with no incoming links)

**Domain-specific parts Eldhrimnir provides:**
- Which folders to scan
- Which link patterns to ignore (e.g., archive paths, image links)

**Ideal interface:**

```javascript
import { findGhostLinks, findOrphanNodes } from '@roux/health-checks';

const ghosts = await findGhostLinks(vault, {
  folders: ['Recipes', 'Ingredients', 'Techniques'],
  ignore: [/\.(jpg|png)$/i, /^Archive\//],
});

// ghosts: { link: string, references: { source: string, line: number }[] }[]
```

### 3. Hierarchy Connectivity

**The check:** Nodes of a given type form valid trees terminating at known roots.

**Generic parts Roux should provide:**
- Walk `parent` field chains
- Detect cycles
- Detect broken links (parent doesn't exist)
- Detect dead ends (chain doesn't reach terminus)
- Report path for debugging

**Domain-specific parts Eldhrimnir provides:**
- Which node type to check
- Which field holds the parent relationship
- Which nodes are valid terminuses
- Optional type filter (e.g., only `type: ingredient`)

**Ideal interface:**

```javascript
import { checkHierarchy } from '@roux/health-checks';

const results = await checkHierarchy(vault, {
  nodeType: 'ingredient',
  parentField: 'parent',
  terminuses: ['Animal Products', 'Plant Products', 'Fungi', 'Fundamentals'],
  filter: (node) => node.frontmatter.type === 'ingredient',
});

// results: {
//   connected: { node: string, path: string[], terminus: string }[],
//   disconnected: { node: string, path: string[], error: string }[]
// }
```

### 4. Custom Validators

**The need:** Domain projects have unique validation rules that don't generalize.

**Examples from Eldhrimnir:**
- "All ingredients must have `nutrition` object"
- "Recipes must not have `diet` field (it's computed)"
- "Modifier actions must link to `/Actions/` folder"
- "Sub-recipes referenced in shopping list must exist"

**Ideal interface:**

```javascript
import { createValidator } from '@roux/health-checks';

const requireNutrition = createValidator({
  name: 'ingredient-nutrition',
  description: 'All ingredients must have nutrition data',
  filter: (node) => node.frontmatter.type === 'ingredient',
  validate: (node) => {
    if (!node.frontmatter.nutrition) {
      return { valid: false, error: 'Missing nutrition object' };
    }
    return { valid: true };
  },
});
```

### 5. Test Runner / Health Suite

**The need:** Run all configured checks as a composable suite, with structured output suitable for test frameworks.

**Ideal interface:**

```javascript
// health-checks.config.js
import { defineHealthSuite } from '@roux/health-checks';
import { requireNutrition, noDietField } from './validators';

export default defineHealthSuite({
  schema: {
    path: './schema/data-model.yaml',
    customTypes: { duration, link },
  },

  ghostLinks: {
    folders: ['Recipes', 'Ingredients', 'Techniques', 'Equipment'],
    ignore: [/\.(jpg|png)$/i],
  },

  hierarchy: {
    nodeType: 'ingredient',
    parentField: 'parent',
    terminuses: ['Animal Products', 'Plant Products', 'Fungi', 'Fundamentals'],
  },

  custom: [requireNutrition, noDietField],
});
```

```javascript
// health.test.js (Vitest)
import { runHealthSuite } from '@roux/health-checks';
import config from './health-checks.config.js';

const results = await runHealthSuite(vault, config);

describe('Graph Health', () => {
  test('schema compliance', () => {
    expect(results.schema.errors).toEqual([]);
  });

  test('no ghost links', () => {
    expect(results.ghostLinks).toEqual([]);
  });

  test('ingredient hierarchy connected', () => {
    expect(results.hierarchy.disconnected).toEqual([]);
  });

  test('custom: all ingredients have nutrition', () => {
    expect(results.custom['ingredient-nutrition'].failures).toEqual([]);
  });
});
```

---

## Output Format Requirements

All validators should return structured results, not print to console. The structure should include:

```typescript
interface ValidationResult {
  valid: boolean;
  checkName: string;
  summary: string;  // "47 errors in 312 files"
  errors: {
    node: string;      // Node ID
    field?: string;    // Field name if applicable
    message: string;   // Human-readable error
    severity: 'error' | 'warning';
  }[];
}

interface HealthSuiteResult {
  overall: boolean;  // All checks passed
  duration: number;  // ms
  checks: Record<string, ValidationResult>;
}
```

### CLI Output (Optional)

A CLI wrapper that pretty-prints results would be nice but isn't the priority. The programmatic API is what we need for CI.

```bash
roux health-check --config ./health-checks.config.js
```

---

## Non-Goals (For Now)

These would be nice but aren't blocking:

- **Auto-fix capabilities** — Just report; we'll fix manually or write separate scripts
- **Watch mode** — Run on save; nice for DX but not essential
- **Incremental checking** — Only check changed files; optimization for later
- **Web dashboard** — Structured JSON output is enough

---

## How Eldhrimnir Would Use This

1. **CI Pipeline:** Health checks run on every PR. Failures block merge.
2. **Pre-commit hook:** Optional local check before committing.
3. **Development:** Run `npm test` to validate the graph after bulk changes.
4. **Custom validators:** Add domain rules as the schema evolves.

---

## Migration Path

If Roux ships this, Eldhrimnir would:

1. Delete `scripts/validate-schema.js`, `check-hierarchy.js`, `find-ghosts.js`
2. Create `health-checks.config.js` with our domain configuration
3. Create `health.test.js` using Vitest
4. Add `npm test` to CI

---

## Open Questions

1. **Vault access:** Should validators receive a `Vault` object (Roux abstraction) or raw paths? Vault object is cleaner but adds coupling.

2. **Async vs sync:** Large vaults benefit from async. Small vaults don't care. Probably async by default?

3. **Schema format:** Roux could define its own schema format or support existing ones (JSON Schema, etc.). Our `data-model.yaml` is custom — would Roux adopt it or require translation?

4. **MCP integration:** Should `mcp__roux__validate` exist? Or is this purely a local tooling concern?

---

## Summary

**Roux provides:** Generic validators (schema, links, hierarchy), composition framework, structured output.

**Eldhrimnir provides:** Configuration, custom validators, test integration.

This separation lets Roux be a platform that any knowledge graph project can build on, while Eldhrimnir keeps full control over its domain rules.
