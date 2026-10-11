import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['tesseract.js', 'sharp'],
  images: {
    // App Hosting disables optimization unless this is explicitly false.
    // https://firebase.google.com/docs/app-hosting/optimize-image-loading
    unoptimized: false,
    localPatterns: [
      { pathname: '/**', search: '' },
      // Firebase image URLs include query parameters such as alt=media.
      { pathname: '/api/proxy/**' },
    ],
  },
};

export default nextConfig;
