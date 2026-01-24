# Decision - CLI Workflow

**Status:** Decided
**Affects:** [[CLI]], [[DocStore]], [[Config]]

## Problem

CLI defines `init` and `serve` as separate commands, but their relationship is unclear:

- Does `serve` require prior `init`?
- Does `serve` auto-init if needed?
- Can you re-init an already initialized directory?
- What state does `init` create vs `serve`?

Users need a clear mental model.

## Current Understanding

```bash
roux init <directory>  # Scan, parse, embed, cache
roux serve             # Start MCP server, watch files
```

But what happens if:
1. `roux serve` on uninitialized directory?
2. `roux init` on already-initialized directory?
3. `roux serve` when cache exists but is stale?
4. Files change while server is not running?

## Options

### Option A: Strict separation

```
init: Creates .roux/ directory, roux.yaml, SQLite cache, embeddings
serve: Requires .roux/ to exist. Fails if not initialized.

roux serve (no .roux/)  → Error: "Run 'roux init' first"
roux init (has .roux/)  → Error: "Already initialized. Use 'roux sync' to update."
```

**Pros:** Clear expectations. No magic. Explicit user control.
**Cons:** Extra step. Users will forget to init.

### Option B: serve auto-inits

```
serve: If no .roux/, run init automatically. Then serve.

roux serve (no .roux/)  → "Initializing..." then serves
roux serve (has .roux/) → Serves immediately
```

**Pros:** Just works. Fewer commands to learn.
**Cons:** Surprise initialization (slow first serve). Unclear when re-init happens.

### Option C: serve syncs, init is one-time setup

```
init: One-time setup. Creates roux.yaml with user prompts.
serve: Always syncs cache with files before serving. Auto-creates .roux/ if missing.

roux init   → Interactive setup (choose embedding provider, etc.)
roux serve  → Sync cache, then serve. Creates cache if needed.
```

**Pros:** init is for config, serve handles data. Clear separation.
**Cons:** serve startup potentially slow (sync).

### Option D: Unified command

```
roux serve <directory>  # Init if needed, then serve

No separate init command. serve does everything.
```

**Pros:** One command. Can't get it wrong.
**Cons:** No way to init without serving. Can't pre-warm cache.

## Sub-decisions

### Re-initialization

What does `init` do on an already-initialized directory?

- **Error**: "Already initialized"
- **Overwrite**: Blow away cache, rebuild from scratch
- **Merge**: Update config, preserve cache where valid
- **Prompt**: Ask user what they want

### Stale cache detection

How do we know cache is stale?

- File modified timestamps vs cache timestamps
- File count mismatch
- Config change (embedding model changed)
- Manual `--force` flag only

### Config creation

When is `roux.yaml` created?

- `init` creates with defaults
- `init` prompts for choices
- `serve` creates if missing
- Never auto-create, require user to write it

## Considerations

- Obsidian users expect "point and go" simplicity
- First-run experience matters
- Large directories need progress indication
- Config file is useful for version control

## Proposed Flow

```
Directory states:
1. Fresh      → No .roux/, no roux.yaml
2. Configured → Has roux.yaml, no .roux/
3. Cached     → Has roux.yaml and .roux/
4. Stale      → Has .roux/ but files changed while server was down

Commands:
init  → Fresh → Configured + Cached (creates config, builds cache)
init  → Configured → Cached (builds cache, preserves config)
init  → Cached → Error or refresh? (TBD)

serve → Fresh → Error "Run init first"
serve → Configured → Build cache, then serve
serve → Cached → Sync stale files, then serve
serve → Stale → Sync changes, then serve
```

## Questions to Resolve

1. ~~Should `serve` ever auto-init, or always require explicit `init`?~~ No. `serve` requires prior `init`. Fails with "Run 'roux init' first" if not initialized.
2. ~~Should `init` be interactive (prompt for embedding provider) or use defaults?~~ Defaults for MVP (no choices exist). Interactive prompts deferred to future when multiple providers available.
3. ~~How to handle `init` on already-initialized directory?~~ No-op. Print "Already initialized. Config at ./roux.yaml" — doesn't blow anything away.
4. ~~Should config creation be separate from cache building?~~ Yes. `init` creates config/structure. `serve` builds cache.

## Decision

**Mental model:** `init` = install Roux in project (like `git init`). `serve` = run Roux.

### `roux init <directory>`
- Creates `roux.yaml` with defaults
- Creates `.roux/` directory structure
- Does NOT build cache or generate embeddings (expensive work deferred to `serve`)
- On already-initialized directory: no-op, prints location of existing config

### `roux serve`
- Requires prior `init` (fails fast if not initialized)
- Builds/syncs cache if needed (first run or files changed)
- Loads graph from SQLite into memory
- Starts MCP server (stdio transport)
- Watches for file changes

### First run behavior
First `serve` after `init` is slower (full cache build, embedding generation). Subsequent runs are fast (load from SQLite, sync only changed files).

### MVP simplification
MVP is zero-config: DocStore + transformers.js only. No provider choices to make. `init` just creates defaults.

### Future (post-MVP)
- Interactive `init` when multiple providers exist
- `roux init --reconfigure` for changing settings
- Migration tooling when switching providers

## Outcome

Decided. `init` is explicit one-time setup, `serve` handles all runtime work. MVP uses defaults with no prompts.

## Related

- [[Decisions]] — Decision hub
- [[CLI]] — Command definitions
- [[Config]] — Configuration file
