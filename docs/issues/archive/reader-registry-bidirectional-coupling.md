---
title: reader-registry-bidirectional-coupling
tags:
  - resolved
  - architecture
  - docstore
---
# Reader Registry Bidirectional Coupling

**Severity:** High  
**Location:** `src/providers/docstore/reader-registry.ts`, `src/providers/docstore/readers/markdown.ts`

**Status:** Resolved

## Problem

`reader-registry.ts` imports `MarkdownReader` to provide `createDefaultRegistry()`, while `readers/markdown.ts` imports `FileContext` from `reader-registry.ts`. This creates logical coupling where:
- The registry knows about a specific reader implementation
- The reader depends on types from the registry

When adding `PDFReader` or `JsonReader`, the registry file keeps growing with imports. The registry should depend only on abstractions, not concrete implementations.

## Fix

Extract `FileContext` and `FormatReader` interface to a separate `types.ts`:

```typescript
// docstore/types.ts - just interfaces
export interface FileContext { ... }
export interface FormatReader { ... }

// docstore/reader-registry.ts - only depends on types
import type { FormatReader, FileContext } from './types.js';

// docstore/readers/markdown.ts - depends on types only
import type { FormatReader, FileContext } from '../types.js';

// docstore/index.ts - consumer does registration
const registry = new ReaderRegistry();
registry.register(new MarkdownReader());
```

## Verification

- `reader-registry.ts` should have zero imports from `readers/`
- Each reader should import only from `types.ts`
- `createDefaultRegistry()` moves to `index.ts` or becomes a standalone factory

## Resolution

All criteria verified:
- Created `src/providers/docstore/types.ts` with `FileContext` and `FormatReader` interfaces
- `reader-registry.ts` imports only from `types.ts`, no concrete reader imports
- `readers/markdown.ts` imports from `types.ts`, not `reader-registry.ts`
- `createDefaultRegistry()` moved to `index.ts` (composition root)
- No re-exports of types from `reader-registry.ts` — single canonical source
