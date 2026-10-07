import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist', '**/.next', '**/.expo', 'supabase/functions/**'] },
  ...tseslint.configs.recommended,
);
