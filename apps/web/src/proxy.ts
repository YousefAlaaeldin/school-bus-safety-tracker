// Next.js 16 renamed `middleware.ts` to `proxy.ts`.
// Runs next-intl first, then refreshes the Supabase session on the same response.
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@sst/shared';
import createIntlMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const handleI18n = createIntlMiddleware(routing);

export default async function proxy(request: NextRequest) {
  const response = handleI18n(request);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );
  // Refreshes the session cookie when needed. Do not run code between createServerClient and this call.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\..*).*)',
};
