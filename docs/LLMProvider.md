# LLMProvider

Text generation for assisted features.

## Overview

LLMProvider handles text generation—summarization, entity extraction, link suggestions, and other AI-assisted capabilities. It's optional for core graph operations but enables powerful authoring features.

## Interface

```typescript
interface LLMProvider {
  generate(prompt: string, options?: GenerateOptions): Promise<string>;
  chat(messages: Message[], options?: ChatOptions): Promise<string>;
}

interface GenerateOptions {
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

## Implementations

- [[Ollama]] — Local models (llama, mistral, etc.)
- [[OpenAI]] — GPT-4, GPT-3.5
- Claude API — Anthropic's models
- Custom — Any OpenAI-compatible endpoint

## Use Cases

**Summarization**
- Condense long nodes
- Generate abstracts for search results

**Entity Extraction**
- Identify people, places, concepts in text
- Feed into [[IngestionProvider]] for graph construction

**Link Suggestions**
- "This note mentions X, link to [[X]]?"
- Feed into [[AuthoringProvider]]

**Auto-tagging**
- Classify nodes automatically
- Suggest missing tags

## MVP Scope

LLMProvider is optional in Phase 0. Core functionality (search, traverse, CRUD) works without it. Phase 0.5 adds LLM-assisted features.

## Related

- [[GraphCore]] — Optionally uses LLM for assisted features
- [[Ollama]] — Primary local implementation
- [[OpenAI]] — Cloud implementation
- [[AuthoringProvider]] — Uses LLM for link suggestions
- [[IngestionProvider]] — Uses LLM for entity extraction
