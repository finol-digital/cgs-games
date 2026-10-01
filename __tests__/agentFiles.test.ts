/** @jest-environment node */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { staticPaths, apiMethods, isPublicFile } from '@/lib/siteRoutes';
import spec from '@/public/openapi.json';

describe('published agent files', () => {
  it('validates the OpenAPI document against the published specification', () => {
    // Run the validator's ESM dependencies in Node, outside Jest's CommonJS sandbox.
    expect(() =>
      execFileSync(
        process.execPath,
        [
          '-e',
          "require('@apidevtools/swagger-parser').validate('public/openapi.json').catch(e => { console.error(e); process.exit(1); })",
        ],
        { stdio: 'pipe' },
      ),
    ).not.toThrow();
  });

  it('documents every public API route and its supported operations', () => {
    const files = readdirSync('app/api', { recursive: true }) as string[];
    for (const file of files.filter((file) => file.endsWith('route.ts'))) {
      const route =
        '/api/' +
        file
          .replaceAll('\\', '/')
          .replace(/\/route\.ts$/, '')
          .replace(/\[\.\.\.(\w+)\]/g, '{$1}')
          .replace(/\[(\w+)\]/g, '{$1}');
      expect(spec.paths).toHaveProperty(route);
      const methods = apiMethods(
        route.replaceAll('{id}', 'test-id').replaceAll('{url}', 'example.com/test'),
      );
      for (const method of methods!) {
        expect(spec.paths[route as keyof typeof spec.paths]).toHaveProperty(method.toLowerCase());
      }
    }
  });

  it('keeps static route recognition in sync with public files and app pages', async () => {
    for (const file of readdirSync('public', { recursive: true }) as string[]) {
      if (!path.extname(file)) continue;
      expect(await isPublicFile('/' + file.replaceAll('\\', '/'))).toBe(true);
    }
    for (const file of readdirSync('app', { recursive: true }) as string[]) {
      const normalized = file.replaceAll('\\', '/');
      if (
        !normalized.endsWith('page.tsx') ||
        normalized.includes('[') ||
        normalized === '404/page.tsx'
      )
        continue;
      const route = '/' + normalized.replace(/(?:\/)?page\.tsx$/, '');
      expect(staticPaths.has(route)).toBe(true);
    }
  });

  it('does not accept missing assets, directories or paths outside public', async () => {
    expect(await isPublicFile('/missing-asset.png')).toBe(false);
    expect(await isPublicFile('/')).toBe(false);
    expect(await isPublicFile('/../package.json')).toBe(false);
    for (const file of ['favicon.ico', 'opengraph-image.png', 'manifest.json']) {
      expect(staticPaths.has('/' + file)).toBe(true);
    }
  });

  it('publishes an llms.txt overview with valid discovery links', () => {
    const guide = readFileSync('public/llms.txt', 'utf8');
    expect(guide).toMatch(/^# CGS Games\r?\n\r?\n> /);
    for (const file of ['openapi.json', 'sitemap.xml'])
      expect(guide).toContain('https://cgs.games/' + file);
    expect(guide).toContain('## API');
    expect(guide).toContain('## Website');
  });
});
