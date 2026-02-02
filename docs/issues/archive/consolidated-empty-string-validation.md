---
id: 1RCPP9vAd54q
title: consolidated-empty-string-validation
tags:
  - consolidated
  - test-audit
  - validation
  - security
status: open
priority: high
---
# Consolidated: Empty String and Special Character Validation

## Problem Pattern
Functions accept empty strings, whitespace-only strings, and special characters without validation or documented behavior. These edge cases can cause unexpected behavior, security issues, or silent failures.

## Affected Locations

| File | Finding | Severity |
|------|---------|----------|
| tests/unit/graph/builder.test.ts | Empty string node ID accepted | MEDIUM |
| tests/unit/graph/builder.test.ts | Whitespace-only node ID accepted | MEDIUM |
| tests/unit/docstore/links.test.ts | `hasFileExtension('')` behavior untested | MEDIUM |
| tests/unit/docstore/links.test.ts | Leading/trailing whitespace in wiki-links | HIGH |
| tests/unit/docstore/cache/resolve.test.ts | Empty string query name untested | MEDIUM |
| tests/unit/mcp/truncate.test.ts | Null/undefined input behavior undocumented | MEDIUM |
| tests/unit/mcp/handlers.test.ts | Empty string content in createNode | MEDIUM |
| tests/unit/mcp/handlers.test.ts | Empty string title in updateNode | MEDIUM |
| tests/unit/file-operations.test.ts | Empty string and `.` paths at root | CRITICAL |
| tests/unit/vector/sqlite.test.ts | Special characters in ID (quotes, unicode, SQL injection) | MEDIUM |
| tests/unit/docstore/cache/centrality.test.ts | SQL injection via node ID | MEDIUM |
| tests/unit/cli/viz.test.ts | XSS via node titles in HTML output | MEDIUM |

## Root Cause Analysis
Validation gaps occur because:
1. **Happy path focus**: Tests use well-formed identifiers like `'test.md'` or `'a.md'`
2. **Implicit contracts**: Functions assume callers provide "reasonable" input
3. **Security assumptions**: SQL parameterization is trusted but not verified

These gaps allow:
- Empty strings creating phantom nodes
- Whitespace-sensitive matching failures
- Potential injection attacks through untrusted input

## Fix Strategy

1. **Document and test empty string behavior**:
   ```typescript
   describe('empty string handling', () => {
     it('returns false for empty path', () => {
       expect(hasFileExtension('')).toBe(false);
     });
     
     it('throws on empty node ID', () => {
       expect(() => buildGraph([{ id: '', ...rest }])).toThrow(/empty.*id/i);
     });
     // OR document that empty is allowed:
     it('accepts empty node ID (creates node with key "")', () => {
       const graph = buildGraph([{ id: '', ...rest }]);
       expect(graph.hasNode('')).toBe(true);
     });
   });
   ```

2. **Add whitespace tests**:
   ```typescript
   it('trims whitespace from wiki-links', () => {
     expect(normalizeWikiLink('  note  ')).toBe('note.md'); // if trimming
   });
   // OR
   it('preserves whitespace in wiki-links (intentional)', () => {
     expect(normalizeWikiLink('  note  ')).toBe('  note  .md');
   });
   ```

3. **Add SQL injection defensive tests**:
   ```typescript
   it('handles SQL injection attempts safely', () => {
     const maliciousId = "'; DROP TABLE nodes; --";
     // Should not throw or corrupt data
     expect(() => storeCentrality(db, maliciousId, 0.5, 1, 1, Date.now()))
       .not.toThrow();
     // Table should still exist
     expect(db.prepare('SELECT 1 FROM nodes LIMIT 1').get()).toBeDefined();
   });
   ```

4. **Add XSS verification for HTML output**:
   ```typescript
   it('escapes HTML entities in node titles', async () => {
     await writeFile(join(testDir, 'xss.md'), '---\ntitle: <script>alert(1)</script>\n---\n');
     const result = await vizCommand(testDir);
     const html = await readFile(result.outputPath, 'utf-8');
     expect(html).not.toContain('<script>alert');
     expect(html).toContain('&lt;script&gt;'); // Escaped
   });
   ```

5. **Validate path traversal edge cases**:
   ```typescript
   it('throws on empty string path', () => {
     expect(() => validatePathWithinSource(tempDir, '')).toThrow(/outside.*source/i);
   });
   
   it('throws on dot path', () => {
     expect(() => validatePathWithinSource(tempDir, '.')).toThrow(/outside.*source/i);
   });
   
   it('throws on absolute path injection', () => {
     expect(() => validatePathWithinSource(tempDir, '/etc/passwd')).toThrow();
   });
   ```

## Verification
1. For each gap, determine intended behavior (throw vs accept vs transform)
2. Add test that documents the decided behavior
3. If behavior should change, add failing test first (TDD)
4. For security tests, verify parameterized queries are used

## Source Audits
- [[audit-graph-builder-test]]
- [[audit-docstore-links-test]]
- [[audit-cache-resolve-test]]
- [[audit-mcp-truncate-test]]
- [[audit-mcp-handlers-test]]
- [[audit-file-operations-test]]
- [[audit-vector-sqlite-test]]
- [[audit-cache-centrality-test]]
- [[audit-cli-viz-test]]
