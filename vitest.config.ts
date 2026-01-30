import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // cli excluded until Phase 10 implementation
      // Pure type definition files (interfaces only, no runtime code)
      exclude: [
        'src/**/*.d.ts',
        'src/cli/**/*.ts',
        'src/types/edge.ts',
        'src/types/graphcore.ts',
        'src/providers/docstore/types.ts',
        'src/mcp/handlers/types.ts',
      ],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
});
