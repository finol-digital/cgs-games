import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['tesseract.js', 'sharp'],
  images: {
    localPatterns: [
      { pathname: '/**', search: '' },
      // Firebase image URLs include query parameters such as alt=media.
      { pathname: '/api/proxy/**' },
    ],
  },
};

export default nextConfig;
