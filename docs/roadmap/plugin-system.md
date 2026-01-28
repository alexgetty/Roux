---
title: Plugin System
tags:
  - architecture
  - extensibility
  - mvp-next
---
# Plugin System

Modular extension system for Roux. Plugins extend graph capabilities, add MCP tools, and define schemas — without touching core infrastructure.

## Open Questions

Red team review surfaced these gaps. **All MVP blockers resolved.**

### Resolved

**Q1: Query semantics for namespaced data** — RESOLVED

**Resolution:** Scoped by default, global opt-in.

```typescript
// Default: scoped to own namespace (safe)
context.search({ where: { status: 'open' } })
// → Only searches plugin-pm.status
// → Returns nodes this plugin has touched

// Explicit: global namespace (wide net)
context.search({ where: { status: 'open' }, scope: 'global' })
// → Searches *.status across all namespaces
// → Plugin handles potentially mixed results

// Core properties always global:
context.search({ where: { tags: ['urgent'] } })
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

- If `node['plugin-pm']` exists, plugin-pm has data there
- Query: `nodes where 'plugin-pm' namespace exists`
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
  events?: string[];          // event subscriptions
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
- `events: [...]` — merge all event streams
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

**Q12: Permission scopes** — RESOLVED (by Q1)

Two-dimensional: **scope** (local/global) × **mode** (read/readwrite).

| Scope | Mode | Query | Write |
|-------|------|-------|-------|
| `local` | `read` | Own namespace only | None |
| `local` | `readwrite` | Own namespace only | Own namespace on touched nodes |
| `global` | `read` | All nodes | None |
| `global` | `readwrite` | All nodes | Own namespace on any node |

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

Each plugin's data lives in a namespaced object within the node, keyed by plugin ID. This prevents conflicts and enables composition.

```typescript
// Node structure (storage-agnostic)
{
  id: 'some-issue.md',
  title: 'Fix the bug',
  content: '...',
  
  'plugin-pm': {                     // PM plugin's namespace
    status: 'open',
    priority: 'high',
    assignee: 'alex'
  },
  
  'plugin-time': {                   // Time plugin's namespace (same node!)
    estimate: '2h',
    logged: '30m'
  }
}
```

- Each plugin's schema validates only its namespace (`node[pluginId]`)
- No conflicts — plugins can't step on each other's fields
- Multiple plugins can annotate the same node
- Store provider handles mapping to storage format (frontmatter, properties, etc.)
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
│  → Exposure (MCP, REST), events.                            │
│  → Best-effort wiring after all plugins load.               │
│  → Unmet = warning, reduced functionality, never crash.     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Provides / Wants Matching

Plugins declare what they `provide`. Other plugins declare what they `want`. GraphCore matches them:

- **Singleton capabilities** (exposure) — one provider only, error on duplicate
- **Aggregate capabilities** (tools, events) — merge from all providers

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
    events?: string[];                  // aggregate: merged
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
    events?: string[];                  // "subscribe to these events"
  };

  // Schema for this plugin's namespace (suggestive, not prescriptive)
  schema?: PluginSchema;

  // Lifecycle
  register(context: PluginContext): Promise<void>;
  unregister(): Promise<void>;
}

interface PluginContext {
  core: GraphCore;
  search(query: SearchQuery): Promise<Node[]>;  // auto-scoped
  permissions: { scope: 'local' | 'global'; mode: 'read' | 'readwrite' };
  providers: ProviderType[];            // which providers are available
  wiring: {
    exposures: ExposureType[];          // which exposure wants were met
    events: string[];                   // which event wants were met
  };
}
```

**Query methods:**
- `context.search()` — auto-scoped to plugin's namespace (safe default)
- `context.search({ ..., scope: 'global' })` — explicit global (requires global permission)
- `context.core.search()` — core properties only (title, tags, content)

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
  type: 'string' | 'enum' | 'number' | 'date' | 'boolean' | 'reference';
  required?: boolean;
  values?: string[];         // for enums
  targetTypes?: string[];    // for references
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
    context.core.registerSchema(this.id, this.schema);
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
