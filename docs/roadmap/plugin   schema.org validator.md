---
title: Plugin   Schema.Org Validator
tags:
  - roadmap
  - plugin
  - schema
  - ontology
  - priority
---
# Plugin: Schema.org Validator

First plugin implementation. Stress-tests the plugin architecture while delivering real value.

## Purpose

Validate nodes against schema.org types. Auto-suggest types from content. Enforce optional type constraints.

## Key Design Decision

**`type` is a core Node field, not plugin-owned.**

```typescript
interface Node {
  id: string;
  title: string;
  content: string;
  tags: string[];
  links: Link[];
  properties: Record<string, unknown>;
  type?: string;  // Core field - schema.org is one vocabulary
  plugins?: Record<string, Record<string, unknown>>;
}
```

Schema.org is a subset of the Roux type space. Nodes can have types that aren't schema.org types:
- `Recipe` → schema.org validates
- `Decision` → Decision Journal validates  
- `Task` → PM plugin validates
- `roux:CustomType` → user-defined, no validation

The schema.org plugin validates nodes whose `type` matches a schema.org type. It doesn't own the type field.

## Validation Trigger

**Hook into DocStore file watcher pipeline.**

No separate hook system needed for MVP. DocStore already has:

```
file change → watcher → parser → node emitted
```

Extend to:

```
file change → watcher → parser → [validate if type matches] → node emitted with validation
```

Validation result travels with the node. Plugins register validators for type patterns they handle.

## Plugin Manifest

```typescript
const schemaOrgPlugin: RouxPlugin = {
  id: 'schema-org',
  name: 'Schema.org Validator',
  version: '0.1.0',
  
  requires: [],
  needs: {
    storage: 'readwrite',
  },
  wants: {
    embedding: true,  // For type inference
  },
  provides: {
    typeValidator: ['schema:*', 'Recipe', 'Article', 'Person', ...],  // Types this plugin validates
  },
  
  schema: {
    validated: { type: 'boolean' },
    validatedAt: { type: 'string', format: 'date-time' },
    errors: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
    inferred: { type: 'boolean' },
  },
  
  mcpTools: [
    {
      name: 'schema_validate',
      description: 'Validate a node against its declared schema.org type',
      inputSchema: {
        type: 'object',
        properties: {
          nodeId: { type: 'string' },
          strict: { type: 'boolean', description: 'Fail on missing recommended fields' },
        },
        required: ['nodeId'],
      },
    },
    {
      name: 'schema_infer',
      description: 'Infer schema.org type from node content',
      inputSchema: {
        type: 'object',
        properties: {
          nodeId: { type: 'string' },
          apply: { type: 'boolean', description: 'Apply inferred type to node' },
        },
        required: ['nodeId'],
      },
    },
    {
      name: 'schema_lookup',
      description: 'Get schema.org type definition',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Type name (e.g., "Recipe")' },
        },
        required: ['type'],
      },
    },
    {
      name: 'schema_list_types',
      description: 'List available schema.org types',
      inputSchema: {
        type: 'object',
        properties: {
          parent: { type: 'string', description: 'Filter to subtypes' },
          search: { type: 'string', description: 'Search types' },
        },
      },
    },
  ],
  
  register: async (context: PluginContext) => {
    // Load schema.org definitions from cache
    // Register as validator for schema.org types
  },
};
```

## Core Functionality

### 1. Schema Cache

```
~/.roux/plugins/schema-org/
  schemas/
    Recipe.json
    Article.json
    ...
  index.json
```

Source: https://schema.org/version/latest/schemaorg-current-https.jsonld

### 2. Validation

```typescript
interface ValidationResult {
  valid: boolean;
  type: string;
  errors: string[];    // Missing required
  warnings: string[];  // Missing recommended
}
```

### 3. Type Inference

Semantic matching of node content against type descriptions. Suggests types for untyped nodes.

### 4. Property Mapping

| Node Field | schema.org Property |
|------------|---------------------|
| `title` | `name` |
| `content` | `text` / `description` |
| `tags` | `keywords` |
| `properties.author` | `author` |
| `properties.prepTime` | `prepTime` |

## Frontmatter

```yaml
---
title: Bulgogi
type: Recipe           # Core field
tags: [korean, beef]
properties:
  prepTime: PT30M
  cookTime: PT15M
plugins:
  schema-org:
    validated: true
    validatedAt: 2025-01-30T...
    warnings: ["Missing: recipeYield"]
---
```

## Stress Test Checklist

- [ ] Core `type` field on Node
- [ ] Plugin namespace for validation state
- [ ] DocStore pipeline validation hook
- [ ] MCP tools exposed
- [ ] External file caching
- [ ] Optional embedding for inference
- [ ] Type pattern matching (`provides.typeValidator`)

## Architecture Gaps Resolved

| Gap | Resolution |
|-----|------------|
| Hook access | Use DocStore file watcher pipeline |
| Type location | Core `node.type` field |
| File storage | `~/.roux/plugins/{id}/` |
| Embedding API | `context.getEmbedding(text)` |

## Implementation Phases

1. **Add `type` to Node interface** — core change
2. **Schema cache** — download/parse schema.org
3. **Validation logic** — `schema_validate` tool
4. **Pipeline integration** — validate on file→node
5. **Type inference** — `schema_infer` with embeddings

## Dependencies

- [[Plugin System]] — IB1-IB6 resolved
- Node `type` field added to core types
