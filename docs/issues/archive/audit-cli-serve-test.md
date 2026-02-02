---
id: 1KgVwqKAoAg1
title: audit-cli-serve-test
tags:
  - test-audit
  - cli
status: open
---
# Test Audit: cli/serve.test.ts

> **Consolidated into:** [[consolidated-error-propagation-gaps]]

## Summary

The serve command tests have significant gaps around error handling, config parsing, embedding failures, and cleanup edge cases.

## Findings

### [CRITICAL] Embedding failure during startup not tested

**Problem:** The embedding loop has no error handling. If `embedding.embed()` fails, the entire serve command crashes.

---

### [HIGH] Malformed config file not tested

**Problem:** No test for empty config, invalid YAML syntax, or invalid schema.

---

### [HIGH] Cleanup on partial initialization failure not tested

**Problem:** If initialization fails after creating `store` but before returning, resources may leak.

---

### [MEDIUM] Watch callback embedding failure not tested

**Problem:** The file watcher callback generates embeddings but has no error handling.

---

### [MEDIUM] Empty directory startup not tested

**Problem:** No test verifies serve works with zero nodes.

---

### [MEDIUM] Config with custom embedding model not tested

**Problem:** Tests use default config but custom model code path is never exercised.

## Previously Documented

See `docs/issues/cli-command-test-gaps.md` for related gaps.
