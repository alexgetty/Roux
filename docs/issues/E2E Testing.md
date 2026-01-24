---
type: Issue
severity: Medium
component: Testing
phase: 11
---

# Issue - E2E Testing

End-to-end testing gap. No full user workflow coverage.

## Overview

Current test coverage:
- Unit tests: 100% coverage on all source files
- Integration tests: Component interactions within Node.js
- Contract tests: Interface compliance

Missing:
- Full E2E tests simulating real user workflows
- MCP server integration tests with actual Claude Code
- CLI command tests with real filesystem and subprocesses

## Plan

### Phase 1: Post-MVP

After MVP ships, implement E2E test suite covering:

1. **CLI workflows**
   - `roux init` creates config and cache directory
   - `roux serve` starts MCP server, responds to tool calls
   - `roux status` reports accurate statistics
   - `roux viz` generates valid HTML visualization

2. **MCP tool integration**
   - All 10 tools work end-to-end
   - Error responses are well-formed
   - Context window limits respected

3. **File watcher scenarios**
   - External file create/modify/delete detected
   - Cache updates within 1 second
   - Graph rebuilds correctly

4. **Real vault testing**
   - Test against sample Obsidian vault
   - Verify search quality
   - Verify link resolution

### Phase 2: TDD Integration

Once E2E infrastructure exists:
- Write E2E tests alongside unit tests for new features
- E2E tests define acceptance criteria
- CI runs E2E suite on PR merge

## Tools

Candidates:
- **Playwright** — Browser automation, good for viz testing
- **Vitest + child_process** — CLI testing without extra deps
- **MCP test harness** — Custom tool for MCP protocol testing

## Related

- [[MVP Implementation Plan]] — Current phase
- [[TDD]] — Test methodology
- [[CLI]] — Commands to test
- [[MCP Server]] — Protocol to test
