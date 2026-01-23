# SQLiteStore

Embedded SQLite-based [[StoreProvider]] implementation. No external server required.

## Overview

SQLiteStore provides graph storage without the file-watching complexity of [[DocStore]] or the infrastructure of standalone databases. Good for applications that need persistent graphs but not human-editable files.

## Use Cases

- Programmatically built graphs (not from documents)
- Applications that don't need Obsidian compatibility
- Intermediate scale before graduating to Neo4j
- Offline-first applications

## Schema (Conceptual)

```sql
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  tags TEXT,  -- JSON array
  properties TEXT,  -- JSON object
  created_at DATETIME,
  updated_at DATETIME
);

CREATE TABLE edges (
  source_id TEXT REFERENCES nodes(id),
  target_id TEXT REFERENCES nodes(id),
  type TEXT,
  properties TEXT,  -- JSON object
  PRIMARY KEY (source_id, target_id)
);

CREATE TABLE embeddings (
  node_id TEXT PRIMARY KEY REFERENCES nodes(id),
  vector BLOB,
  model TEXT,
  created_at DATETIME
);
```

## Tradeoffs vs DocStore

| Aspect | SQLiteStore | DocStore |
|--------|-------------|----------|
| Source of truth | SQLite | Files |
| Human-editable | No | Yes |
| File watching | Not needed | Required |
| Obsidian compatible | No | Yes |
| Graph projection | Not needed | Required |

## Tradeoffs vs Neo4j

| Aspect | SQLiteStore | Neo4j |
|--------|-------------|-------|
| Infrastructure | None | Server |
| Scale | ~100K nodes | Millions |
| Complex traversals | Slower | Native |
| Offline | Yes | Depends |

## Roadmap

Phase 4 deliverable. Not part of MVP.

## Related

- [[StoreProvider]] — Interface it implements
- [[DocStore]] — Alternative for document-based graphs
- [[Neo4j]] — Alternative for scale
- [[LevelGraph]] — Alternative embedded option
