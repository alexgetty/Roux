# Decision - Error Output

**Status:** Decided
**Affects:** [[CLI]], [[MCP Server]], [[DocStore]]

## Problem

[[Decision - Error Contract]] defines what IS an error vs what isn't. But it doesn't define:

- Where do errors go? (stderr, log file, MCP response)
- Where do warnings go? (broken links, parse failures)
- What format? (plain text, JSON, structured)
- What verbosity levels exist?
- How does the user see what went wrong?

## Scenarios

### CLI Operations

```bash
roux init ./docs
```

Where does output go?
- Progress: stdout
- Errors: stderr
- Warnings: ???
- Final summary: stdout

### MCP Operations

```json
// Tool call
{ "tool": "create_node", "arguments": { "title": "Test" } }

// Where do these go?
// - Success response
// - Validation error
// - Warning (broken link in content)
// - Internal error (file system failure)
```

### File Watcher Events

While `roux serve` is running:
- File parsed successfully → silent? log?
- File has broken links → warning where?
- File parse failed → error where?
- File too large → warning where?

## Options

### CLI Error Output

#### Option A: Unix conventions

```
stdout: Normal output, results, progress
stderr: Errors and warnings
exit codes: 0 success, 1 error, 2 warning
```

**Pros:** Standard. Works with pipes. Scripts can check exit codes.
**Cons:** Warnings on stderr might confuse users expecting only errors.

#### Option B: Structured JSON output

```bash
roux init ./docs --json
# {"status": "success", "nodes": 150, "warnings": ["Broken link: [[missing]]"]}
```

**Pros:** Machine readable. Explicit warning array.
**Cons:** Harder to read. Requires flag.

#### Option C: Verbosity levels

```bash
roux init ./docs           # Errors only
roux init ./docs -v        # Errors + warnings
roux init ./docs -vv       # Errors + warnings + info
roux init ./docs --quiet   # Silent except failures
```

**Pros:** User control. Good for scripts vs interactive.
**Cons:** More flags to document. Inconsistent behavior.

### MCP Error Output

#### Option A: MCP error responses only

```json
// Validation error
{ "error": { "code": -32602, "message": "Title is required" } }

// Success (warnings in result)
{ "result": { "node": {...}, "warnings": ["Broken link: [[foo]]"] } }
```

**Pros:** MCP standard. Warnings don't break success flow.
**Cons:** Client must handle warnings in result object.

#### Option B: MCP notifications for warnings

```json
// Warning sent as notification
{ "method": "roux/warning", "params": { "message": "Broken link: [[foo]]" } }

// Result is clean
{ "result": { "node": {...} } }
```

**Pros:** Warnings don't pollute results. Client can show/ignore.
**Cons:** Notifications may not be shown. Fire and forget.

#### Option C: Warnings in metadata

```json
{
  "result": { "node": {...} },
  "_meta": { "warnings": ["..."] }
}
```

**Pros:** Clean separation. Standard pattern.
**Cons:** Non-standard for MCP.

### Logging

#### Option A: No log file (MVP)

All output to stdio. User redirects if they want logs.

**Pros:** Simple. No file management.
**Cons:** Warnings lost. Can't debug after the fact.

#### Option B: Always log to file

```
.roux/roux.log
```

**Pros:** Debugging. Audit trail.
**Cons:** File grows forever. Disk usage. Rotation needed.

#### Option C: Log file only in verbose mode

```bash
roux serve --log .roux/roux.log
```

**Pros:** Opt-in complexity.
**Cons:** When things go wrong, log wasn't enabled.

## Warning Categories

What generates warnings (not errors)?

| Scenario | Current behavior | Proposed |
|----------|-----------------|----------|
| Broken wiki-link | Skip edge | Warn |
| Parse error in frontmatter | Skip file? | Warn, include anyway? |
| File too large | ??? | Warn, skip? |
| Duplicate node ID | ??? | Error |
| Embedding timeout | ??? | Warn, skip embedding? |
| Unknown frontmatter fields | Silent | Silent (bag of properties) |

## Questions to Resolve

1. ~~Should warnings be visible by default or require `-v`?~~ Visible by default (CLI stdout).
2. ~~Should MCP responses include warnings or use notifications?~~ Include in response object.
3. ~~Should we have a log file in MVP?~~ No. Deferred to standalone server phase.
4. ~~Should parse-failed files be skipped or error?~~ Warn and skip. Surface warning via MCP.

## Decision

### CLI Operations
- Errors: stderr, exit code 1
- Warnings: stdout, visible by default
- No log file for MVP

### MCP Operations
- Errors: MCP error response (standard protocol)
- Warnings: Include in result object (e.g., `{ "result": { "node": {...}, "_warnings": [...] } }`)

### File Watcher (stdio transport constraint)
With stdio transport, there's no terminal for the user to see — Claude Code spawns `roux serve` as a subprocess. stdout/stderr are the MCP protocol channel.

**Solution: Warnings buffer**
- File watcher populates a warnings array during sync
- Any MCP tool response drains accumulated warnings into `_warnings` field
- Warnings surface on next MCP interaction, regardless of which tool was called
- After surfacing, buffer clears

```json
// Example: user searches, but files had sync issues
{
  "result": {
    "nodes": [...],
    "_warnings": [
      "Sync: broken link [[missing]] in research.md",
      "Sync: parse error in malformed.md (skipped)"
    ]
  }
}
```

### Future (standalone server / SSE)
When SSE transport is added:
- Log file support (`.roux/roux.log`)
- Terminal output during serve
- More robust error handling and rotation
- Enterprise-grade audit logging

## Outcome

Decided. MVP uses simple approach: CLI shows errors/warnings in terminal, MCP bundles everything into responses, file watcher warnings buffer and surface on next interaction. Log files deferred to standalone server phase.

## Related

- [[Decisions]] — Decision hub
- [[Decision - Error Contract]] — What is an error
- [[CLI]] — Command output
- [[MCP Server]] — Tool responses
