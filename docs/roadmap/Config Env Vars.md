---
type: Roadmap Feature
status: Proposed
priority: Low
phase: Future
parent: "[[Config]]"
---

# Feature - Config Env Vars

Environment variable substitution in config files.

## Summary

Support `${ENV_VAR}` syntax in `roux.yaml` values.

## Current State

MVP: Static config values only. API keys must be hardcoded or passed via CLI.

## Proposed

```yaml
providers:
  embedding:
    type: openai
    apiKey: ${OPENAI_API_KEY}

  store:
    type: docstore
    path: ${ROUX_DATA_DIR:-./data}  # With default
```

## Syntax

- `${VAR}` — Required, error if not set
- `${VAR:-default}` — Optional with default value
- `${VAR:?error message}` — Required with custom error

## Implementation

- Parse config YAML
- Walk values, substitute `${...}` patterns
- Validate required vars before starting

## Security

- Never log resolved values (may contain secrets)
- Warn if secrets appear in non-secret fields

## Complexity

Low — string substitution, standard pattern.

## References

- [[Config]] — Configuration schema
- [[CLI]] — Environment handling
