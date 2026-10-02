import { stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

// Keep explicit routes ahead of the public /[username] and /[username]/[slug] routes.
// The route inventory test checks this list against app/ and public/.
export const staticPaths = new Set([
  '/',
  '/browse',
  '/upload',
  '/terms',
  '/privacy',
  '/robots.txt',
  '/sitemap.xml',
  '/openapi.json',
  '/llms.txt',
  '/favicon.ico',
  '/opengraph-image.png',
  '/manifest.json',
  '/CardBack.png',
  '/Card-Game-Simulator.png',
  '/cgs.png',
  '/google.png',
  '/icon-192x192.png',
  '/icon-256x256.png',
  '/icon-384x384.png',
  '/icon-512x512.png',
]);

/** Include generated public assets without confusing arbitrary file-like URLs with real files. */
export async function isPublicFile(pathname: string): Promise<boolean> {
  const root = resolve(process.cwd(), 'public');
  const target = resolve(root, '.' + pathname);
  if (!target.startsWith(root + sep)) return false;
  try {
    return (await stat(target)).isFile();
  } catch {
    return false;
  }
}

/** Lists supported methods for a known API URL, or null for an unknown endpoint. */
export function apiMethods(path: string): string[] | null {
  if (path === '/api/games') return ['GET', 'HEAD', 'POST', 'OPTIONS'];
  if (path === '/api/browse' || path === '/api/gatcg_spoilers') return ['GET', 'HEAD', 'OPTIONS'];
  if (path === '/api/games/upload') return ['POST', 'OPTIONS'];
  if (/^\/api\/games\/[^/]+$/.test(path)) return ['DELETE', 'OPTIONS'];
  if (/^\/api\/proxy\/.+/.test(path)) return ['GET', 'HEAD', 'POST', 'OPTIONS'];
  return null;
}
