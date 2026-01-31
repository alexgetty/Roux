---
title: Hook Testing Guide
tags:
  - testing
  - hooks
  - documentation
---
# Hook Testing Guide

Systematic testing procedures for Claude Code hooks in this repository.

## Prerequisites

1. **Build Roux** — Hooks depend on `dist/` being current
   ```bash
   npm run build
   ```

2. **Ensure MCP cache exists** — Vector search requires embeddings
   ```bash
   # If .roux/ doesn't exist or is stale, start the MCP server briefly
   npx roux serve . &
   sleep 10
   kill %1
   ```

3. **Restart Claude Code** — Hooks load at session start only

## Hook Inventory

| Hook | Trigger | Purpose |
|------|---------|---------|
| `issue-dedup.py` | PreToolUse → Write | Block duplicate issue creation |
| `roadmap-validate.py` | PreToolUse → Write | Enforce roadmap frontmatter schema |
| `task-progress.py` | PostToolUse → Write\|Edit | Alert when edited files relate to active tasks |
| `task-context.py` | UserPromptSubmit | Inject task context when prompt references tasks |

## Test 1: Issue Deduplication

**What it does:** Blocks creation of issues that are semantically similar to existing ones.

### Manual CLI Test

```bash
# Should find matches and output denial JSON
CLAUDE_PROJECT_DIR=$(pwd) python3 .claude/hooks/issue-dedup.py << 'EOF'
{"tool_name":"Write","tool_input":{"file_path":"docs/issues/e2e-testing-problems.md","content":"# E2E Testing Problems\n\nWe have issues with E2E tests."}}
EOF
```

**Expected output:** JSON with `permissionDecision: "deny"` listing similar issues.

### In-Session Test

1. Restart Claude Code session
2. Ask Claude: "Create a new issue about E2E testing gaps"
3. **Expected:** Hook blocks the write, shows similar existing issues
4. Ask Claude: "Create an issue about quantum computing integration"
5. **Expected:** Hook allows (no similar issues exist)

### Edge Cases

| Input | Expected |
|-------|----------|
| Write to `docs/issues/archive/` | Allow (archive is excluded) |
| Write to `docs/notes/` | Allow (not in issues/) |
| Update existing issue | Allow (file exists check) |
| Empty content | Allow (no title to match) |

## Test 2: Roadmap Schema Validation

**What it does:** Ensures roadmap items have valid frontmatter.

### Manual CLI Test

```bash
# Missing frontmatter - should deny
CLAUDE_PROJECT_DIR=$(pwd) python3 .claude/hooks/roadmap-validate.py << 'EOF'
{"tool_name":"Write","tool_input":{"file_path":"docs/roadmap/new-feature.md","content":"# New Feature\n\nSome description."}}
EOF

# Invalid status - should deny
CLAUDE_PROJECT_DIR=$(pwd) python3 .claude/hooks/roadmap-validate.py << 'EOF'
{"tool_name":"Write","tool_input":{"file_path":"docs/roadmap/new-feature.md","content":"---\nstatus: maybe\n---\n# New Feature"}}
EOF

# Valid frontmatter - should allow (no output)
CLAUDE_PROJECT_DIR=$(pwd) python3 .claude/hooks/roadmap-validate.py << 'EOF'
{"tool_name":"Write","tool_input":{"file_path":"docs/roadmap/new-feature.md","content":"---\nstatus: planned\npriority: p2\n---\n# New Feature"}}
EOF
```

### In-Session Test

1. Ask Claude: "Create a roadmap item for API versioning support"
2. **If Claude omits frontmatter:** Hook blocks, shows schema requirements
3. **If Claude includes valid frontmatter:** Hook allows

### Valid Values

| Field | Valid Values |
|-------|--------------|
| `status` | planned, active, done, blocked, deferred |
| `priority` | p0, p1, p2, p3 |
| `category` | feature, bug, chore, research, infrastructure |

## Test 3: Task Progress Tracking

**What it does:** Alerts when you edit source files referenced by active tasks.

### Setup

First, create an active task that references a source file:

```bash
# Create a test issue that references a file
cat > docs/issues/test-active-task.md << 'EOF'
---
status: active
---
# Test Active Task

Working on improvements to `src/core/graphcore.ts`.
EOF
```

### Manual CLI Test

```bash
# Should output system message about active task
CLAUDE_PROJECT_DIR=$(pwd) python3 .claude/hooks/task-progress.py << 'EOF'
{"tool_name":"Edit","tool_input":{"file_path":"src/core/graphcore.ts","old_string":"x","new_string":"y"},"tool_response":{"success":true}}
EOF
```

### In-Session Test

1. Create an issue with `status: active` that mentions a source file
2. Edit that source file
3. **Expected:** System message appears noting the active task

### Edge Cases

| Input | Expected |
|-------|----------|
| Edit test file (`*.test.ts`) | No alert (tests excluded) |
| Edit markdown file | No alert (not source) |
| Task with `status: done` | No alert (not active) |
| Failed edit (`success: false`) | No alert |

## Test 4: Task Context Injection

**What it does:** Auto-injects task details when your prompt references a task.

### Manual CLI Test

```bash
# Should output context block
CLAUDE_PROJECT_DIR=$(pwd) python3 .claude/hooks/task-context.py << 'EOF'
{"prompt":"Let's work on the E2E Testing issue"}
EOF

# Should output context block
CLAUDE_PROJECT_DIR=$(pwd) python3 .claude/hooks/task-context.py << 'EOF'
{"prompt":"Fix the parser edge cases"}
EOF

# No task reference - should output nothing
CLAUDE_PROJECT_DIR=$(pwd) python3 .claude/hooks/task-context.py << 'EOF'
{"prompt":"What is 2+2?"}
EOF
```

### In-Session Test

1. Type: "Let's work on the E2E testing issue"
2. **Expected:** Context block appears with task details before Claude responds
3. Type: "What's the weather like?"
4. **Expected:** No context injection (no task reference)

### Trigger Patterns

These patterns activate context injection:
- `work on [task name]`
- `fix [task name]`
- `implement [task name]`
- `complete [task name]`
- `task: [name]`
- `issue: [name]`
- Direct paths like `docs/issues/foo.md`

## Debugging Hooks

### Check hook is being called

Add debug output to stderr (doesn't affect hook behavior):

```python
print(f"DEBUG: got input", file=sys.stderr)
```

### Test helper scripts directly

```bash
# Search helper
node .claude/hooks/roux-search.mjs "search query" 0.7

# Backlinks helper
node .claude/hooks/roux-backlinks.mjs "src/core/graphcore.ts"

# Context helper
node .claude/hooks/roux-context.mjs "E2E Testing"
```

### Common issues

| Symptom | Likely Cause |
|---------|--------------|
| Hook not firing | Session not restarted after settings change |
| Empty search results | `.roux/` cache missing or stale |
| "Module not found" | `npm run build` needed |
| Timeout errors | Increase timeout in settings.json |

## Files

```
.claude/
├── settings.json              # Hook configuration
├── settings.local.json        # Permissions (not hooks)
└── hooks/
    ├── issue-dedup.py         # Issue deduplication
    ├── roadmap-validate.py    # Roadmap schema validation
    ├── task-progress.py       # Active task alerts
    ├── task-context.py        # Context injection
    ├── roux-search.mjs        # Helper: semantic search
    ├── roux-backlinks.mjs     # Helper: find referencing tasks
    └── roux-context.mjs       # Helper: fetch task + neighbors
```
