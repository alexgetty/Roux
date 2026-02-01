---
title: Tag Utility
tags:
  - roadmap
  - plugin
  - future
---
# Feature: Tag Utility

Optional tag system for plugins and applications. **Not a core primitive.**

## Summary

Tags are useful for some workflows but redundant with graph linking. Rather than bake tags into the core Node schema, provide utilities for plugins/apps that want tag-like behavior.

## Why Not Core

Graph-native systems have better primitives:

| Need | Tag Approach | Graph Approach |
|------|--------------|----------------|
| Categorization | `tags: [recipe, korean]` | Link to `[[Korean Cuisine]]` hub |
| Filtering | Filter by tag | Query by link target |
| Clustering | Tag intersection | Graph traversal |
| Context | None (tag is just a string) | Hub note has content, synthesis |

Tags are lazy edges. In a graph system, explicit links are more powerful:
- Links can have context (the hub note itself)
- Links participate in traversal
- Links can be typed (future: edge types)

## Scope

If implemented, this is a **utility library**, not a core feature:

```typescript
// Future: @roux/tags utility
import { TagIndex } from '@roux/tags';

const tags = new TagIndex(graph, {
  taxonomy: 'hierarchical',  // flat | hierarchical | strict
  source: 'frontmatter',     // where tags live
  namespace: 'tags',         // frontmatter field
});

// Query
tags.find('recipe');
tags.children('cuisine/asian');
tags.suggest(node);  // based on content
```

## Configuration Options (Future)

| Option | Values | Description |
|--------|--------|-------------|
| `taxonomy` | `flat`, `hierarchical`, `strict` | Structure enforcement |
| `source` | `frontmatter`, `inline`, `both` | Where to read tags |
| `namespace` | string | Frontmatter field name |
| `allowed` | string[] | Strict mode: only these tags |
| `separator` | string | Hierarchy separator (default: `/`) |

## Not In Scope

- Tags as core Node field
- Tag-specific MCP tools in core
- Tag validation in core parser
- searchByTags in core API (deprecated, use plugin)

## Related

- [[decisions/Node Identity]] — defines core fields (tags excluded)
- [[1.0 Vision - Node Schema]] — context namespacing (tags can live in a context)
- [[1.0 Vision - Ontology System]] — type system (use `type` for categorization, not tags)
