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
      // edge.ts and graphcore.ts are pure type definitions with no runtime code
      exclude: ['src/**/*.d.ts', 'src/cli/**/*.ts', 'src/types/edge.ts', 'src/types/graphcore.ts'],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
});
