---
type: RFC
status: Proposed
priority: P2
effort: S
phase: Post-MVP
category: Testing
parent: "[[Testing Framework]]"
---

# RFC: Graph Health Check Framework — Gettyverse Requirements

**From:** Gettyverse (consumer project)
**To:** Roux (platform)
**Type:** Feature Request Addendum
**Status:** Draft

  Context

  Gettyverse is a personal knowledge vault. Unlike Eldhrimnir's structured food ontology, this graph is emergent—notes
  link to notes, synthesis references facts, ideas cluster organically.

  The health checks needed here enforce architectural rules and hygiene, not schema compliance.

  ---
  What Gettyverse Needs

  1. Link Direction Enforcement

  The check: Links respect the vault's information architecture.
  ┌──────────┬──────────┬─────────────────────────────────────┐
  │   From   │    To    │               Allowed               │
  ├──────────┼──────────┼─────────────────────────────────────┤
  │ notes/   │ library/ │ ✓ Always                            │
  ├──────────┼──────────┼─────────────────────────────────────┤
  │ library/ │ library/ │ ✓ Always                            │
  ├──────────┼──────────┼─────────────────────────────────────┤
  │ library/ │ notes/   │ ✗ Never (unless Alex is referenced) │
  ├──────────┼──────────┼─────────────────────────────────────┤
  │ notes/   │ notes/   │ ✓ Always                            │
  └──────────┴──────────┴─────────────────────────────────────┘
  Why: Library entries are objective facts. They shouldn't point to Alex's synthesis—that's backwards. If "David
  Weinberger.md" links to "Hierarchy of Understanding.md", that's a violation.

  Ideal interface:

  import { checkLinkDirection } from '@roux/health-checks';

  const violations = await checkLinkDirection(vault, {
    rules: [
      {
        from: 'Library/**',
        to: 'Notes/**',
        allowed: false,
        exceptions: ['Notes/About Alex.md'], // self-reference allowed
        message: 'Library entries should not link to synthesis notes',
      },
    ],
  });

  // violations: { source: string, target: string, line: number, rule: string }[]

  Generic parts for Roux:
  - Glob-based folder matching
  - Link extraction with source locations
  - Rule engine with exceptions

  Domain-specific:
  - The actual rules (library → notes forbidden)
  - Exception list

  ---
  2. Naming Convention Enforcement

  The check: Filenames follow vault conventions.
  ┌──────────┬───────────────┬─────────────────────────┐
  │  Folder  │  Convention   │         Example         │
  ├──────────┼───────────────┼─────────────────────────┤
  │ Daily/   │ YYYY-MM-DD.md │ 2026-01-27.md           │
  ├──────────┼───────────────┼─────────────────────────┤
  │ Notes/   │ Title Case.md │ Tools Shape Thinking.md │
  ├──────────┼───────────────┼─────────────────────────┤
  │ Library/ │ Title Case.md │ David Weinberger.md     │
  └──────────┴───────────────┴─────────────────────────┘
  Ideal interface:

  import { checkNamingConventions } from '@roux/health-checks';

  const violations = await checkNamingConventions(vault, {
    rules: [
      {
        glob: 'Daily/*.md',
        pattern: /^\d{4}-\d{2}-\d{2}\.md$/,
        message: 'Daily notes must be YYYY-MM-DD.md',
      },
      // Title Case validation is fuzzy—may skip automated enforcement
      // or use heuristics (e.g., first letter of each word capitalized)
    ],
  });

  Note: Title case is difficult to validate automatically. Daily note dating is the primary hard rule worth checking.

  Generic parts for Roux:
  - Filename pattern matching
  - Glob-based folder scoping

  ---
  3. Ghost Links

  The check: Wiki-links point to nodes that exist.

  Gettyverse-specific config:

  import { findGhostLinks } from '@roux/health-checks';

  const ghosts = await findGhostLinks(vault, {
    folders: ['Notes', 'Library', 'Daily'],
    ignore: [
      /\.(jpg|png|pdf)$/i,  // media
      /^Templates\//,        // templates have placeholder links
    ],
  });

  // ghosts: { link: string, references: { source: string, line: number }[] }[]

  ---
  4. Orphan Detection

  The check: Notes that exist but have zero incoming links.

  Why: Orphans indicate either:
  - A note that should be linked from somewhere
  - A note that should be deleted
  - A stub that was started and forgotten

  Ideal interface:

  import { findOrphans } from '@roux/health-checks';

  const orphans = await findOrphans(vault, {
    folders: ['Notes', 'Library'],
    ignore: [
      'Daily/**',           // Daily notes are often orphans, that's fine
      'Notes/index.md',     // Index files are entry points
      /^Templates\//,
    ],
    minAge: 7,              // Only flag orphans older than 7 days (new notes get grace period)
  });

  // orphans: { path: string, created: Date, modified: Date }[]

  Generic parts for Roux:
  - Incoming link calculation
  - Age filtering
  - Exclusion patterns

  ---
  5. Bidirectional Link Hygiene

  The check: When A links to B, does B link back to A? (Informational, not enforced)

  Why: Obsidian shows backlinks, but explicit bidirectional links strengthen the graph. This is a "suggestions" check, not
   a hard failure.

  Ideal interface:

  import { findUnreciprocalLinks } from '@roux/health-checks';

  const suggestions = await findUnreciprocalLinks(vault, {
    folders: ['Notes'],
    threshold: 3,  // Only suggest if A links to B 3+ times without reciprocation
    severity: 'warning',
  });

  ---
  6. Frontmatter Consistency (Light)

  The check: Optional frontmatter fields follow patterns when present.

  Gettyverse doesn't have strict schemas, but when frontmatter exists, it should be consistent.

  import { checkFrontmatter } from '@roux/health-checks';

  const issues = await checkFrontmatter(vault, {
    rules: [
      {
        field: 'tags',
        type: 'array',
        message: 'Tags must be an array, not a string',
      },
      {
        field: 'created',
        pattern: /^\d{4}-\d{2}-\d{2}$/,
        message: 'Created date must be YYYY-MM-DD',
      },
      {
        field: 'status',
        enum: ['draft', 'evergreen', 'archived'],
        message: 'Status must be draft, evergreen, or archived',
      },
    ],
    // Don't require fields—just validate when present
    requireFields: false,
  });

  ---
  7. Daily Note Hygiene

  The check: Daily notes don't have lingering unchecked todos older than N days.

  Why: Daily notes often capture tasks. If a task from 2 weeks ago is still unchecked, it's either done (and should be
  checked) or forgotten (and should be moved/triaged).

  import { checkStaleTodos } from '@roux/health-checks';

  const stale = await checkStaleTodos(vault, {
    folders: ['Daily'],
    maxAge: 14,  // Flag unchecked todos older than 14 days
    pattern: /^- \[ \]/m,  // Markdown checkbox syntax
  });

  // stale: { file: string, line: number, text: string, age: number }[]

  ---
  Gettyverse Health Suite Config

  // health-checks.config.js
  import { defineHealthSuite } from '@roux/health-checks';

  export default defineHealthSuite({
    linkDirection: {
      rules: [
        {
          from: 'Library/**',
          to: 'Notes/**',
          allowed: false,
          message: 'Library entries must not link to synthesis notes',
        },
      ],
    },

    naming: {
      rules: [
        { glob: 'Daily/*.md', pattern: /^\d{4}-\d{2}-\d{2}\.md$/ },
        // Title case rules omitted—difficult to enforce automatically
      ],
    },

    ghostLinks: {
      folders: ['Notes', 'Library', 'Daily'],
      ignore: [/\.(jpg|png|pdf)$/i],
    },

    orphans: {
      folders: ['Notes', 'Library'],
      ignore: ['Daily/**'],
      minAge: 7,
    },

    frontmatter: {
      rules: [
        { field: 'tags', type: 'array' },
        { field: 'status', enum: ['draft', 'evergreen', 'archived'] },
      ],
      requireFields: false,
    },

    staleTodos: {
      folders: ['Daily'],
      maxAge: 14,
    },
  });

  ---
  What's Different From Eldhrimnir
  ┌─────────────────────────────────────┬─────────────────────────────────────┐
  │             Eldhrimnir              │             Gettyverse              │
  ├─────────────────────────────────────┼─────────────────────────────────────┤
  │ Strict schema (every node has type) │ Loose schema (frontmatter optional) │
  ├─────────────────────────────────────┼─────────────────────────────────────┤
  │ Hierarchies (parent chains)         │ Flat graph with emergent clusters   │
  ├─────────────────────────────────────┼─────────────────────────────────────┤
  │ Domain types (ingredient, recipe)   │ Two categories (library, notes)     │
  ├─────────────────────────────────────┼─────────────────────────────────────┤
  │ Computed fields validation          │ Link direction rules                │
  ├─────────────────────────────────────┼─────────────────────────────────────┤
  │ CI blocking                         │ Likely advisory/periodic            │
  └─────────────────────────────────────┴─────────────────────────────────────┘
  ---
  Overlap With Eldhrimnir (Roux Should Generalize)

  1. Ghost link detection — Identical need
  2. Orphan detection — Identical need
  3. Custom validators — Both need escape hatch for domain rules
  4. Health suite composition — Both need unified test runner
  5. Structured output — Both need programmatic results, not console.log

  ---
  Unique to Gettyverse (Roux Should Add)

  1. Link direction rules — "Folder A must not link to Folder B"
  2. Naming convention enforcement — Glob + regex filename validation
  3. Stale todo detection — Checkbox pattern matching with age filter
  4. Soft validation mode — Warnings instead of errors for hygiene checks

  ---
  Open Questions

  1. How strict? Should naming violations block CI, or just report? (Probably report-only for now)
  2. Backlink suggestions: Useful or noise? Need to try it to know.
  3. Tag governance: Should we validate tags exist in a known taxonomy, or let them stay organic?
  4. Daily note processing: Should there be a check for "daily notes older than X days that haven't been
  reviewed/processed"?

  ---
  Summary

  Roux provides: Ghost links, orphans, custom validators, health suite runner, structured output.

  Roux adds for Gettyverse: Link direction rules, naming conventions, stale todo detection.

  Gettyverse provides: Configuration, rules, severity levels