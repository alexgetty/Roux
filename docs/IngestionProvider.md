# IngestionProvider

Data transformation and import.

## Overview

IngestionProvider transforms non-graph data into graph structure. It handles entity extraction, edge inference, format conversion, and batch import.

Think of it as the ETL layer for graphs.

## Interface

```typescript
interface IngestionProvider {
  // Entity extraction
  extractEntities(text: string): Promise<Entity[]>;

  // Edge inference
  inferEdges(nodes: Node[]): Promise<Edge[]>;

  // Format transformation
  transformCSV(csv: string, mapping: CSVMapping): Promise<Node[]>;
  transformJSON(json: object, mapping: JSONMapping): Promise<Node[]>;

  // Batch operations
  importBatch(nodes: Node[]): Promise<ImportResult>;
  importIncremental(nodes: Node[]): Promise<ImportResult>;
}

interface Entity {
  text: string;
  type: 'person' | 'place' | 'concept' | 'organization' | string;
  confidence: number;
}

interface Edge {
  source: string;
  target: string;
  type?: string;
  confidence: number;
}
```

## Use Cases

**Unstructured Text → Graph**
- Parse a document, extract entities
- Infer relationships between entities
- Create nodes and edges automatically

**Structured Data → Graph**
- CSV of people → Person nodes
- JSON API response → Nodes with relationships
- Database export → Graph representation

**Incremental Import**
- Add new data to existing graph
- Handle duplicates and merges
- Update existing nodes with new information

## Relationship to Other Providers

- Uses [[LLMProvider]] for intelligent extraction
- Outputs to [[StoreProvider]] for persistence
- Validated by [[ValidationProvider]] before commit

## Roadmap

Phase 3 deliverable. Not part of MVP.

## Related

- [[GraphCore]] — Coordinates ingestion operations
- [[LLMProvider]] — Powers intelligent extraction
- [[StoreProvider]] — Receives ingested nodes
- [[ValidationProvider]] — Validates before persist
