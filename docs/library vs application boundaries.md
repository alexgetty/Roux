---
id: N1FbiY18zK9p
title: Library vs Application Boundaries
tags:
  - architecture
  - guide
---
# Library vs Application Boundaries

Roux is a **library**, not a **framework** or **platform**. This distinction shapes every architectural decision.

## The Core Principle

Roux provides graph-general capabilities. Applications provide domain-specific logic.

| Concern | Belongs In | Example |
|---------|-----------|---------|
| Semantic search | Roux | `search({ query: "..." })` |
| Task status validation | App | `TaskSchema.parse(data)` |
| Link traversal | Roux | `getNeighbors({ id, depth })` |
| Project hierarchies | App | `getProjectTasks(projectId)` |
| Node CRUD | Roux | `createNode`, `updateNode` |
| Business rules | App | "Tasks can't move from done to todo" |

**Litmus test**: Replace your domain noun with another (task → recipe → bookmark). If the feature still makes sense, it might belong in Roux. If it breaks, it's an app concern.

## Layered Architecture

```
┌─────────────────────────────────────────────────────┐
│              Your Application                       │
│  ┌───────────────────────────────────────────────┐  │
│  │         Domain Layer (your code)              │  │
│  │  - Schemas (Zod, TypeScript types)            │  │
│  │  - Validation rules                           │  │
│  │  - Business logic                             │  │
│  └───────────────────────────────────────────────┘  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │     MCP     │ │     GUI     │ │   Obsidian  │   │
│  │  Interface  │ │  Interface  │ │   Plugin    │   │
│  └─────────────┘ └─────────────┘ └─────────────┘   │
└─────────────────────────┬───────────────────────────┘
                          │ calls
                          ▼
┌─────────────────────────────────────────────────────┐
│                      Roux                           │
│  ┌───────────────────────────────────────────────┐  │
│  │              Interface Layer                  │  │
│  │         (MCP Server, REST, CLI)               │  │
│  ├───────────────────────────────────────────────┤  │
│  │               [[GraphCore]]                   │  │
│  │      (Orchestration, search, traversal)       │  │
│  ├───────────────────────────────────────────────┤  │
│  │                 Plugins                       │  │
│  │       (Store, Embedding, LLM, Hooks)          │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## The Extension Boundary

**Plugin** = Extends Roux by implementing internal interfaces
**Application** = Uses Roux's public API

**Litmus test**: Can this be built by someone who only reads the API docs?
- Yes → Application
- No → Plugin

### Unified Plugin Model

Plugins are the single extension mechanism. There's no distinction between "providers" and "plugins" in the API—a plugin simply implements one or more interfaces, and GraphCore wires it up accordingly.

```typescript
graphCore.registerPlugin({
  id: 'my-plugin',
  // Implement what you need—GraphCore inspects the shape
  store: { getNode, createNode, ... },      // Becomes the StoreProvider
  embedding: { embed, ... },                 // Becomes the EmbeddingProvider  
  hooks: { onNodeCreate, onSearch, ... },    // Wired into lifecycle
  ranker: { rank, ... },                     // Participates in search scoring
});
```

This is structural typing for plugins. You don't declare what "type" of plugin you are—you implement capabilities, and GraphCore figures out what you are.

### Implementable Interfaces

| Interface | Purpose | Cardinality |
|-----------|---------|-------------|
| `store` | Node persistence, graph structure | Required, 1+ (see [[roadmap/Multi-Store Architecture]]) |
| `embedding` | Vector generation | Optional, 0-1 |
| `llm` | Text generation | Optional, 0-1 |
| `cache` | Performance caching | Optional, 0-1 |
| `hooks` | Lifecycle events | Optional, 0-many |
| `ranker` | Search result scoring | Optional, 0-many |

A single plugin can implement multiple interfaces. A plugin providing storage could also register lifecycle hooks.

## Case Studies

### Clear Plugins

| Plugin | Implements | Why It's a Plugin |
|--------|------------|-------------------|
| PostgresStore | `store` | Implements StoreProvider interface |
| PineconeEmbedding | `embedding` | Implements EmbeddingProvider interface |
| Custom ranker | `ranker` | Hooks into search scoring pipeline |
| File watcher | `hooks` | Needs `onFileChange` lifecycle events |
| Link syntax parser | Internal | Modifies link extraction behavior |

### Clear Applications

| Application | Domain | Why It's an App |
|-------------|--------|-----------------|
| Project manager | Tasks, epics, sprints | Domain schemas, state machines, business rules |
| Recipe manager | Ingredients, techniques | Domain ontology, scaling logic, unit conversion |
| Personal CRM | Contacts, interactions | Relationship tracking, reminder rules |
| Research assistant | Sources, claims | Citation logic, validity scoring |
| Zettelkasten tool | Atomic notes | Linking conventions, ID generation |
| Spaced repetition | Cards, intervals | SM-2 algorithm, scheduling logic |

### Gray Areas (Resolved)

| Feature | Plugin or App? | Resolution |
|---------|----------------|------------|
| "Suggest related notes" | **App** | Uses `search()` API, app decides relevance threshold |
| "Auto-link detection" | **Plugin** | Needs to hook into write pipeline via `hooks.onNodeCreate` |
| "Weekly summary generation" | **App** | Calls `search()` + `getNeighbors()`, formats output |
| "Custom wiki-link syntax" | **Plugin** | Modifies link parser internals |
| "Template scaffolding" | **App** | Just calls `createNode()` with pre-filled content |

## Schema Ownership

Roux is schema-agnostic. It stores whatever properties you give it without validation.

**Your app defines schemas:**

```typescript
// In your app, not in Roux
const TaskSchema = z.object({
  type: z.literal('task'),
  status: z.enum(['todo', 'in-progress', 'done']),
  epic: z.string().optional(),
  estimate: z.number().optional(),
});

function createTask(data: TaskInput) {
  const validated = TaskSchema.parse(data);
  return graphCore.createNode({
    id: `projects/tasks/${slug}.md`,
    properties: validated,
    tags: ['task'],
  });
}
```

**Your app enforces rules:**

```typescript
function transitionTask(taskId: string, newStatus: Status) {
  const task = await graphCore.getNode(taskId);
  
  // Business rule: can't go backwards
  if (task.properties.status === 'done' && newStatus !== 'done') {
    throw new Error('Cannot reopen completed tasks');
  }
  
  return graphCore.updateNode(taskId, {
    properties: { ...task.properties, status: newStatus }
  });
}
```

Roux doesn't know what a "task" is. It doesn't validate status transitions. That's your domain.

## Namespace Clarification

Three tiers exist, but only two are Roux's concern:

| Namespace | Purpose | Managed By |
|-----------|---------|------------|
| `_roux/*` | Core system internals | Roux |
| `_plugin/{id}/*` | Plugin internal state | Plugins that need private storage |
| Everything else | Application data | Your app via conventions |

**Applications don't get namespaces from Roux.** They organize data however they want:
- Path conventions: `projects/*.md`, `recipes/*.md`
- Tags: `['task', 'project-alpha']`
- Properties: `{ domain: 'project-manager' }`

If you need hard isolation between applications on a shared Roux instance, that's access control—a deployment concern, not an architecture one.

## Interface Extensions

If your app exposes an MCP server, that's *your* MCP server using Roux as a backend—not a plugin to Roux's MCP server.

```typescript
// Your project manager's MCP server
import { GraphCore } from 'roux';

const projectMCP = createMCPServer({
  tools: {
    create_task: (args) => /* calls graphCore.createNode() */,
    list_tasks: (args) => /* calls graphCore.search() */,
  }
});
```

No plugin architecture needed. You're building software that uses a library.

## The Temptation to Resist

When you're both the library author and the app author, you'll be tempted to add conveniences to Roux. Resist.

**Don't add to Roux:**
- Domain-specific schemas
- Validation rules for specific use cases
- Convenience methods for your app's patterns
- "Smart" defaults that assume a particular domain

**Do add to Roux:**
- Graph-general capabilities any app could use
- Performance optimizations that benefit all consumers
- Plugin implementations for common backends

The best foundation does less but does it reliably.

## Related

- [[GraphCore]] — The hub that orchestrates plugins
- [[GPI]] — What Roux provides
- [[roadmap/Multi-Store Architecture]] — Future: multiple stores per GraphCore
