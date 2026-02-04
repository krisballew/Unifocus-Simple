import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/punch-validator.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/health.test.ts',
      'tests/idempotency.test.ts',
      'tests/security-*.test.ts',
      'tests/tenants.test.ts',
    ],
  },
});
