import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}', 'tests/**/*.spec.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'playwright.config.*', 'node_modules/**', 'tests/setup/**'],
    setupFiles: ['tests/setup/vitest.setup.ts'],
    environment: 'node',
    clearMocks: true,
  },
});
