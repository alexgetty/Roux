---
title: Plugin System
tags:
  - architecture
  - extensibility
  - mvp-next
---
# Plugin System

Modular extension system for Roux. Plugins extend graph schema, add MCP tools, and own node types — without touching core infrastructure.

## Motivation

- Bolt on functionality for specific projects without muddying core
- Project management, issue tracking, etc. as graph-native plugins
- Agents respect plugin nodes as graph data (route through MCP, not direct file access)
- Future path to community extensions / marketplace

## Design Principles

### Storage Agnostic
Plugins define **domain models**, not storage locations. Plugin declares node types and schemas; store provider translates to native queries.

- DocStore: frontmatter `type` field, internal path conventions
- Neo4j (future): node labels, typed edges
- Plugin code unchanged across backends

### Single Owner Per Type
Each node type is owned by one plugin with one schema and one version. Plugins don't layer onto each other's types — they define distinct types that *relate* via edges.

This keeps versioning simple: `type: 'issue', schemaVersion: 2` unambiguously means plugin-pm's issue schema v2.

See [[Schema Composition]] for future composition options.

### Interface Longevity
Design interfaces to last. Breaking changes break all dependents. Abstract over storage, query through capabilities, not implementations.

### Graceful Degradation
Plugin responsibility. Core provides dependency info; plugin decides what works without optional deps. If a plugin can't function, it should fail loudly or disable itself — not silently degrade. Core is not responsible for plugin quality; market forces handle that.

## Plugin Interface

```typescript
interface RouxPlugin {
  id: string;
  name: string;
  version: string;
  
  // What this plugin needs
  dependencies: {
    store: true;  // requires ANY store provider
    providers?: ('Embedding' | 'LLM')[];
    optional?: ('Embedding' | 'LLM')[];
  };
  
  // Schemas this plugin introduces
  schemas: NodeSchema[];
  
  // Node types this plugin owns (must be unique across all plugins)
  ownsTypes: string[];
  
  // Extend MCP with plugin-specific tools
  mcpTools?: ToolDefinition[];
  
  // Lifecycle (both required)
  register(core: GraphCore): Promise<void>;
  unregister(cleanup: CleanupOptions): Promise<void>;
}

interface CleanupOptions {
  // User's choice when plugin is removed
  action: 'plugin-handles' | 'delete' | 'keep-orphaned';
}
```

## Schema System

```typescript
interface NodeSchema {
  type: string;              // 'issue', 'epic', 'milestone'
  version: number;           // schema version for migrations
  extends?: string;          // 'base' or another schema (same plugin only)
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
  name: string;              // 'blocks', 'contains', 'relates-to'
  targetTypes: string[];
  directional: boolean;
  inverse?: string;          // 'blocked-by' for 'blocks' (query-time derived)
}
```

### Relationship Inverses

Inverse relationships (e.g., `blocked-by` for `blocks`) are **query-time derived**, not stored bidirectionally. For DocStore, the source file contains the forward link; the graph cache or Obsidian backlinks surface the inverse.

This keeps markdown files clean and avoids bidirectional sync complexity.

## Store Query Interface

Plugins query through abstract interface. Store provider implements translation.

```typescript
interface StoreQueryable {
  findByType(type: string, opts?: QueryOpts): Promise<Node[]>;
  findBySchema(schema: string, opts?: QueryOpts): Promise<Node[]>;
  createTypedNode(type: string, content: NodeContent): Promise<Node>;
}
```

## Field Namespace Resolution

Multiple plugins can use the same field names (like `status`) for interoperability. The system merges compatible definitions into a shared namespace.

### Compatibility Detection

```typescript
type SchemaCompatibility = 'identical' | 'compatible' | 'conflict';
```

**Identical**: Same name, type, constraints → merge silently, shared namespace

```
plugin-a: { status: { type: 'enum', values: ['open', 'closed'] } }
plugin-b: { status: { type: 'enum', values: ['open', 'closed'] } }
→ shared field, no namespace prefix
```

**Compatible**: Same name, type; superset/subset constraints → merge to union

```
plugin-a: { priority: ['low', 'medium', 'high'] }
plugin-b: { priority: ['low', 'high', 'critical'] }
→ merged namespace: ['low', 'medium', 'high', 'critical']
```

**Conflict**: Same name, incompatible types → auto-namespace latecomer

```
plugin-a: { status: { type: 'enum' } }
plugin-b: { status: { type: 'string' } }
→ plugin-b gets 'plugin-b:status'
```

### Plugin Validation Scope

The merged namespace contains the union of all values. Each plugin validates only against **its own** accepted subset. How a plugin handles values outside its subset (ignore, treat as "other", error) is plugin-scoped, not system-scoped.

### Resolution Benefits

- De facto standards emerge without mandating
- Compatible schemas naturally converge
- Conflicts handled automatically, no plugin-by-plugin compatibility matrix
- System is the arbiter

### Context-Aware Resolution

- Bare field name (`status`) → resolves to primary owner
- Explicit namespace (`plugin-b:status`) → always works
- Plugin querying own nodes → system uses correct namespace automatically

## Registration Order

Determines primary namespace ownership. Must be deterministic and **persisted**.

```typescript
// roux.config.ts
export default {
  plugins: [
    'roux-plugin-core',    // position 1: highest priority
    'roux-plugin-pm',      // position 2
    'roux-plugin-custom',  // position 3
  ]
}
```

**Persistence rules:**
- Order is stored in config and preserved across runs
- New plugins not in explicit list are appended alphabetically
- User reordering is respected; new plugins still append to bottom
- Same plugins + same order = same resolution, always

## Cross-Plugin Communication

**Phase 1: Polling.** Plugins that need to react to other plugins' data poll the store or cache at their own frequency. No coordination required — each plugin decides its refresh strategy.

**Future: Eventing.** When patterns emerge, we may add an opt-in event system. Plugins can upgrade from polling to watching without breaking — eventing is an enhancement, not a replacement.

This keeps the core simple now while preserving a clean upgrade path.

## Uninstall Flow

When a plugin is removed, the system prompts the user:

1. **Plugin handles** — Plugin's `unregister()` runs with full cleanup authority
2. **Delete** — System deletes all nodes with types in `ownsTypes`
3. **Keep orphaned** — Nodes remain but lose schema validation and plugin-specific MCP tools

## Example: Project Management Plugin

```typescript
const projectManagementPlugin: RouxPlugin = {
  id: 'roux-plugin-pm',
  name: 'Project Management',
  version: '0.1.0',
  
  dependencies: {
    store: true,
    optional: ['Embedding'],  // semantic search on issues
  },
  
  ownsTypes: ['issue', 'epic', 'milestone', 'blocker'],
  
  schemas: [
    {
      type: 'issue',
      version: 1,
      extends: 'base',
      fields: [
        { name: 'status', type: 'enum', values: ['open', 'in-progress', 'closed'] },
        { name: 'priority', type: 'enum', values: ['low', 'medium', 'high', 'critical'] },
        { name: 'assignee', type: 'string' },
      ],
      relationships: [
        { name: 'blocks', targetTypes: ['issue'], directional: true, inverse: 'blocked-by' },
        { name: 'parent', targetTypes: ['epic'], directional: true, inverse: 'contains' },
      ],
    },
    {
      type: 'epic',
      version: 1,
      extends: 'base',
      fields: [
        { name: 'status', type: 'enum', values: ['planning', 'active', 'completed'] },
        { name: 'milestone', type: 'reference', targetTypes: ['milestone'] },
      ],
    },
    {
      type: 'milestone',
      version: 1,
      extends: 'base',
      fields: [
        { name: 'target-date', type: 'date' },
        { name: 'status', type: 'enum', values: ['upcoming', 'active', 'completed'] },
      ],
    },
  ],
  
  mcpTools: [
    // get_open_issues, create_issue, move_to_milestone, etc.
  ],
  
  async register(core) {
    // Register schemas, set up listeners, etc.
  },
  
  async unregister(cleanup) {
    if (cleanup.action === 'plugin-handles') {
      // Custom cleanup logic
    }
  },
};
```

## Phases

### Phase 1: MVP
- Plugin interface with id, dependencies, schemas, ownsTypes
- Required unregister() with cleanup options
- Schema conflict detection (identical/compatible/conflict)
- Auto-namespace resolution with persistence
- StoreQueryable interface for DocStore
- Schema versioning (field exists, not enforced)
- Cross-plugin communication via polling

### Phase 2: MCP Integration
- Plugin MCP tools merge into server
- Type-based routing for plugin-owned nodes
- Tool discovery for registered plugins

### Phase 3: Schema Validation
- Validate nodes against schemas on create/update
- Required field enforcement
- Relationship constraint checking

### Phase 4: Advanced Features
- Schema migrations when plugin updates
- Plugin-to-plugin dependencies
- Hot reload without restart
- [[Schema Composition]] (if needed)
- Event system for cross-plugin communication (if polling proves insufficient)
