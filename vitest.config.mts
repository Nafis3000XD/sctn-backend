import { defineConfig } from 'vitest/config';

// Tests live in /tests (outside src/) so the production `tsc` build never
// compiles them into dist. They import from ../src directly.
export default defineConfig({
  test: {
    environment: 'node',
    env: { JWT_SECRET: 'dev_only_change_me' },
    include: ['tests/**/*.test.ts']
  }
});
