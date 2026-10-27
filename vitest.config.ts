import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      'server-only': path.resolve(
        __dirname,
        'node_modules/next/dist/compiled/server-only/empty.js',
      ),
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
