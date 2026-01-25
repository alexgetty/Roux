# Issue: Frontmatter Properties Discarded During Parsing

## Summary

The Roux parser correctly extracts YAML frontmatter from markdown files but discards all properties except a hardcoded subset (`type`, `tags`, `verified`, `created`). Domain-specific properties defined in frontmatter are lost and never exposed through the MCP API.

## Observed Behavior

**Input file** (`graph/Recipes/Example.md`):
```yaml
---
type: recipe
servings: 4
prep_time: 20
cook_time: 30
cuisine: "[[Italian]]"
difficulty: "[[Intermediate]]"
source: https://example.com/recipe
shelf_life_fridge: 4 days
freezes_well: true
---

## Instructions
...
```

**MCP `get_node` response**:
```json
{
  "id": "graph/recipes/example.md",
  "title": "Example",
  "content": "## Instructions\n...",
  "tags": [],
  "entity_type": "recipe"
}
```

**Expected**: All frontmatter properties should be accessible, not just `type`.

## Root Cause

### 1. Parser extracts but discards (`core/parser.py`)

The `parse_frontmatter()` function at line 55 correctly parses YAML into a dict. However, `parse_note()` at line 94 only transfers specific fields to the `Note` dataclass:

```python
return Note(
    id=slug,
    title=title,
    content=body,
    entity_type=metadata.get('type'),      # Kept
    tags=tags,                              # Kept
    verified=metadata.get('verified'),     # Kept
    created=metadata.get('created'),       # Kept
    modified_at=mtime,
    outgoing_links=extract_wiki_links(body),
)
# Everything else in `metadata` is discarded
```

### 2. Note dataclass is hardcoded (`core/parser.py:10-22`)

```python
@dataclass
class Note:
    id: str
    title: str
    content: str
    entity_type: str | None = None
    tags: list[str] = field(default_factory=list)
    verified: str | None = None
    created: str | None = None
    modified_at: float = 0.0
    outgoing_links: list[str] = field(default_factory=list)
```

No field exists to hold arbitrary properties.

### 3. Tools layer has no access to properties (`tools.py:97-126`)

`get_note()` returns a dict built from Note fields. Since properties were never stored, they can't be returned.

## Impact

- **Schema validation impossible**: Can't verify nodes against domain schemas
- **Filtering by property broken**: Can't query "all recipes with prep_time < 30"
- **Computed fields useless**: Domain logic can't access source data
- **Graph semantics lost**: Properties like `cuisine: "[[Italian]]"` contain links that should be traversable

## Proposed Solution

Add a generic `properties` field to capture all frontmatter. This keeps Roux domain-agnostic while exposing domain-specific data.

### Option A: Simple dict field (recommended)

**Changes to `core/parser.py`**:

```python
@dataclass
class Note:
    id: str
    title: str
    content: str
    entity_type: str | None = None
    tags: list[str] = field(default_factory=list)
    properties: dict = field(default_factory=dict)  # NEW: all frontmatter
    verified: str | None = None
    created: str | None = None
    modified_at: float = 0.0
    outgoing_links: list[str] = field(default_factory=list)
```

```python
def parse_note(path: Path) -> Note:
    # ... existing parsing ...
    metadata, body = parse_frontmatter(content)

    # Extract reserved fields
    tags = metadata.pop('tags', [])
    entity_type = metadata.pop('type', None)
    verified = metadata.pop('verified', None)
    created = metadata.pop('created', None)

    # Everything remaining goes to properties
    properties = metadata  # All other frontmatter

    return Note(
        # ... existing fields ...
        properties=properties,
    )
```

**Changes to `tools.py`**:

```python
def get_note(self, slug: str, depth: int = 1) -> dict[str, Any] | None:
    note = self.db.get_note(slug)
    if note is None:
        return None

    result = {
        'id': slug,
        'title': note['title'],
        'entity_type': note['entity_type'],
        'content': note['content'],
        'tags': note['tags'],
        'properties': note['properties'],  # NEW
        'verified': note['verified'],
        'links_to': self.db.get_outgoing_links(slug),
        'linked_from': self.db.get_incoming_links(slug),
    }
    # ...
```

**Changes to `core/database.py`**:

The database storage layer needs to persist and retrieve the `properties` dict. Implementation depends on backend (SQLite JSON column, document store field, etc.).

### Option B: Flatten properties into response

Instead of nesting under `properties`, merge them at the top level of the response:

```json
{
  "id": "graph/recipes/example.md",
  "title": "Example",
  "entity_type": "recipe",
  "servings": 4,
  "prep_time": 20,
  "cuisine": "[[Italian]]"
}
```

**Tradeoff**: Simpler access (`node.servings`) but risks key collisions with reserved fields.

### Option C: Schema-aware parsing

Allow vaults to define a schema that specifies which frontmatter fields to extract and their types. More complex but enables validation.

**Not recommended for initial fix** — adds significant complexity.

## Recommended Approach

Implement **Option A** first:
1. Add `properties: dict` to Note dataclass
2. Store remaining frontmatter after extracting reserved fields
3. Thread through database layer
4. Expose in MCP tool responses

This is:
- **Backwards compatible**: Existing fields unchanged
- **Domain agnostic**: Works for any vault schema
- **Minimal changes**: ~20 lines of code
- **Extensible**: Future schema validation can consume `properties`

## Testing

After implementation, verify:

1. **Parsing**: `parse_note()` populates `properties` with non-reserved frontmatter
2. **Storage**: Database round-trips `properties` correctly
3. **MCP API**: `get_node` response includes `properties` dict
4. **Edge cases**:
   - Empty frontmatter → `properties: {}`
   - No frontmatter → `properties: {}`
   - Nested YAML structures preserved
   - Wiki-links in property values (e.g., `cuisine: "[[Italian]]"`) stored as strings

## Additional Consideration: Property Links

Properties may contain wiki-links (`cuisine: "[[Italian]]"`). Currently these are:
- Not extracted as outgoing links
- Not traversable in graph queries

**Future enhancement**: Parse property values for wiki-links and add to `outgoing_links`. This enables queries like "find all recipes linked to Italian cuisine via the `cuisine` property."

This is a separate issue but worth noting as a follow-up.
