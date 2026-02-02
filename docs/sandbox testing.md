---
id: 6V4X21Z9FqqG
title: Sandbox Testing
tags:
  - docs
  - testing
  - workflow
---
# Sandbox Testing

Manual integration testing workflow for Roux before releases.

## Prerequisites

The sandbox is pre-configured in `/sandbox/` with:
- Test vault at `sandbox/vault/` (recipes, techniques, ingredients)
- Roux config at `sandbox/roux.yaml`
- Claude Code MCP config at `sandbox/.claude/mcp.json`
- Cache directory at `sandbox/.roux/`

## Workflow

### 1. Build your changes

From the Roux root directory:

```bash
npm run build
```

### 2. Start Claude Code in sandbox

```bash
cd sandbox
claude
```

Claude Code will automatically start the local Roux MCP server using your freshly-built code.

### 3. Test manually

Exercise the MCP tools through natural conversation:

- **Search**: "Search for risotto"
- **Read**: "Show me the French Onion Soup recipe"
- **Create**: "Create a new recipe for pasta carbonara"
- **Update**: "Add a note to the Roux recipe"
- **Delete**: "Delete the test recipe I just created"
- **Graph**: "What links to Maillard Reaction?"
- **Resolve**: "Find nodes matching 'caramel'"

### 4. Run programmatic checks (optional)

For automated verification without Claude Code:

```bash
npm run sandbox
```

This builds and runs the check scripts in `sandbox/scripts/`.

## Troubleshooting

### Vector dimension mismatch

If you see "Dimension mismatch" errors, clear the vector cache:

```bash
rm sandbox/.roux/vectors.db
```

### MCP server not starting

Verify the build completed:

```bash
ls dist/cli/index.js
```

Check the config paths in `sandbox/.claude/mcp.json` are correct.

### Changes not reflected

Claude Code caches the MCP server process. Restart Claude Code after rebuilding:

```bash
# Exit Claude Code (Ctrl+C or /exit)
npm run build
cd sandbox && claude
```

## Test Vault Contents

The sandbox vault contains fixture data for testing:

```
vault/
├── recipes/
│   ├── French Onion Soup.md
│   ├── Risotto.md
│   └── Roux.md
├── techniques/
│   ├── Caramelization.md
│   ├── Maillard Reaction.md
│   └── Mise en Place.md
└── ingredients/
    ├── Arborio Rice.md
    ├── Beef Stock.md
    └── Gruyere.md
```

These docs are interlinked with wikilinks, providing graph traversal test cases.
