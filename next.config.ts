import type { NextConfig } from 'next';
import path from 'path';
import './lib/env-guard';

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    localPatterns: [
      { pathname: '/logo*.png', search: '' },
      { pathname: '/icon.png', search: '' },
    ],
  },
};

export default nextConfig;
