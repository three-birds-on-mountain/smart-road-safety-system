import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    globals: true,
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        '**/src/components/Map/**',
        '**/src/mocks/**',
        '**/src/pages/MapPage.tsx',
        '**/src/services/geolocation.ts',
        '**/src/lib/**',
        '**/tests/**',
      ],
      thresholds: {
        lines: 0,
        functions: 0,
        statements: 0,
        branches: 0,
      },
    },
  },
});
