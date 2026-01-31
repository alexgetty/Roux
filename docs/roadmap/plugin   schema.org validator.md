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

Validate nodes against schema.org types. Auto-detect types. Proactively scaffold metadata fields.

## Key Design Decisions

### 1. schema.org is behind-the-scenes

schema.org is the validation engine, **not a user-facing namespace**. Users don't write `schema-org.validated: true`. They write their data in their context namespace, and the validator works invisibly.

### 2. `type` is a core Node field

See [[1.0 Vision - Node Schema]]. Type is structural, same level as `id` and `title`.

### 3. Proactive metadata scaffolding

When a node's type is detected/declared, the validator can:
1. Auto-detect type from content (if not declared)
2. Validate against schema.org definition
3. **Add placeholder fields** for that type's expected properties
4. User or LLM fills them in later

```yaml
# Before (user creates)
---
title: Bulgogi
type: Recipe
recipes:
  source: Maangchi
---

# After (validator scaffolds)
---
title: Bulgogi
type: Recipe
recipes:
  source: Maangchi
  prepTime:      # placeholder - Recipe expects this
  cookTime:      # placeholder
  ingredients: []  # placeholder
---
```

This prompts completeness without blocking creation.

## Validation Trigger

Hook into DocStore file watcher pipeline:

```
file change → watcher → parser → [validate + scaffold] → node emitted
```

No separate hook system needed for MVP.

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
    typeValidator: true,  // Registers as a type validator
  },
  
  // Internal tracking (not user-facing)
  internalSchema: {
    lastValidated: 'date-time',
    validationErrors: 'string[]',
    inferredType: 'string',
    confidence: 'number',
  },
  
  mcpTools: [
    {
      name: 'schema_validate',
      description: 'Validate a node against its declared type',
      inputSchema: {
        type: 'object',
        properties: {
          nodeId: { type: 'string' },
          scaffold: { type: 'boolean', description: 'Add placeholder fields' },
        },
        required: ['nodeId'],
      },
    },
    {
      name: 'schema_infer',
      description: 'Infer type from node content',
      inputSchema: {
        type: 'object',
        properties: {
          nodeId: { type: 'string' },
          apply: { type: 'boolean', description: 'Apply inferred type' },
        },
        required: ['nodeId'],
      },
    },
    {
      name: 'schema_lookup',
      description: 'Get type definition and expected properties',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string' },
        },
        required: ['type'],
      },
    },
    {
      name: 'schema_scaffold',
      description: 'Add placeholder properties for a type',
      inputSchema: {
        type: 'object',
        properties: {
          nodeId: { type: 'string' },
          type: { type: 'string', description: 'Override detected type' },
        },
        required: ['nodeId'],
      },
    },
  ],
};
```

## Where Validation State Lives

The validator needs to track state (last validated, errors, etc.). Options:

1. **Internal cache** - not persisted in node, rebuilt on startup
2. **Hidden context** - `_schema-org` namespace (underscore = internal)
3. **Separate index** - plugin maintains its own database

**Leaning:** Internal cache for MVP. Validation is cheap to recompute. No need to clutter nodes with validation metadata.

## Property Mapping

Map node fields to schema.org property names:

| Node Field | schema.org Property |
|------------|---------------------|
| `title` | `name` |
| `content` | `text` / `description` |
| `tags` | `keywords` |
| `[context].author` | `author` |
| `[context].prepTime` | `prepTime` |

The validator understands that user data lives in their context namespace.

## Type Inference

Semantic matching of node content against type descriptions:

1. Embed node content
2. Compare against cached type description embeddings
3. Return top matches with confidence scores
4. Optionally apply highest-confidence type

## Schema Cache

```
~/.roux/plugins/schema-org/
  schemas/
    Recipe.json
    Article.json
    ...
  index.json
  embeddings.bin  # Type description embeddings
```

Source: https://schema.org/version/latest/schemaorg-current-https.jsonld

## Implementation Phases

1. **Schema cache** - download, parse, cache schema.org
2. **Type lookup** - `schema_lookup` tool
3. **Validation** - `schema_validate` tool
4. **Scaffolding** - `schema_scaffold` tool, proactive placeholders
5. **Type inference** - `schema_infer` with embeddings
6. **Pipeline integration** - auto-validate on file→node

## Dependencies

- [[Plugin System]] — core plugin infrastructure
- [[1.0 Vision - Node Schema]] — context-based namespacing
- [[1.0 Vision - Ontology System]] — this implements the ontology layer
