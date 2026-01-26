---
title: Plugin System
tags:
  - architecture
  - extensibility
  - mvp-next
---
# Plugin System

Modular extension system for Roux. Plugins extend graph capabilities, add MCP tools, and define schemas — without touching core infrastructure.

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
- Track which nodes they created (via `createdBy`)

### Plugin Namespacing

Each plugin's data lives in a namespaced object within the node, keyed by plugin ID. This prevents conflicts and enables composition.

```typescript
// Node structure (storage-agnostic)
{
  id: 'some-issue.md',
  title: 'Fix the bug',
  content: '...',
  
  createdBy: 'plugin-pm',           // tracks creator for uninstall
  
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

### Additive Schema Changes Only

Until a migration system exists, schema changes must be backwards-compatible:
- Can add fields, add enum values, add relationship types
- Cannot remove, rename, or change field types
- Breaking changes blocked at registration time

See [[Plugin Schema Migration]] for future migration support.

### Interface Longevity

Design interfaces to last. Breaking changes break all dependents. Abstract over storage, query through capabilities, not implementations.

### Graceful Degradation

Plugin responsibility. Core provides dependency info; plugin decides what works without optional deps. If a plugin can't function, it should fail loudly or disable itself — not silently degrade.

## Plugin Interface

```typescript
interface RouxPlugin {
  id: string;           // 'plugin-pm' — also the namespace key
  name: string;
  version: string;
  
  // What this plugin needs
  dependencies: {
    store: true;                      // requires ANY store provider
    providers?: ('Embedding' | 'LLM')[];
    optional?: ('Embedding' | 'LLM')[];
  };
  
  // Schema for this plugin's namespace (validated under node[plugin.id])
  schema?: PluginSchema;
  
  // Extend MCP with plugin-specific tools
  mcpTools?: ToolDefinition[];
  
  // Lifecycle
  register(core: GraphCore): Promise<void>;
  unregister(): Promise<void>;
}
```

Plugins use GraphCore methods directly (`core.createNode()`, `core.search()`, etc.). No separate query interface — GraphCore already abstracts storage.

On `register()`, plugin:
1. Registers its schema with core for validation
2. Sets up any listeners or state it needs
3. Uses GraphCore normally from then on

On `unregister()`, plugin handles its own cleanup. System can query `createdBy: pluginId` to help user decide what to do with orphaned nodes.

## Schema System

```typescript
interface PluginSchema {
  version: number;           // schema version (additive changes only until migrations exist)
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
  targetTypes: string[];     // plugin IDs or 'any'
  directional: boolean;
  inverse?: string;          // 'blocked-by' for 'blocks' (query-time derived)
}
```

### Schema Registration

```typescript
async register(core: GraphCore): Promise<void> {
  // Register schema — core validates node[this.id] against it
  core.registerSchema(this.id, this.schema);
  
  // Then just use core normally
  const myNodes = await core.search({ 
    where: { createdBy: this.id } 
  });
}
```

GraphCore holds the schema registry. On `createNode`/`updateNode`, if node has data in a registered plugin namespace, validate against that plugin's schema.

### Relationship Inverses

Inverse relationships (e.g., `blocked-by` for `blocks`) are **query-time derived**, not stored bidirectionally. For DocStore, the source file contains the forward link; the graph cache surfaces the inverse.

## Uninstall Flow

When a plugin is removed:

1. Plugin's `unregister()` runs — plugin handles its own cleanup
2. System queries `createdBy: pluginId` to find remaining nodes
3. User chooses: **delete** or **keep orphaned**
4. Orphaned nodes lose schema validation but remain in graph

## Example: Project Management Plugin

```typescript
const projectManagementPlugin: RouxPlugin = {
  id: 'plugin-pm',
  name: 'Project Management',
  version: '0.1.0',
  
  dependencies: {
    store: true,
    optional: ['Embedding'],  // semantic search on issues
  },
  
  schema: {
    version: 1,
    fields: [
      { name: 'type', type: 'enum', values: ['issue', 'epic', 'milestone'], required: true },
      { name: 'status', type: 'enum', values: ['open', 'in-progress', 'closed'] },
      { name: 'priority', type: 'enum', values: ['low', 'medium', 'high', 'critical'] },
      { name: 'assignee', type: 'string' },
      { name: 'target-date', type: 'date' },
    ],
    relationships: [
      { name: 'blocks', targetTypes: ['plugin-pm'], directional: true, inverse: 'blocked-by' },
      { name: 'parent', targetTypes: ['plugin-pm'], directional: true, inverse: 'children' },
    ],
  },
  
  mcpTools: [
    // get_open_issues, create_issue, etc.
  ],
  
  async register(core) {
    core.registerSchema(this.id, this.schema);
  },
  
  async unregister() {
    // Custom cleanup if needed
  },
};
```

## MVP Scope

- Plugin interface: id, name, version, dependencies, schema, mcpTools
- Schema registration and validation against plugin namespace
- Plugin namespacing in node structure
- `createdBy` tracking for nodes
- Uninstall with user choice (delete/keep orphaned)
- Additive-only schema changes (no migrations)
- Plugins use GraphCore directly

## Related Roadmap Items

- [[Plugin Schema Migration]] — breaking schema changes with data migration
- [[Plugin MCP Integration]] — tool merging, type-based routing, discovery
- [[Plugin Cross-Communication]] — eventing system beyond polling
- [[Plugin Sandboxing]] — capability-based permissions for untrusted plugins
- [[Plugin Schema Composition]] — cross-plugin schema extension
- [[Plugin Hot Reload]] — reload without restart
- [[Plugin Marketplace]] — community extensions with trust model
