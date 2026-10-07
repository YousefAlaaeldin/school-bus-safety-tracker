import { withSentryConfig } from '@sentry/nextjs/config';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  transpilePackages: ['@sst/shared', '@sst/i18n'],
};

export default withSentryConfig(withNextIntl(nextConfig), {
  silent: true,
  telemetry: false,
  // Source map upload needs an auth token; it is set up with the production deploy (T6.01).
  sourcemaps: { disable: true },
});
