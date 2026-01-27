---
title: Config Parsing Consolidation
tags:
  - refactor
  - cleanup
---
## Category: Roadmap

## Observation

Config parsing happens in two places:
- `src/cli/commands/serve.ts` - parses YAML, creates providers manually
- `src/core/graphcore.ts:fromConfig()` - expects already-parsed config, creates providers

Both do similar provider instantiation work.

## Consideration

Consider a shared config loader that:
1. Reads and parses `roux.yaml`
2. Validates against schema
3. Returns typed `RouxConfig`

Then both CLI and `fromConfig` could use it, reducing duplication in provider creation logic.

Low priority—current separation works, but could simplify if more entry points are added.
