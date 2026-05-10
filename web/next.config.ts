import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  transpilePackages: ['@lichess-org/chessground'],
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@/shared': path.resolve(__dirname, '../shared'),
      '@/lib':    path.resolve(__dirname, './src/lib'),
    };
    return config;
  },
};

export default nextConfig;
