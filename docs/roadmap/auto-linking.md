# RFC: Auto-Linking for Roux

**Status:** Draft
**Author:** Sage
**Created:** 2025-01-27
**Domain:** Roux core feature

## Summary

Add automatic wiki-link detection and insertion to Roux, transforming plain text references to existing nodes into proper `[[wiki-links]]`. Supports batch linting, write-time hooks, and configurable matching strategies.

---

## Problem Statement

### The Gap

Knowledge graphs depend on links. Every unlinked reference is:
- A missing edge in the graph
- A broken query path
- Lost context for traversal and recommendation

Currently, authors must manually link every reference. This fails because:

1. **Cognitive load** — Remembering to link while writing disrupts flow
2. **Discovery gap** — Authors don't know what nodes exist
3. **Inconsistency** — Some files well-linked, others sparse
4. **Maintenance burden** — New nodes don't retroactively link old content

### Evidence

In Eldhrimnir, a single session found:
- 103 unlinked "garlic" references (248 linked, 351 total)
- 145 unlinked "onion" references (118 linked, 263 total)
- Hundreds more across common ingredients and techniques

Manual sed fixes are error-prone (created malformed `[[ugarlic|garlic]]` patterns) and don't scale.

### Success Criteria

1. New content automatically linked at write-time
2. Existing content lintable with batch fix capability
3. False positive rate < 5% in conservative mode
4. Zero corruption of existing valid links

---

## Proposed Solution

### Core Concept

Roux maintains a node index. Use that index to:
1. Detect plain-text references to known nodes
2. Transform them into wiki-links with appropriate aliases
3. Apply contextually (respecting existing links, code blocks, URLs)

### Two Operating Modes

#### 1. Lint Mode (Batch)

```bash
roux lint:links [options] [paths...]

Options:
  --dry-run       Show changes without applying
  --fix           Apply changes
  --scope <path>  Limit to specific folders
  --format        Output format: diff | json | summary
```

Use cases:
- CI pipeline check (fail on unlinked references)
- Periodic maintenance passes
- Pre-commit hook

#### 2. Write Hook (Continuous)

Intercept content before write operations:
- `create_node` — link new content before first write
- `update_node` — link modified content

Configurable aggressiveness prevents unwanted linking.

---

## Design

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Roux Core                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌────────────┐  │
│  │ Node Index  │───▶│ Link Matcher│───▶│ Transformer│  │
│  │             │    │             │    │            │  │
│  │ - titles    │    │ - exact     │    │ - apply    │  │
│  │ - aliases   │    │ - lowercase │    │ - preserve │  │
│  │ - plurals   │    │ - plural    │    │ - format   │  │
│  └─────────────┘    │ - fuzzy     │    └────────────┘  │
│                     └─────────────┘                     │
│                            │                            │
│                     ┌──────▼──────┐                     │
│                     │   Config    │                     │
│                     │             │                     │
│                     │ - mode      │                     │
│                     │ - scope     │                     │
│                     │ - rules     │                     │
│                     └─────────────┘                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Configuration Schema

```yaml
# roux.config.yaml
auto_link:
  enabled: true

  # When to apply
  mode: conservative  # conservative | aggressive | suggest

  # Where to apply
  scope:
    include:
      - "Recipes/**"
      - "Ingredients/**"
      - "Techniques/**"
    exclude:
      - "Templates/**"
      - "Planning/**"

  # What to match
  matching:
    strategies:
      - exact           # "Garlic" → [[Garlic]]
      - case_insensitive # "garlic" → [[Garlic|garlic]]
      - plural          # "onions" → [[Onion|onions]]
      - fuzzy           # typos, optional, threshold-based

    fuzzy_threshold: 0.9  # High threshold = fewer false positives

    # Plural handling
    plurals:
      # Standard -s/-es rules applied automatically
      irregular:
        leaves: leaf
        knives: knife
        potatoes: potato

  # What to skip
  preserve:
    - existing_links     # Never modify [[...]] content
    - code_blocks        # ```...``` and `...`
    - frontmatter        # ---...---
    - urls               # http(s)://...
    - html_tags          # <...>

  # Context rules
  context:
    # Only link in certain sections
    sections:
      include: ["*"]  # or specific headers
      exclude: ["## Sources", "## References"]

    # Minimum word length to consider
    min_length: 3

    # Ignore common words even if nodes exist
    stopwords:
      - "the"
      - "and"
      - "for"

  # Write hook specific
  on_write:
    enabled: true
    mode: conservative  # Can differ from lint mode
```

### Matching Strategies

#### 1. Exact Match
```
Input:  "Add Garlic to the pan"
Output: "Add [[Garlic]] to the pan"
```
Highest confidence. Always applied.

#### 2. Case-Insensitive Match
```
Input:  "Add garlic to the pan"
Output: "Add [[Garlic|garlic]] to the pan"
```
Uses alias syntax to preserve original case.

#### 3. Plural Match
```
Input:  "Dice the onions"
Output: "Dice the [[Onion|onions]]"
```
Requires plural→singular mapping (mostly automatic via rules, with irregular overrides).

#### 4. Fuzzy Match
```
Input:  "Add the parsely"  (typo)
Output: "Add the [[Parsley|parsely]]"  (if threshold met)
```
Optional. High threshold recommended. May require human review.

### Mode Definitions

| Mode | Behavior | Use Case |
|------|----------|----------|
| `conservative` | Exact + case-insensitive only | Default, safe |
| `aggressive` | All strategies including fuzzy | Bulk cleanup |
| `suggest` | Generate report, don't modify | Review before fix |

### Algorithm

```typescript
interface LinkMatch {
  start: number;
  end: number;
  original: string;
  nodeId: string;
  nodeTitle: string;
  confidence: number;
  strategy: 'exact' | 'case' | 'plural' | 'fuzzy';
}

function findLinkCandidates(
  content: string,
  nodeIndex: NodeIndex,
  config: AutoLinkConfig
): LinkMatch[] {
  const candidates: LinkMatch[] = [];
  const preserveRanges = findPreserveRanges(content, config);

  // Build matcher from node index
  const matcher = buildMatcher(nodeIndex, config);

  // Scan content for matches
  for (const match of matcher.findAll(content)) {
    // Skip if in preserved range
    if (isInRange(match, preserveRanges)) continue;

    // Skip if below confidence threshold
    if (match.confidence < config.threshold) continue;

    candidates.push(match);
  }

  // Sort by position (for replacement)
  return candidates.sort((a, b) => a.start - b.start);
}

function applyLinks(
  content: string,
  matches: LinkMatch[]
): string {
  // Apply in reverse order to preserve positions
  let result = content;
  for (const match of matches.reverse()) {
    const replacement = formatLink(match);
    result = result.slice(0, match.start) +
             replacement +
             result.slice(match.end);
  }
  return result;
}

function formatLink(match: LinkMatch): string {
  if (match.original === match.nodeTitle) {
    return `[[${match.nodeTitle}]]`;
  }
  return `[[${match.nodeTitle}|${match.original}]]`;
}
```

### Preserve Ranges

Critical to avoid corrupting existing content:

```typescript
function findPreserveRanges(content: string, config: Config): Range[] {
  const ranges: Range[] = [];

  // Existing wiki-links: [[...]]
  for (const match of content.matchAll(/\[\[[^\]]+\]\]/g)) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }

  // Code blocks: ```...```
  for (const match of content.matchAll(/```[\s\S]*?```/g)) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }

  // Inline code: `...`
  for (const match of content.matchAll(/`[^`]+`/g)) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }

  // Frontmatter: ---...---
  const fmMatch = content.match(/^---[\s\S]*?---/);
  if (fmMatch) {
    ranges.push({ start: 0, end: fmMatch[0].length });
  }

  // URLs
  for (const match of content.matchAll(/https?:\/\/[^\s)]+/g)) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }

  return ranges;
}
```

---

## API Surface

### CLI Commands

```bash
# Lint mode
roux lint:links                    # Check all, report only
roux lint:links --fix              # Check all, apply fixes
roux lint:links --dry-run          # Show what would change
roux lint:links Recipes/           # Scope to folder
roux lint:links --format=json      # Machine-readable output

# Configuration
roux config:auto-link              # Show current config
roux config:auto-link --mode=aggressive  # Update setting
```

### MCP Tools

```typescript
// New tool: find unlinked references
mcp__roux__find_unlinked({
  path?: string,        // Scope to path prefix
  strategy?: string[],  // Which strategies to use
  limit?: number        // Max results
}): {
  file: string,
  matches: {
    text: string,
    position: { line: number, column: number },
    suggestion: string,  // The wiki-link
    confidence: number,
    strategy: string
  }[]
}[]

// New tool: apply auto-linking
mcp__roux__auto_link({
  path?: string,        // Scope to path prefix
  dry_run?: boolean,    // Preview only
  strategy?: string[]   // Which strategies
}): {
  modified: string[],   // Files changed
  changes: number,      // Total links added
  skipped: number       // Matches below threshold
}
```

### Programmatic API

```typescript
import { AutoLinker } from '@roux/core';

const linker = new AutoLinker(nodeIndex, config);

// Single content transformation
const linked = linker.transform(content);

// File-based operations
const report = await linker.lint(paths);
const result = await linker.fix(paths, { dryRun: false });
```

---

## Edge Cases

### 1. Overlapping Matches

```
Content: "chicken stock"
Nodes:   "Chicken", "Chicken Stock", "Stock"
```

**Resolution:** Longest match wins. "chicken stock" → `[[Chicken Stock|chicken stock]]`

### 2. Possessives

```
Content: "the chicken's skin"
Node:    "Chicken"
```

**Resolution:** Include possessive in alias: `[[Chicken|chicken's]]`

### 3. Compound References

```
Content: "add garlic and onion"
```

**Resolution:** Link individually: "add [[Garlic|garlic]] and [[Onion|onion]]"

### 4. Context Sensitivity

```
Content: "salt the wound" vs "add salt to taste"
Node:    "Salt" (ingredient)
```

**Resolution:** In `conservative` mode, only link in recipe-context sections. In `aggressive` mode, link all. Consider future NLP-based context detection.

### 5. Already Partial Links

```
Content: "[[Garlic|minced garlic]] and more garlic"
```

**Resolution:** Preserve existing link, only link the second "garlic".

### 6. Nested Structures

```
Content: "## Garlic\n\nGarlic is..."
```

**Resolution:** Don't link headers (configurable). Do link body text.

---

## Implementation Phases

### Phase 1: Core Matching Engine
- [ ] Implement `LinkMatcher` with exact + case-insensitive strategies
- [ ] Implement preserve range detection
- [ ] Implement link formatting with alias support
- [ ] Unit tests for all edge cases

### Phase 2: CLI Lint Command
- [ ] `roux lint:links` with report output
- [ ] `--dry-run` and `--fix` flags
- [ ] `--format` options (diff, json, summary)
- [ ] Path scoping

### Phase 3: Configuration
- [ ] Config schema in `roux.config.yaml`
- [ ] Scope include/exclude patterns
- [ ] Strategy selection
- [ ] Stopwords and context rules

### Phase 4: Plural Handling
- [ ] Standard plural rules (s, es, ies)
- [ ] Irregular plural mapping
- [ ] Config for custom irregulars

### Phase 5: Write Hooks
- [ ] Integration with `create_node` / `update_node`
- [ ] Separate config for write-time behavior
- [ ] Performance optimization (incremental matching)

### Phase 6: MCP Tools
- [ ] `find_unlinked` tool
- [ ] `auto_link` tool
- [ ] Integration with Claude Code workflows

### Phase 7: Fuzzy Matching (Optional)
- [ ] Levenshtein/Dice similarity matching
- [ ] Confidence thresholds
- [ ] Suggestion mode for review

---

## Performance Considerations

### Node Index Size

Eldhrimnir: ~500 nodes
Target: Support 10,000+ nodes without degradation

**Approach:**
- Build trie or Aho-Corasick automaton from node titles
- Single-pass content scan
- O(n) where n = content length, not node count

### Large Files

Recipe files: ~2-5KB
Largest expected: ~50KB

**Approach:**
- Stream processing not required at this scale
- Full content in memory acceptable

### Batch Operations

Full vault lint: ~500 files

**Approach:**
- Parallel file processing
- Shared node index (read-only)
- Progress reporting for CLI

---

## Security Considerations

1. **No arbitrary code execution** — Matching is regex/string-based only
2. **No external network** — Uses local node index only
3. **Preserve original on error** — Any transform failure leaves file unchanged
4. **Backup option** — `--backup` flag for cautious users

---

## Open Questions

1. **Alias field in schema?**
   - Should nodes have an explicit `aliases` frontmatter field?
   - Would improve matching: "bell pepper" → [[Bell Pepper]] even when written as "capsicum"
   - Adds schema complexity

2. **Learning from corrections?**
   - If user manually fixes a missed link, should Roux learn?
   - Could build custom alias mappings over time
   - Adds state management complexity

3. **Cross-vault linking?**
   - If Roux supports multiple vaults, should auto-link work across them?
   - Probably not for v1

4. **Integration with Obsidian?**
   - Obsidian has its own auto-complete
   - Should Roux provide an Obsidian plugin, or stay CLI-only?
   - Plugin would enable real-time suggestions

5. **Semantic matching?**
   - Use embeddings to match "poultry" → [[Chicken]]?
   - High complexity, uncertain value
   - Defer to future version

---

## Alternatives Considered

### 1. Obsidian Plugin Only

**Pros:** Real-time, integrated
**Cons:** Doesn't help CLI users, batch operations, CI pipelines

**Decision:** Build in Roux core, optionally wrap for Obsidian later

### 2. External Linter (eslint-style)

**Pros:** Familiar pattern, ecosystem tooling
**Cons:** Separate install, config, doesn't leverage Roux's node index

**Decision:** Integrated approach leverages existing infrastructure

### 3. AI-Based Linking

**Pros:** Contextual, handles edge cases
**Cons:** Slow, expensive, non-deterministic, overkill for most cases

**Decision:** Rule-based first, AI assist optional for fuzzy mode

---

## References

- [Obsidian Wiki Links](https://help.obsidian.md/Linking+notes+and+files/Internal+links)
- [Aho-Corasick Algorithm](https://en.wikipedia.org/wiki/Aho%E2%80%93Corasick_algorithm) — Efficient multi-pattern matching
- [Roux resolve_nodes implementation](../architecture/roux-resolve.md) — Existing fuzzy matching

---

## Appendix: Example Session

### Before

```markdown
## Instructions

1. Mince the garlic and dice the onion.
2. Heat olive oil in a large pan over medium heat.
3. Add the garlic and onion, sauté until softened.
4. Add diced tomatoes and simmer for 20 minutes.
```

### After (conservative mode)

```markdown
## Instructions

1. [[Mince|Mince]] the [[Garlic|garlic]] and [[Dice|dice]] the [[Onion|onion]].
2. Heat [[Olive Oil|olive oil]] in a large [[Pan|pan]] over medium heat.
3. Add the [[Garlic|garlic]] and [[Onion|onion]], [[Saute|sauté]] until softened.
4. Add diced [[Tomato|tomatoes]] and [[Simmer|simmer]] for 20 minutes.
```

### Diff Output

```diff
 ## Instructions

-1. Mince the garlic and dice the onion.
+1. [[Mince|Mince]] the [[Garlic|garlic]] and [[Dice|dice]] the [[Onion|onion]].
-2. Heat olive oil in a large pan over medium heat.
+2. Heat [[Olive Oil|olive oil]] in a large [[Pan|pan]] over medium heat.
-3. Add the garlic and onion, sauté until softened.
+3. Add the [[Garlic|garlic]] and [[Onion|onion]], [[Saute|sauté]] until softened.
-4. Add diced tomatoes and simmer for 20 minutes.
+4. Add diced [[Tomato|tomatoes]] and [[Simmer|simmer]] for 20 minutes.
```
