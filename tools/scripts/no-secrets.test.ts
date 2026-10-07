import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKIP = new Set(['node_modules', '.next', '.expo', 'dist', 'build', '.turbo', 'coverage', 'ios', 'android']);
const TEXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|env|example|md|yml|yaml|toml)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (TEXT.test(name) || name.startsWith('.env')) out.push(full);
  }
  return out;
}

describe('secrets', () => {
  it('the service-role key never appears under apps/', () => {
    const hits = walk(join(root, 'apps')).filter((file) => /service_role|SERVICE_ROLE/.test(readFileSync(file, 'utf8')));
    expect(hits).toEqual([]);
  });
});
