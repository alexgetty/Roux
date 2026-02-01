---
title: Non Markdown Formats
tags:
  - roadmap
type: Feature
status: Proposed
priority: P3
effort: M
phase: Future
category: Storage & Providers
---
# Feature - Non-Markdown Formats

Support txt, html, and rtf file formats.

## Summary

Extend DocStore to parse and index non-markdown text formats.

## Current State

MVP: Markdown only (.md files).

## Proposed Formats

| Format | Parser | Frontmatter | Links |
|--------|--------|-------------|-------|
| `.txt` | Plain text | None | URL extraction |
| `.html` | HTML parser | `<meta>` tags | `<a href>` |
| `.rtf` | RTF parser | None | URL extraction |

## Challenges

### Title Extraction
- Markdown: First `# heading` or filename
- HTML: `<title>` or `<h1>`
- TXT/RTF: First line or filename

### Link Detection
- Markdown: `[[wikilinks]]` and `[text](url)`
- HTML: `<a href="...">`
- TXT/RTF: URL regex only

### Tag Extraction
- Markdown: Frontmatter YAML
- HTML: `<meta name="keywords">`
- TXT/RTF: None (or inline `#tag` if implemented)

## Implementation

- Parser factory based on file extension
- Unified Node output regardless of source format
- ID includes extension to disambiguate `note.md` vs `note.txt`

## Complexity

Medium — multiple parsers, edge cases per format.

## References

- [[DocStore]] — Current markdown-only implementation
- [[decisions/MVP Scope Clarifications]] — Markdown only for MVP
