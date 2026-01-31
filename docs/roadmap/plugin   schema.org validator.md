---
title: Plugin   Schema.Org Provider
tags:
  - roadmap
  - plugin
  - schema
  - ontology
  - provider
---
# Plugin: Schema.org Provider

Implementation of SchemaProvider wrapping the schema.org vocabulary. Ships with core as the default type system.

> **Note:** This was originally conceived as a standalone "validator plugin." The architecture has evolved — see [[1.0 Vision - Ontology System]] for the full SchemaProvider abstraction. This document now describes the schema.org *implementation* of that interface.

## Purpose

Provide schema.org types as the baseline vocabulary for Roux's ontology system:
- Type definitions for 800+ schema.org types
- Validation against type specifications
- Scaffolding of expected properties
- Type inference from content

## Implements SchemaProvider

```typescript
const schemaOrgProvider: SchemaProvider = {
  id: 'schema-org',
  
  listTypes(): TypeDefinition[] {
    // Return all cached schema.org types
  },
  
  getType(name: string): TypeDefinition | null {
    // Lookup Recipe, Article, Person, etc.
  },
  
  inferType(content: string): TypeMatch[] {
    // Semantic match against type descriptions
  },
  
  extractProperties(content: string, type: string): Record<string, unknown> {
    // Pull structured data from raw content
  },
  
  validate(node: Node): ValidationResult {
    // Check node against type definition
  },
  
  scaffold(type: string): Partial<Node> {
    // Return placeholder fields for type
  },
};
```

## Schema Cache

Downloaded and cached locally:

```
~/.roux/schema/
  schema-org/
    types/
      Recipe.json
      Article.json
      Person.json
      ...
    index.json
    embeddings.bin  # Type description embeddings for inference
```

Source: https://schema.org/version/latest/schemaorg-current-https.jsonld

## Property Mapping

Map Roux node fields to schema.org property names:

| Node Field | schema.org Property |
|------------|---------------------|
| `title` | `name` |
| `content` | `text` / `description` |
| `tags` | `keywords` |
| `[context].author` | `author` |
| `[context].prepTime` | `prepTime` |

The provider understands that user data lives in context namespaces.

## Type Inference

Semantic matching of node content against type descriptions:

1. Embed node content
2. Compare against cached type description embeddings
3. Return top matches with confidence scores

Requires EmbeddingProvider to be available (graceful degradation if not).

## MCP Tools

Exposed via the schema service namespace:

| Tool | Description |
|------|-------------|
| `schema.lookup` | Get type definition and properties |
| `schema.infer` | Infer type from content |
| `schema.validate` | Check node against type |
| `schema.scaffold` | Get placeholder fields for type |
| `schema.extract` | Pull structured data from content |

These are the schema.org implementations of the generic SchemaProvider capabilities.

## Implementation Phases

1. **Schema cache** — download, parse, cache schema.org
2. **Type lookup** — `getType()` implementation
3. **Validation** — `validate()` implementation
4. **Scaffolding** — `scaffold()` implementation
5. **Type inference** — `inferType()` with embeddings
6. **Extraction** — `extractProperties()` implementation

## Dependencies

- [[1.0 Vision - Ontology System]] — defines the SchemaProvider interface
- [[Plugin System]] — if shipped as optional plugin vs bundled
- EmbeddingProvider — for type inference (optional)
