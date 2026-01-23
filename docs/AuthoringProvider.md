# AuthoringProvider

Content creation assistance.

## Overview

AuthoringProvider helps create and maintain graph content. Templates, bulk operations, link suggestions, and auto-classification.

## Interface

```typescript
interface AuthoringProvider {
  // Templates
  applyTemplate(templateId: string, data: Record<string, any>): Node;
  listTemplates(): Template[];

  // Bulk operations
  batchCreate(nodes: Partial<Node>[]): Promise<Node[]>;
  batchUpdate(updates: Array<{ id: string; updates: Partial<Node> }>): Promise<Node[]>;

  // Link suggestions
  suggestLinks(node: Node): Promise<LinkSuggestion[]>;

  // Classification
  suggestTags(node: Node): Promise<TagSuggestion[]>;
  autoClassify(node: Node): Promise<string[]>;
}

interface Template {
  id: string;
  name: string;
  fields: TemplateField[];
  defaultContent: string;
}

interface LinkSuggestion {
  targetId: string;
  reason: string;
  confidence: number;
}

interface TagSuggestion {
  tag: string;
  reason: string;
  confidence: number;
}
```

## Use Cases

**Templates**
- Meeting note template: date, attendees, agenda, decisions
- Person template: name, role, contact, notes
- Project template: status, goals, milestones, links

**Bulk Operations**
- Import 100 notes at once
- Update all notes in a category
- Add a tag to multiple nodes

**Link Suggestions**
- "This note mentions 'distributed consensus'—link to [[Raft]]?"
- Based on content similarity via [[EmbeddingProvider]]
- Surface when authoring or on-demand

**Auto-tagging**
- Classify content automatically
- Suggest missing tags
- Powered by [[LLMProvider]]

## Relationship to Other Providers

- Uses [[LLMProvider]] for intelligent suggestions
- Uses [[EmbeddingProvider]] for similarity-based suggestions
- Outputs through [[StoreProvider]]
- Validated by [[ValidationProvider]]

## Related

- [[GraphCore]] — Exposes authoring tools
- [[LLMProvider]] — Powers intelligent suggestions
- [[EmbeddingProvider]] — Powers similarity-based suggestions
- [[StoreProvider]] — Persists authored content
