// Next.js 16 renamed `middleware.ts` to `proxy.ts`; this is the next-intl locale middleware.
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\..*).*)',
};
