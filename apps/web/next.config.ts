import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@sst/shared', '@sst/i18n'],
};

export default nextConfig;
