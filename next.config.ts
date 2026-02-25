import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['tesseract.js', 'sharp'],
};

export default nextConfig;
