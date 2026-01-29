---
type: RFC
status: Proposed
priority: P2
effort: S
phase: Post-MVP
category: Testing
parent: "[[Testing Framework]]"
---

# RFC: Graph Health Check Framework — Dataverse Requirements

**From:** Dataverse (consumer project)
**To:** Roux (platform)
**Type:** Feature Request / Requirements Document
**Status:** Draft

---

## Summary

Dataverse maintains a theoretical knowledge graph for an ALife simulation project. We have existing validation scripts (`verify.py`, `queue.py`, `report.py`) that partially address our needs but suffer from the same composition and CI integration problems Eldhrimnir describes.

We're documenting our specific validation requirements to inform Roux's generic framework design.

---

## Existing Implementation (To Migrate)

### What We Have

| Script | Purpose | Reusable Logic | Domain Logic |
|--------|---------|----------------|--------------|
| `verify.py` | Claim extraction & verification tracking | Frontmatter parsing, git date comparison, staleness detection | Claim extraction patterns (definitions, attributions, citations) |
| `queue.py` | Prioritized verification queue | Dependency graph from wiki-links, priority scoring by centrality | "Verified docs linking to unverified" as priority signal |
| `report.py` | Status reporting | Aggregation, grouping, formatting | Document type inference from path/frontmatter |

### What Works

- Frontmatter-based status tracking (`verified: YYYY-MM-DD`)
- Git integration for staleness detection
- Wiki-link parsing for dependency graphs
- CI-compatible exit codes (`--check` mode)

### What Doesn't

- Scripts print instead of returning structured data
- No composition — can't run all checks as a suite
- Claim extraction is regex-based and fragile
- No schema validation for frontmatter
- No test framework integration

---

## What Dataverse Needs

### 1. Schema Validation

**The check:** Frontmatter conforms to document type schemas.

**Our schema requirements:**

```yaml
# Base fields (all documents)
base:
  type:
    enum: [concept, decision, reference, plan, index]
    required: false  # Inferred from path if missing
  domain:
    enum: [theory, implementation, meta]
    required: false
  status:
    enum: [draft, stable, deprecated]
    required: false
  verified:
    type: date
    required: false
  tags:
    type: array
    items: string
    required: false

# Decision documents (docs/Decision - *.md)
decision:
  extends: base
  supersedes:
    type: link  # [[Other Decision]]
    required: false
  superseded_by:
    type: link
    required: false

# Reference documents (docs/reference/*.md)
reference:
  extends: base
  source:
    type: string  # URL or citation
    required: true
```

**Domain-specific types we'd define:**
- `link` — Valid wiki-link format `[[...]]`
- `date` — ISO date `YYYY-MM-DD`

**Eldhrimnir alignment:** Same need. Roux's generic schema validator would work.

---

### 2. Link Integrity

**The check:** All wiki-links resolve to existing nodes.

**Our specific needs:**
- Scan `docs/` folder
- Ignore `.obsidian/` config files
- Handle aliased links: `[[Target|display text]]`
- Report orphans (nodes with zero incoming links) — but exclude index pages

**Additional Dataverse-specific check:**
- **Bidirectional link audit** — If `[[A]]` appears in B, A should probably link back to B in its `## Related` section. Not an error, but a warning.

**Eldhrimnir alignment:** Core ghost link detection is identical. Bidirectional audit is Dataverse-specific.

---

### 3. Verification Chain Integrity

**The check:** Verified documents should not depend on unverified documents.

**This is our unique validation need.** We track factual verification separately from structural validation:

```
Verified doc → links to → Unverified doc = "chain of trust" violation
```

**Generic parts Roux could provide:**
- Status field comparison across linked nodes
- Configurable "trust" relationship definition

**Domain-specific parts we provide:**
- `verified` field as the trust indicator
- Staleness detection (verified date < git modified date)

**Ideal interface:**

```javascript
import { checkStatusChain } from '@roux/health-checks';

const results = await checkStatusChain(vault, {
  statusField: 'verified',
  isValid: (value, node) => {
    if (!value) return false;
    const gitModified = getGitModifiedDate(node.path);
    return new Date(value) >= gitModified;
  },
  relationship: 'outgoing_links',  // Check what this node links TO
  severity: 'warning',  // Not blocking, but flagged
});
```

**Eldhrimnir alignment:** They don't have this concept. But a generic "status propagation" checker could serve both — theirs might check "published" status propagation.

---

### 4. Decision Document Structure

**The check:** Decision documents follow required structure.

**Our requirements:**
- Files matching `Decision - *.md` pattern
- Must contain these H2 sections: `## Problem`, `## Options`, `## Decision`, `## Rationale`
- If `superseded_by` frontmatter exists, document should have `status: deprecated`
- `## Options` should contain a list or table

**Ideal interface:**

```javascript
import { createValidator } from '@roux/health-checks';

const decisionStructure = createValidator({
  name: 'decision-structure',
  description: 'Decision documents must have required sections',
  filter: (node) => node.path.includes('Decision - '),
  validate: (node) => {
    const required = ['## Problem', '## Options', '## Decision', '## Rationale'];
    const missing = required.filter(h => !node.content.includes(h));
    if (missing.length > 0) {
      return { valid: false, error: `Missing sections: ${missing.join(', ')}` };
    }
    return { valid: true };
  },
});
```

**Eldhrimnir alignment:** Same pattern as their "recipes must not have diet field" — custom structural validators.

---

### 5. Index Coverage

**The check:** Key index documents reference all nodes of their type.

**Our requirements:**
- `Core Concepts.md` should link to all concept documents
- `Decisions.md` should link to all decision documents
- `Glossary.md` should link to all concept documents (or be a superset)

**This catches:**
- New documents added but not indexed
- Documents removed but still indexed (ghost links)

**Ideal interface:**

```javascript
import { checkIndexCoverage } from '@roux/health-checks';

const results = await checkIndexCoverage(vault, {
  index: 'docs/Core Concepts.md',
  shouldInclude: (node) => {
    return node.frontmatter.type === 'concept'
      || (!node.path.includes('Decision') && !node.path.includes('reference'));
  },
  exclude: ['docs/Index.md', 'docs/Glossary.md'],  // Meta-indices
});

// results: { missing: string[], extra: string[] }
```

**Eldhrimnir alignment:** They might want this for "all ingredients referenced in category index" — generalizable.

---

### 6. Claim Extraction (Stretch Goal)

**The check:** Extract verifiable claims for human review.

**This is our most domain-specific need.** Current `verify.py` extracts:
- Definitions: "X is a Y" patterns
- Attributions: "invented by X in YYYY"
- Citations: "(Author, YYYY)" or footnotes
- Numerical claims: "N things", "N%"

**We don't expect Roux to provide this** — it's too domain-specific. But the framework should allow us to plug in custom extractors that feed into the same reporting pipeline.

**Ideal interface:**

```javascript
const claimExtractor = createValidator({
  name: 'claim-extraction',
  description: 'Extract claims for verification',
  validate: (node) => {
    const claims = extractClaims(node.content);  // Our logic
    return {
      valid: true,  // Extraction always "passes"
      metadata: { claims },  // Attached for downstream processing
    };
  },
});
```

**Eldhrimnir alignment:** They don't need this. But "attach metadata during validation" is a generic capability.

---

### 7. Cross-Reference Consistency

**The check:** Related concepts reference each other.

**Examples:**
- `[[Autopoiesis]]` mentions `[[Operational Closure]]` → Operational Closure should mention Autopoiesis
- Decision documents should link to the concepts they affect
- Implementation Plan phases should link to relevant concept docs

**This is "soft" validation** — warnings, not errors. Helps maintain graph density.

**Ideal interface:**

```javascript
import { checkBidirectionalLinks } from '@roux/health-checks';

const results = await checkBidirectionalLinks(vault, {
  scope: (node) => node.frontmatter.type === 'concept',
  section: '## Related',  // Only check this section for backlinks
  severity: 'warning',
});
```

**Eldhrimnir alignment:** They might want "ingredients link back to recipes that use them" — same pattern.

---

## Proposed Health Suite Configuration

```javascript
// health-checks.config.js
import { defineHealthSuite } from '@roux/health-checks';
import { decisionStructure, claimExtractor } from './validators';

export default defineHealthSuite({
  schema: {
    path: './schema/dataverse-schema.yaml',
    customTypes: {
      link: (v) => /^\[\[[^\]]+\]\]$/.test(v),
      date: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v),
    },
  },

  ghostLinks: {
    folders: ['docs'],
    ignore: [/^\.obsidian\//, /\.(jpg|png|pdf)$/i],
  },

  orphanNodes: {
    folders: ['docs'],
    exclude: ['docs/Index.md'],  // Entry points are allowed to be orphans
  },

  statusChain: {
    statusField: 'verified',
    staleness: {
      compareToGit: true,
    },
    severity: 'warning',
  },

  indexCoverage: [
    {
      index: 'docs/Core Concepts.md',
      shouldInclude: (node) => inferType(node) === 'concept',
    },
    {
      index: 'docs/Decisions.md',
      shouldInclude: (node) => node.path.includes('Decision - '),
    },
  ],

  bidirectionalLinks: {
    scope: (node) => inferType(node) === 'concept',
    section: '## Related',
    severity: 'warning',
  },

  custom: [decisionStructure, claimExtractor],
});
```

---

## Test Integration

```javascript
// health.test.js
import { runHealthSuite } from '@roux/health-checks';
import config from './health-checks.config.js';

const results = await runHealthSuite(vault, config);

describe('Dataverse Graph Health', () => {
  test('frontmatter schema compliance', () => {
    expect(results.schema.errors).toEqual([]);
  });

  test('no ghost links', () => {
    expect(results.ghostLinks).toEqual([]);
  });

  test('no orphan nodes', () => {
    expect(results.orphanNodes).toEqual([]);
  });

  test('verification chain integrity', () => {
    // Warnings allowed, but track count
    expect(results.statusChain.errors.filter(e => e.severity === 'error')).toEqual([]);
  });

  test('Core Concepts index complete', () => {
    expect(results.indexCoverage['docs/Core Concepts.md'].missing).toEqual([]);
  });

  test('decision documents have required structure', () => {
    expect(results.custom['decision-structure'].failures).toEqual([]);
  });
});
```

---

## Priority Ranking

| Check | Priority | Rationale |
|-------|----------|-----------|
| Ghost links | P0 | Broken navigation is immediately visible |
| Schema validation | P0 | Malformed frontmatter breaks tooling |
| Decision structure | P1 | Enforces documentation standards |
| Index coverage | P1 | Prevents orphaned knowledge |
| Verification chain | P2 | Quality signal, not blocking |
| Bidirectional links | P3 | Nice-to-have, graph density |
| Claim extraction | P3 | Human-in-loop, not automated |

---

## Comparison: Dataverse vs Eldhrimnir

| Capability | Eldhrimnir | Dataverse | Generic? |
|------------|------------|-----------|----------|
| Schema validation | ✓ | ✓ | Yes |
| Ghost links | ✓ | ✓ | Yes |
| Orphan detection | ✓ | ✓ | Yes |
| Hierarchy validation | ✓ (ingredients) | ✗ | Yes (configurable) |
| Status chain / trust | ✗ | ✓ (verification) | Yes (configurable) |
| Index coverage | ? | ✓ | Yes |
| Bidirectional links | ? | ✓ | Yes |
| Document structure | ✓ (recipes) | ✓ (decisions) | Custom validators |
| Domain-specific extraction | ✗ | ✓ (claims) | Custom validators |

---

## Migration Path

If Roux ships this framework:

1. **Delete:** `scripts/verify.py`, `scripts/queue.py`, `scripts/report.py`
2. **Keep:** Claim extraction logic, port to custom validator
3. **Create:** `health-checks.config.js`, `schema/dataverse-schema.yaml`
4. **Create:** `health.test.js` using Vitest
5. **CI:** Add `npm test` to GitHub Actions

---

## Open Questions (Dataverse-Specific)

1. **Git integration:** Our staleness detection requires git history. Should Roux provide `getGitModifiedDate()` or should we inject it?

2. **Soft vs hard failures:** We want "verification chain broken" to be a warning, not a blocker. Severity levels need to be configurable per-check.

3. **Queue generation:** Our `queue.py` generates a prioritized markdown file. Is that a "reporter" concern or a separate tool?

4. **MCP integration:** Should `mcp__roux__health_check` exist for running checks from Claude? Or keep it CLI-only?
