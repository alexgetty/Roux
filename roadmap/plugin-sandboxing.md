---
title: Plugin Sandboxing
tags:
  - roadmap
  - plugin-system
  - security
  - deferred
---
# Plugin Sandboxing

Capability-based permissions for untrusted plugins.

## Context

[[Plugin System]] MVP runs plugins in the same process with full Node.js access. This is fine when Alex is the only author, but becomes a security risk with third-party plugins.

## Problem

A malicious or buggy plugin can:
- Read/write arbitrary files (`require('fs')`)
- Make network requests
- Access environment variables (secrets)
- Corrupt the graph
- Crash the process

## Proposal

### Capability Model

Plugins declare required capabilities:

```typescript
interface RouxPlugin {
  // ...
  capabilities: {
    filesystem?: 'none' | 'plugin-dir' | 'project-dir';
    network?: 'none' | 'allowlist';
    networkAllowlist?: string[];  // if network: 'allowlist'
  };
}
```

### Enforcement Options

**Option A: Process Isolation**
- Run each plugin in separate worker/subprocess
- Communicate via message passing
- OS-level sandboxing (seccomp, etc.)
- High overhead, complex IPC

**Option B: VM Isolation**
- Run plugins in `vm2` or similar
- Limit available globals
- Moderate overhead, some escape risks

**Option C: Trust Tiers**
- "Core" plugins (built-in): full access
- "Verified" plugins (reviewed): full access with audit
- "Community" plugins: warning only, user accepts risk

### Scoped Store Access

Even without full sandboxing, limit store operations:

```typescript
// Plugin only sees/modifies its own namespace
const scopedCore = core.scopedTo(this.id);
scopedCore.createNode(...);  // auto-sets createdBy, validates namespace
```

## Why Deferred

- Alex is only plugin author for now
- Sandboxing is complex to implement correctly
- Performance overhead for isolated execution
- Trust model needs community first

## References

- Red-team audit (2026-01-25)
- [[Plugin System]]
