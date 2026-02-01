---
title: Plugin System
tags:
  - roadmap
  - architecture
  - extensibility
type: Epic
status: Planned
priority: P1
effort: XL
phase: Post-MVP
category: Plugin System
---
# Plugin System

Modular extension system for Roux. Plugins extend graph capabilities, add MCP tools, and define schemas — without touching core infrastructure.

## Open Questions

Red team review surfaced these gaps. **Some design questions remain open. Implementation blockers documented.**

### Implementation Blockers

Code-level gaps between this plan and the existing codebase. Must be resolved before plugin system can ship.

**IB1: Node type missing `plugins` field**

The plan specifies `plugins?: Record<string, Record<string, unknown>>` on Node (Q13). Current `src/types/node.ts` has no such field.

**Location:** `src/types/node.ts:8-18`

**Required changes:**
1. Add `plugins?: Record<string, Record<string, unknown>>` to Node interface
2. Update `isNode()` type guard to validate plugins field structure
3. Update DocStore serializer to handle `plugins` → frontmatter mapping
4. Update parser to extract `plugins` from frontmatter

**Verification:** Unit test: create node with plugins data, serialize to markdown, parse back, assert plugins preserved.

---

**IB2: GraphCore has no plugin registration API**

Plan specifies GraphCore as orchestration hub with three-phase lifecycle (Register → Resolve → Activate). Current GraphCore only has `registerStore()` and `registerEmbedding()`. No plugin registration, dependency resolution, or PluginContext creation.

**Location:** `src/core/graphcore.ts`, `src/types/graphcore.ts`

**Required changes:**
1. Add `RouxPlugin` interface to types
2. Add `PluginContext` interface to types
3. Add `registerPlugin(plugin: RouxPlugin): void` to GraphCore
4. Add internal plugin registry, resolution logic, activation lifecycle
5. Add `query()` method per Q14 resolution

**Verification:** Integration test: register two plugins with requires/wants, verify resolution and wiring.

---

**IB3: No `query()` API as specified**

Q14 specifies unified `query()` with `text`, `where`, `not`, `or`, `and`, `sort`, `limit`. Current API only has `search(query: string, options?)`.

**Location:** `src/types/graphcore.ts:30`

**Required changes:**
1. Define `QueryOptions` interface with all specified fields
2. Implement `query()` on GraphCore
3. Remove `search()` entirely — `query()` is the only API (no deprecation, no alias; breaking changes acceptable at this stage)

**Verification:** Test composing semantic + structured: `{ text: 'bug', where: { priority: 'high' }, limit: 5 }`

---

**IB4: Event system — interface exists, implementation missing (Q20)** — RESOLVED

**Resolution:** Option A — remove `wants.events` from MVP interface. Events are useful but not required for core plugin functionality. Add back when event system lands (see [[Plugin Cross-Communication]]).

**Changes:**
- Remove `events?: string[]` from `wants` in RouxPlugin interface
- Remove `events: string[]` from `wiring` in PluginContext interface
- Plugins needing reactivity can poll via `query()` for MVP

---

**IB5: Error boundaries undefined (Q23)**

Q23 asks what happens when `plugin.register()` throws but marks it post-MVP. This is fundamental runtime behavior — undefined = arbitrary implementation choices.

**Location:** Plugin lifecycle in GraphCore

**Resolution:** Define contract explicitly:
- `register()` throws → plugin skipped, error logged, other plugins continue
- `unregister()` throws → error logged, continue cleanup (best effort)
- Add try/catch around all plugin lifecycle calls

**Verification:** Test: plugin that throws on register, verify skipped and other plugins activate.

---

### Open Design Questions

Design decisions that need resolution before implementation.

---

**IB6: PluginContext write API undefined** — OPEN

PluginContext currently only exposes `query()`. Plugins with readwrite permission have no way to write.

**Discovery:** Red team review identified that the interface lacks write operations. Plugins need to create nodes, update data, and potentially delete.

**Agreed so far:**
- Plugins can create full nodes (with core fields + their namespace data)
- Plugins can write to their own namespace
- Plugins can write to core fields (title, content, tags, properties) on nodes they can access
- Schema auto-registers from manifest — no `registerSchema()` call needed
- Remove `registerSchema()` from examples

**Open:** Whether to use scoped methods on PluginContext vs proxy wrapper around core. See Q26 for related namespace access question.

**Scoped methods approach:**
```typescript
interface PluginContext {
  query(options: QueryOptions): Promise<Node[]>;
  createNode(node: Partial<Node>): Promise<Node>;
  updateNode(id: string, updates: NodeUpdates): Promise<Node>;
  deleteNode(id: string): Promise<boolean>;
  // All methods enforce scope + mode permissions
  // All methods auto-namespace plugin-specific data
}
```

**Proxy approach:**
```typescript
interface PluginContext {
  core: ScopedGraphCore;  // Proxy that enforces permissions
}
```

**Leaning:** Scoped methods — clearer semantics, but decision blocked on Q26.

---

**Q26: Cross-plugin namespace access** — OPEN

Can plugins write to other plugins' namespaces? Tension between security and interoperability.

**Context:** Current model says plugins can only write to `node.plugins[ownId]`. But this prevents:
- plugin-pm-github writing `syncedAt` to plugin-pm's namespace
- Workflow automation updating statuses across plugins
- Plugins that genuinely extend each other

**Options explored:**

**Option 1: `requires` = namespace access**

If plugin declares `requires: ['plugin-pm']`, it gets write access to plugin-pm's namespace. Dependency = trust.

Pros: Simple, `requires` already exists, explicit relationship.
Cons: All-or-nothing access, no granular control.

**Option 2: Explicit grants in manifest**

```typescript
provides: {
  namespaceWriters?: string[];  // plugin IDs allowed to write here
}
```

Pros: Granular control, explicit consent from target plugin.
Cons: More complexity, requires coordination between plugin authors.

**Option 3: API-only interaction**

No direct cross-plugin writes. Plugins expose tools, others call them:

```typescript
// plugin-pm exposes
tools: [{ name: 'set_status', ... }]
// plugin-pm-github calls the tool instead of writing directly
```

Pros: Clean interfaces, plugin controls its mutations, no namespace pollution.
Cons: More work, every interaction needs a tool, might be overkill for tightly-coupled plugins.

**Option 4: No boundary**

Any plugin can write anywhere. User trusts their plugins.

Pros: Maximum flexibility, simple implementation.
Cons: Data corruption risk, debugging nightmare, no encapsulation.

**Option 5: Write-through with audit**

Allow cross-plugin writes but log them. Soft boundary with visibility.

Pros: Flexibility with accountability.
Cons: Doesn't prevent mistakes, just documents them.

**Trade-off spectrum:**

```
Security ←————————————————————————→ Interoperability

Hard boundary    requires=access    Explicit grants    No boundary
(strict)         (option 1)         (option 2)         (option 4)
```

**Leaning:** Option 1 (`requires` = namespace access). Simple extension of existing concept. But decision deferred — need to think through implications for plugin ecosystem.

---

### Design Resolved (MVP Blockers)

**Q13: Namespace storage format** — RESOLVED

**Resolution:** New optional `plugins` field on Node, separate from `properties`.

```typescript
interface Node {
  // existing fields...
  properties: Record<string, unknown>;  // user properties only
  plugins?: Record<string, Record<string, unknown>>;  // plugin namespaces
}
```

**Storage mapping:**
- `plugins` is optional — created when first plugin writes to a node
- Each plugin's namespace: `node.plugins[pluginId]`
- User properties remain in `node.properties` — no collision risk
- Query for plugin-touched nodes: `nodes where plugins['plugin-pm'] exists`

**DocStore frontmatter format:**
```yaml
---
title: Fix the bug
tags: [bug]
plugins:
  plugin-pm:
    status: open
    priority: high
  plugin-time:
    estimate: 2h
---
```

**Key benefits:**
- Clean separation between user data and plugin data
- Type system enforces the boundary
- Optional field = lightweight for non-plugin nodes
- Easy cleanup: remove `plugins[pluginId]` on uninstall
- Easy traversal: query nodes by plugin presence

---

**Q14: PluginContext.query() contract** — RESOLVED

**Resolution:** Unified `query()` method that composes semantic and structured queries.

**GraphCore gains `query()`** — replaces current `search()`. One method, composable capabilities:
- `text` — semantic ranking (vector similarity)
- `where` — field conditions with operators (eq, gt, lt, contains, etc.)
- `not` — exclusion conditions
- `or` / `and` — logical composition
- `sort` — ordering
- `limit` — pagination

Semantic and structured compose — use either or both in the same query.

**PluginContext wraps `query()`** — adds automatic namespace scoping and permission checks. Context captures plugin ID at construction; all queries auto-scope to `node.plugins[pluginId]` unless explicitly global.

**Scoping:**
- Default: queries target plugin's own namespace
- `scope: 'global'` — queries across all namespaces (requires global permission)
- Permission violation throws at query time

---

**Q15: Registration order algorithm** — RESOLVED

**Resolution:** No ordering. Register all, then resolve in one pass.

**Phases:**
1. **Register** — collect all plugin manifests. No execution, no ordering.
2. **Resolve** — single pass once all manifests collected:
   - `requires` — check required plugins exist in registry (existence only, not initialization order)
   - `needs` — validate against available system capabilities
   - `wants`/`provides` — match across all plugins
3. **Activate** — call `register()` on all plugins that passed resolution. Order irrelevant. Parallel activation possible.

**Error handling:**
- Missing `requires` — plugin fails resolution, logged, skipped
- Circular `requires` — impossible to detect as a cycle since it's just existence checks; both load fine
- Unmet `needs` — plugin fails resolution, logged, skipped
- Unmet `wants` — plugin activates with reduced functionality, warning logged

No topological sort needed. `requires` means "must exist," not "must initialize first."

---

**Q16: Tool name collision handling** — RESOLVED

**Resolution:** Tools are namespaced by full plugin ID. No collisions possible.

- Full plugin ID becomes tool prefix (no stripping)
- Plugin registry enforces unique IDs → tool names can't collide
- `@roux/*` reserved for official plugins (by convention)
- Users see namespaced tool names in MCP

**Normalization rules:** Lowercase, replace non-alphanumeric with `_`, dedupe consecutive underscores. Examples:
- `@roux/pm` → `roux_pm_create_issue` (official)
- `plugin-pm` → `plugin_pm_create_issue`
- `my-tracker` → `my_tracker_create_issue`

---

**Q17: Permission enforcement mechanism** — RESOLVED

**Resolution:** PluginContext enforces at runtime.

- PluginContext constructed with plugin's declared permissions
- Every `query()` call validates requested scope against declared scope
- Violation throws `PermissionError`
- Plugins can't lie — they don't construct their own context; GraphCore does during activation

---

**Q18: Schema version semantics** — RESOLVED

**Resolution:** Informational only for MVP.

- `schema.version` stored and exposed but not enforced
- No validation behavior tied to version
- Plugin authors bump version as documentation of schema evolution
- Future migration system will use version to determine upgrade paths
- Keeping the field now avoids breaking change when migrations land

---

### Medium Priority (Post-MVP)

**Q19: MCP module extraction** — Plan says MCP becomes separate module but no extraction strategy documented.

**Q20: Event system** — RESOLVED via IB4. Removed from MVP interface. See [[Plugin Cross-Communication]] for future event system.

**Q21: Plugin test contract** — How do plugin authors write tests? **Resolution:** Plugin tests instantiate real GraphCoreImpl with in-memory DocStore (sourceRoot = temp dir). No mocks. Test actual graph behavior.

**Q22: FormatReader relationship** — `FormatReader` exists in `src/providers/docstore/reader-registry.ts`. **Resolution:** FormatReader is an internal DocStore extension point, not a plugin. Plugins operate at GraphCore level; FormatReader operates at store level. No relationship.

**Q23: Error boundaries** — What happens when `plugin.register()` throws? (See IB5 for resolution.)

**Q24: Schema field types missing `array`** — RESOLVED. Added `array` type with `items: FieldDefinition` for nested type definition. Required for real-world schemas (`assignees: string[]`, `labels: string[]`, etc.).

**Q25: Singleton conflict detection timing** — Plan says singleton capabilities (MCP, REST) error on duplicate. When? **Resolution:** Error at resolution phase. All manifests collected, then validated. Clear error: "Multiple plugins provide 'mcp' exposure: plugin-a, plugin-b. Configure one."

---

### Resolved

**Q1: Query semantics for namespaced data** — RESOLVED

**Resolution:** Scoped by default, global opt-in.

```typescript
// Default: scoped to own namespace (safe)
context.query({ where: { status: 'open' } })
// → Only searches plugin's namespace in node.plugins
// → Returns nodes this plugin has touched

// Explicit: global namespace (wide net)
context.query({ where: { status: 'open' }, scope: 'global' })
// → Searches across all plugin namespaces
// → Plugin handles potentially mixed results

// Core properties always global:
context.query({ where: { tags: ['urgent'] } })
// → No namespace, searches store-level data
```

Key decisions:
- **Namespace is storage, not query syntax.** No `plugin-pm.status` in query API — that prefix doesn't exist at the query level.
- **Results include full node data.** All namespaces visible on returned nodes — query scope restricts targeting, not visibility.
- **Scope = permission boundary.** Local-only plugins are sandboxed by design (see Q12).
- **One-way composability.** Other plugins/users/LLMs can enrich local plugin nodes. Local plugin remains unaware — sandbox that still participates.
- **Collision handling.** GraphCore warns on schema registration if two plugins define same property name. Allowed but flagged.

**Q2: `createdBy` conflation** — RESOLVED

**Resolution:** Drop `createdBy` entirely. Namespace presence is the ownership signal.

- If `node.plugins?.['plugin-pm']` exists, plugin-pm has data there
- Query: `nodes where plugins['plugin-pm'] exists`
- No conflation between "who made the node" vs "who has data on it"

**Uninstall behavior (MVP):** Uninstall = unregister only. Namespace data persists as orphaned properties. User can reinstall to recover functionality.

**Q3: Circular needs resolution** — RESOLVED

**Resolution:** Circular dependencies are a design smell. The plugin model prevents them by design.

Key insight: If a plugin is entirely dependent on another plugin to function at all, it's either:
1. Not a valid standalone plugin (should be merged or redesigned)
2. A legitimate extension that should use `requires`

**Three-tier dependency model:**

```typescript
// REQUIRES — fatal plugin-to-plugin dependency (rare)
// "I am an extension of plugin-X. Without it, I'm nothing."
requires?: string[];  // plugin IDs

// NEEDS — system capabilities (must be satisfied)
// "I need these capabilities from the system to function."
needs?: {
  graphAccess?: { scope: 'local' | 'global'; mode: 'read' | 'readwrite' };
  providers?: ('Embedding' | 'LLM')[];
};

// WANTS — inter-plugin enhancement (graceful if unmet)
// "I want these capabilities if available. I work without them."
wants?: {
  exposure?: ExposureType[];  // MCP, REST, CLI
};
```

**Resolution rules:**

1. `requires` — check if required plugins are loaded. If not, skip this plugin with clear error. Circular requires = error (authorship bug).
2. `needs` — must be satisfiable by the system (GraphCore, providers). Not dependent on other plugins.
3. `wants` — best effort wiring. Both plugins load independently, wiring happens after. Never fails, just warns on unmet wants.

**Q4: Multiple providers for same capability** — RESOLVED

**Resolution:** Depends on capability type.

**Singleton capabilities** (only one provider makes sense):
- `exposure: 'mcp'` — one MCP server
- `exposure: 'rest'` — one REST API
- **Error on duplicate.** Forces user to choose.

**Aggregate capabilities** (multiple providers combine):
- `tools: [...]` — merge all tools
- **Merge arrays.** Name collisions within aggregates = error.

**Q5: Schema validation on unloaded plugin** — RESOLVED

**Resolution:** Schemas are suggestive, not prescriptive.

- Unknown namespace = just properties. No schema = no validation.
- Data exists and flows through normally.
- Plugin reinstall picks up schema validation again.

Key benefit: Uninstall → reinstall is seamless. Namespace data hibernates while plugin is gone, wakes up when plugin returns.

**Q6: MCP package split** — RESOLVED

**Resolution:** MCP becomes a separate module following the plugin interface.

- MCP is installable/optional — Roux works without it (programmatic access via GraphCore)
- Core modules follow the same plugin interface pattern
- Opens door for alternative exposure modules (REST, CLI)

**Q7: Uninstall cleanup** — RESOLVED

**Resolution (MVP):** Uninstall = unregister. Data persists. Post-MVP cleanup UI is deferred.

**Q8: Graceful degradation policy** — RESOLVED (by Q3)

Clear via three-tier model:
- `requires` — fatal, plugin won't load
- `needs` — must be satisfied or plugin can't function  
- `wants` — always graceful, reduced functionality

**Q12: Permission scopes** — PARTIALLY RESOLVED (see Q26 for cross-plugin access)

Two-dimensional: **scope** (local/global) × **mode** (read/readwrite).

| Scope | Mode | Query | Write |
|-------|------|-------|-------|
| `local` | `read` | Nodes with own namespace | None |
| `local` | `readwrite` | Nodes with own namespace | Core fields + own namespace (on touched nodes) |
| `global` | `read` | All nodes | None |
| `global` | `readwrite` | All nodes | Core fields + own namespace (on any node) |

**Core fields:** title, content, tags, properties (shared node data).
**Own namespace:** `node.plugins[pluginId]` (plugin-specific data).
**Cross-plugin namespace access:** See Q26 — decision pending on whether `requires` grants write access to other plugins' namespaces.

### Deferred (Post-MVP)

**Q9: Plugin discovery & configuration** — How users find and configure plugins. Programmatic loading sufficient for MVP.

**Q10: Plugin testing utilities** — Mock GraphCore, test fixtures. Test against real GraphCore for MVP.

**Q11: Version compatibility** — Semver contracts, version checking. Single-user project, not needed yet.

**Uninstall cleanup UI** — CLI prompts, flags, config for cleanup options. MVP just unregisters.

**Plugin Integration Contracts** — Explicit handshake for deep plugin-to-plugin integration.

---

## Motivation

- Bolt on functionality for specific projects without muddying core
- Project management, issue tracking, etc. as graph-native plugins
- Agents respect plugin nodes as graph data (route through MCP, not direct file access)
- Future path to community extensions

## Design Principles

### Storage Agnostic

Plugins define **domain models**, not storage locations. Plugin declares schemas; store provider translates to native storage.

- DocStore: frontmatter properties
- Neo4j (future): node properties, typed edges
- Plugin code unchanged across backends

### Store Owns All Data

Plugins don't "own" nodes or types. The store provider owns ALL data in the graph. Plugins:
- Define schemas they want validated
- Query data they care about
- Create/update nodes through GraphCore

### Plugin Namespacing

Each plugin's data lives in the `plugins` field, keyed by plugin ID. This prevents conflicts and enables composition.

```typescript
// Node structure
{
  id: 'some-issue.md',
  title: 'Fix the bug',
  content: '...',
  properties: { customField: 'user data' },  // user properties

  plugins: {                                  // plugin namespaces (optional)
    'plugin-pm': {
      status: 'open',
      priority: 'high',
      assignee: 'alex'
    },
    'plugin-time': {
      estimate: '2h',
      logged: '30m'
    }
  }
}
```

- `plugins` field is optional — created when first plugin writes to a node
- Each plugin's schema validates only its namespace (`node.plugins[pluginId]`)
- No conflicts — plugins isolated from each other and from user `properties`
- Multiple plugins can annotate the same node
- Query plugin-touched nodes: `where plugins['plugin-pm'] exists`
- **Namespace = query scope = permission boundary** (see Q1, Q12)

### Additive Schema Changes Only

Until a migration system exists, schema changes must be backwards-compatible:
- Can add fields, add enum values, add relationship types
- Cannot remove, rename, or change field types
- Breaking changes blocked at registration time

See [[Plugin Schema Migration]] for future migration support.

### Interface Longevity

Design interfaces to last. Breaking changes break all dependents. Abstract over storage, query through capabilities, not implementations.

### Graceful Degradation

Core principle. Plugins work with reduced functionality when `wants` are unmet. Uninstall doesn't delete data by default. Missing plugins don't crash the graph. Features degrade, systems continue.

### Uniform Module Interface

Core modules and plugins follow the same interface pattern. Whether a module ships with Roux or is installed separately, it implements the same plugin interface. This keeps architecture consistent and allows modules to be extracted or merged as needed.

## GraphCore as Orchestrator

GraphCore is the hub. Plugins don't know about each other — they declare what they provide and what they need, and Core wires them together.

```
┌─────────────────────────────────────────────────────────────┐
│                        GraphCore                            │
│                      (orchestrator)                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Tasks Plugin                         MCP Module           │
│   ─────────────                        ──────────           │
│   provides:                            provides:            │
│   - tools: [create_task, ...]          - exposure: 'mcp'    │
│   needs:                               wants:               │
│   - graphAccess: local+rw              - tools: [any]       │
│   wants:                                                    │
│   - exposure: ['mcp']                                       │
│                                                             │
│              GraphCore orchestrates the wiring:             │
│              - Tasks provides tools, wants MCP exposure     │
│              - MCP provides exposure, wants tools           │
│              → Core wires Tasks' tools to MCP               │
│              → Both work independently if other missing     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Dependency Model

Three tiers, from fatal to graceful:

```
┌─────────────────────────────────────────────────────────────┐
│                    Dependency Tiers                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  REQUIRES (fatal)                                           │
│  "I am an extension of plugin-X. Without it, I'm nothing."  │
│  → Rare. Plugin extensions, themes, adapters.               │
│  → Won't load without prerequisite.                         │
│  → Circular requires = error.                               │
│                                                             │
│  NEEDS (system capabilities)                                │
│  "I need these from the system to function."                │
│  → Graph access, providers (Embedding, LLM).                │
│  → Not dependent on other plugins.                          │
│  → Unmet = plugin can't function, clear error.              │
│                                                             │
│  WANTS (inter-plugin enhancement)                           │
│  "I want this if available. I work without it."             │
│  → Exposure (MCP, REST).                                    │
│  → Best-effort wiring after all plugins load.               │
│  → Unmet = warning, reduced functionality, never crash.     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Provides / Wants Matching

Plugins declare what they `provide`. Other plugins declare what they `want`. GraphCore matches them:

- **Singleton capabilities** (exposure) — one provider only, error on duplicate
- **Aggregate capabilities** (tools) — merge from all providers

Wiring happens after all plugins load. No plugin needs another plugin to load first (unless `requires`).

## Plugin Interface

```typescript
interface RouxPlugin {
  id: string;           // 'plugin-pm' — also the namespace key
  name: string;
  version: string;

  // Fatal dependency — won't load without these plugins (rare)
  requires?: string[];  // plugin IDs

  // What this plugin provides to others
  provides?: {
    tools?: ToolDefinition[];           // aggregate: merged
    exposure?: ExposureType[];          // singleton: one provider
  };

  // System capabilities required to function
  needs?: {
    graphAccess?: {
      scope: 'local' | 'global';
      mode: 'read' | 'readwrite';
    };
    providers?: ('Embedding' | 'LLM')[];
  };

  // Inter-plugin capabilities wanted (graceful if unmet)
  wants?: {
    exposure?: ExposureType[];          // "expose my tools via these"
  };

  // Schema for this plugin's namespace (suggestive, not prescriptive)
  schema?: PluginSchema;

  // Lifecycle
  register(context: PluginContext): Promise<void>;
  unregister(): Promise<void>;
}

interface PluginContext {
  core: GraphCore;
  query(options: QueryOptions): Promise<Node[]>;  // auto-scoped to plugin namespace
  permissions: { scope: 'local' | 'global'; mode: 'read' | 'readwrite' };
  providers: ProviderType[];            // which providers are available
  wiring: {
    exposures: ExposureType[];          // which exposure wants were met
  };
}
```

**Query methods:**
- `context.query()` — auto-scoped to plugin's namespace (safe default)
- `context.query({ ..., scope: 'global' })` — explicit global (requires global permission)
- `context.core.query()` — unscoped, full graph access

**Write restrictions:**
- `mode: 'read'` — all write operations throw
- `mode: 'readwrite'` — can write, but only to own namespace

## Schema System

Schemas are **suggestive, not prescriptive**. They define expected structure for a plugin's namespace but don't gatekeep data.

```typescript
interface PluginSchema {
  version: number;
  fields: FieldDefinition[];
  relationships?: RelationshipDefinition[];
}

interface FieldDefinition {
  name: string;
  type: 'string' | 'enum' | 'number' | 'date' | 'boolean' | 'reference' | 'array';
  required?: boolean;
  values?: string[];         // for enums
  targetTypes?: string[];    // for references
  items?: FieldDefinition;   // for arrays
  constraints?: Record<string, unknown>;
}

interface RelationshipDefinition {
  name: string;              // 'blocks', 'contains'
  targetTypes: string[];     // plugin IDs or 'any'
  directional: boolean;
  inverse?: string;          // query-time derived
}
```

- No schema = no validation (data flows through)
- Plugin unloaded = namespace data hibernates, reinstall wakes it up
- Project-level validation rules can add stricter enforcement if needed

## Uninstall Flow

When a plugin is removed:

1. Plugin's `unregister()` runs — internal state cleanup only
2. Namespace data persists (MVP)
3. Reinstall recovers full functionality

## Example: Project Management Plugin

```typescript
const pmPlugin: RouxPlugin = {
  id: 'plugin-pm',
  name: 'Project Management',
  version: '0.1.0',
  
  needs: {
    graphAccess: { scope: 'local', mode: 'readwrite' },
  },
  
  wants: {
    exposure: ['mcp'],
  },
  
  provides: {
    tools: [
      { name: 'create_issue', /* ... */ },
      { name: 'list_issues', /* ... */ },
    ],
  },
  
  schema: {
    version: 1,
    fields: [
      { name: 'type', type: 'enum', values: ['issue', 'epic'], required: true },
      { name: 'status', type: 'enum', values: ['open', 'in-progress', 'closed'] },
      { name: 'priority', type: 'enum', values: ['low', 'medium', 'high'] },
    ],
  },
  
  async register(context) {
    // Schema auto-registers from manifest — no explicit call needed
    // Plugin-specific initialization here if needed
  },

  async unregister() {},
};
```

## Example: Plugin Extension (uses requires)

```typescript
const pmGithubPlugin: RouxPlugin = {
  id: 'plugin-pm-github',
  name: 'PM GitHub Sync',
  version: '0.1.0',
  
  requires: ['plugin-pm'],
  
  needs: {
    graphAccess: { scope: 'local', mode: 'readwrite' },
  },
  
  provides: {
    tools: [{ name: 'sync_github_issues', /* ... */ }],
  },
  
  async register(context) {},
  async unregister() {},
};
```

## Example: Read-Only Global Plugin

```typescript
const reportsPlugin: RouxPlugin = {
  id: 'plugin-reports',
  name: 'Graph Reports',
  version: '0.1.0',
  
  needs: {
    graphAccess: { scope: 'global', mode: 'read' },
  },
  
  provides: {
    tools: [{ name: 'generate_report', /* ... */ }],
  },
  
  async register(context) {},
  async unregister() {},
};
```

## Package Architecture

| Layer | What | Package |
|-------|------|---------|
| **Core** | GraphCore, interfaces | `roux` |
| **Providers** | Store implementations | `@roux/docstore` |
| **Modules** | Exposure, capabilities | `@roux/mcp`, `@roux/rest` |
| **Plugins** | Domain functionality | `@roux/tasks`, `@roux/health` |

All follow the same plugin interface. Clear dependency direction: modules/plugins → core.

## MVP Scope

- Plugin interface with requires/needs/wants model
- GraphCore orchestration and wiring
- Namespaced data with scoped queries
- Two-dimensional permissions (scope × mode)
- Suggestive schema registration
- Singleton vs aggregate capability resolution
- Basic uninstall (unregister only, data persists)
- MCP as separate module

## Post-MVP

- [[Plugin Schema Migration]]
- [[Plugin MCP Integration]]
- [[Plugin Cross-Communication]]
- [[Plugin Sandboxing]] — already solved via scope
- [[Plugin Schema Composition]]
- [[Plugin Hot Reload]]
- [[Plugin Marketplace]]
- Uninstall cleanup UI (strip namespace, delete empty nodes)
- Plugin discovery & configuration
- Plugin testing utilities
- Version compatibility matrix
- Plugin Integration Contracts
