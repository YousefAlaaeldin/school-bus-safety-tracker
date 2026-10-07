import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'packages/**/src/**/*.test.ts',
      'supabase/functions/_shared/**/*.test.ts',
      'tools/scripts/**/*.test.ts',
    ],
  },
});
