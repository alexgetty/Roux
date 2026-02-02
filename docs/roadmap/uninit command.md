---
id: LFV5M_NzpHIB
title: Uninit Command
tags:
  - roadmap
  - cli
  - cleanup
---
# Uninit Command

## Problem

When users uninstall Roux via `npm uninstall roux`, npm only removes the package from `node_modules` and `package.json`. It does not clean up Roux's own artifacts:

- `.roux/` directory (SQLite cache, embeddings database)
- `roux.yaml` configuration file
- `.mcp.json` roux server entry
- `.claude/settings.json` enforcement hook (legacy installs only - removed in 0.2.1)

This leaves orphaned files in the user's project after uninstallation.

## Proposed Solution

Add a `roux uninit` CLI command that reverses everything `roux init` does:

1. **Remove `.roux/` directory** - Delete the entire cache/data directory
2. **Remove `roux.yaml`** - Delete the config file
3. **Clean `.mcp.json`** - Remove the `roux` entry from `mcpServers` (leave other entries intact)
4. **Clean `.claude/settings.json`** - Remove the legacy roux enforcement hook if present (leave other hooks intact)

### CLI Interface

```bash
roux uninit [directory]
```

Options:
- `--keep-config` - Remove cache but preserve `roux.yaml`
- `--force` - Skip confirmation prompt

### Confirmation

By default, show what will be deleted and require confirmation:

```
This will remove:
  .roux/ (2.3 MB cache data)
  roux.yaml
  roux entry from .mcp.json

Are you sure? [y/N]
```

## Implementation Notes

- Must handle partial state (e.g., `.roux/` exists but `roux.yaml` doesn't)
- Should not fail if files are already missing
- Should clean `.mcp.json` gracefully (read, remove entry, write back) rather than deleting entire file
- Legacy hook cleanup: look for hooks containing `roux-enforce-mcp` marker in `.claude/settings.json` and remove them (this hook was removed in 0.2.1 but may exist in older installs)
- Consider npm `preuninstall` hook to automate this, though that has its own complications

## Related

- `src/cli/commands/init.ts` - The init logic this reverses
