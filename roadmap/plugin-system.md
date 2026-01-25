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

### Interface Longevity
Design interfaces to last. Breaking changes break all dependents. Abstract over storage, query through capabilities, not implementations.

### Graceful Degradation
Plugin responsibility. Core provides dependency info; plugin decides what works without optional deps.

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
  
  // Node types this plugin owns
  ownsTypes: string[];
  
  // Extend MCP with plugin-specific tools
  mcpTools?: ToolDefinition[];
  
  // Lifecycle
  register(core: GraphCore): Promise<void>;
  unregister?(): Promise<void>;
}
```

## Schema System

```typescript
interface NodeSchema {
  type: string;              // 'issue', 'epic', 'milestone'
  extends?: string;          // 'base' or another schema
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
  inverse?: string;          // 'blocked-by' for 'blocks'
}
```

## Store Query Interface

Plugins query through abstract interface. Store provider implements translation.

```typescript
interface StoreQueryable {
  findByType(type: string, opts?: QueryOpts): Promise<Node[]>;
  findBySchema(schema: string, opts?: QueryOpts): Promise<Node[]>;
  createTypedNode(type: string, content: NodeContent): Promise<Node>;
}
```

## Schema Composition & Namespace Resolution

Schemas are compositional. Multiple plugins can define overlapping fields.

### Compatibility Detection

```typescript
type SchemaCompatibility = 'identical' | 'compatible' | 'conflict';
```

**Identical**: Same name, type, constraints → merge silently, shared ownership

```
plugin-a: { status: { type: 'enum', values: ['open', 'closed'] } }
plugin-b: { status: { type: 'enum', values: ['open', 'closed'] } }
→ shared field, no namespace
```

**Compatible**: Same name, type; superset/subset constraints → merge to union, log extension

```
plugin-a: { priority: ['low', 'medium', 'high'] }
plugin-b: { priority: ['low', 'high', 'critical'] }
→ merged: ['low', 'medium', 'high', 'critical']
```

**Conflict**: Same name, incompatible types → auto-namespace latecomer

```
plugin-a: { status: { type: 'enum' } }
plugin-b: { status: { type: 'string' } }
→ plugin-b gets 'plugin-b:status'
```

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

Determines primary namespace ownership. Must be deterministic.

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

- Explicit array = explicit order
- Plugins not in array = alphabetical, appended after explicit list
- Same plugins = same resolution, always

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
      extends: 'base',
      fields: [
        { name: 'status', type: 'enum', values: ['planning', 'active', 'completed'] },
        { name: 'milestone', type: 'reference', targetTypes: ['milestone'] },
      ],
    },
    {
      type: 'milestone',
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
};
```

## Phases

### Phase 1: MVP
- Plugin interface with id, dependencies, schemas, ownsTypes
- Basic registration lifecycle
- Schema conflict detection (identical/compatible/conflict)
- Auto-namespace resolution
- StoreQueryable interface for DocStore

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

## Open Questions

- Should plugins be able to extend other plugins' schemas?
- Event system for cross-plugin communication?
- Versioning strategy for schema evolution?
