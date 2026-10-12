import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import SwaggerParser from '@apidevtools/swagger-parser';
import { JSDOM } from 'jsdom';

const origin = process.argv[2] || 'http://localhost:3101';
let checks = 0;
/** Requests a public endpoint and asserts its status and optional media type. */
async function check(
  path,
  {
    accept = '*/*',
    method = 'GET',
    status = 200,
    type,
    body,
    headers = {},
    redirect = 'follow',
  } = {},
) {
  const response = await fetch(new URL(path, origin), {
    method,
    headers: {
      Accept: accept,
      ...(path.startsWith('/api') ? { Origin: 'https://cgs.gg' } : {}),
      ...headers,
    },
    body,
    signal: AbortSignal.timeout(60000),
    redirect,
  });
  const text = await response.text();
  assert.equal(response.status, status, `${method} ${path}: ${text.slice(0, 120)}`);
  if (type)
    assert.ok(response.headers.get('content-type')?.startsWith(type), `${path}: Content-Type`);
  if (path.startsWith('/api')) {
    assert.ok(
      ['*', headers.Origin || 'https://cgs.gg'].includes(
        response.headers.get('access-control-allow-origin'),
      ),
      `${path}: actual response CORS`,
    );
  }
  checks++;
  console.log(`PASS ${method} ${path} [${accept}] -> ${response.status}`);
  return { response, text };
}

const markdown = await check('/', { accept: 'text/markdown', type: 'text/markdown' });
assert.match(markdown.response.headers.get('vary'), /(?:^|,\s*)accept(?:,|$)/i);
assert.ok(markdown.text.length > 500);
assert.match(markdown.text, /^# CGS Games/m);
const html = await check('/', { accept: 'text/html', type: 'text/html' });
const document = new JSDOM(html.text).window.document;
assert.equal(document.documentElement.lang, 'en');
assert.equal(document.querySelector('link[rel="canonical"]')?.href, 'https://cgs.games/');
assert.ok(document.querySelector('meta[property="og:image"]')?.content);
assert.equal(document.querySelector('meta[property="og:type"]')?.content, 'website');
const identity = JSON.parse(
  document.querySelector('script[type="application/ld+json"]').textContent,
);
assert.equal(identity['@context'], 'https://schema.org');
const organization = identity['@graph'].find((entry) => entry['@type'] === 'Organization');
assert.ok(organization.contactPoint.email);
assert.equal(organization.address['@type'], 'PostalAddress');
assert.ok(organization.address.streetAddress);
document
  .querySelectorAll('script, style, template, noscript')
  .forEach((element) => element.remove());
assert.equal(document.querySelectorAll('h1').length, 1);
const contentLength = document.querySelector('main').textContent.trim().length;
assert.match(
  document.querySelector('main').textContent,
  /Welcome to the Card Game Simulator \(CGS\) Games website!/,
);
for (const href of ['/browse', '/upload', '/developers', '/llms.txt']) {
  assert.ok(document.querySelector(`main a[href="${href}"]`), `Homepage link: ${href}`);
}
assert.ok(contentLength >= 500, `Homepage has only ${contentLength} meaningful characters`);
let previousHeading = 0;
for (const heading of document.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
  const level = Number(heading.tagName.slice(1));
  assert.ok(level <= previousHeading + 1, `Heading skips from ${previousHeading} to ${level}`);
  previousHeading = level;
}
await check('/', { accept: 'text/markdown;q=0.9,text/html;q=0.2', type: 'text/markdown' });
await check('/', { accept: 'text/markdown;q=0,text/html;q=1', type: 'text/html' });
await check('/', { accept: 'application/json', status: 406 });
const head = await check('/', { accept: 'text/markdown', method: 'HEAD', type: 'text/markdown' });
assert.equal(head.text, '');

for (const path of [
  '/agent-readiness-nonexistent-4a7f2',
  '/agent-readiness-nonexistent-4a7f2/game',
  '/agent-readiness/nonexistent/deep/path',
  '/missing-agent-asset-4a7f2.png',
  '/%E0%A4%A',
]) {
  const missing = await check(path, {
    accept: 'text/markdown',
    status: 404,
    type: 'text/markdown',
    redirect: 'manual',
  });
  assert.ok(missing.text.length >= 20);
  assert.match(missing.text, /llms\.txt|sitemap\.xml/);
  assert.match(missing.response.headers.get('vary'), /accept/i);
  await check(path, { accept: 'text/html', status: 404, type: 'text/html', redirect: 'manual' });
}

const specification = await check('/openapi.json', { type: 'application/json' });
await SwaggerParser.validate(JSON.parse(specification.text));
const guide = await check('/llms.txt', { type: 'text/plain' });
assert.match(guide.text, /^# CGS Games\r?\n\r?\n> /);
assert.match(guide.text, /## When to use CGS Games/);
for (const path of ['/about', '/contact', '/privacy', '/developers']) {
  const page = await check(path, { type: 'text/html', redirect: 'manual' });
  const pageDocument = new JSDOM(page.text).window.document;
  pageDocument
    .querySelectorAll('script,style,template,noscript')
    .forEach((element) => element.remove());
  assert.ok(
    pageDocument.querySelector('main').textContent.trim().length >= 500,
    `${path}: meaningful content`,
  );
  if (path !== '/privacy') {
    assert.equal(
      pageDocument.querySelector('link[rel="canonical"]').href,
      'https://cgs.games' + path,
    );
  }
}
const cliPackage = await fetch(new URL('/downloads/cgs-games-cli-1.0.0.tgz', origin));
assert.equal(cliPackage.status, 200);
const cliBytes = Buffer.from(await cliPackage.arrayBuffer());
assert.deepEqual(
  cliBytes,
  await readFile(new URL('../public/downloads/cgs-games-cli-1.0.0.tgz', import.meta.url)),
);
console.log('PASS versioned CLI package download matches the tested local artifact');
const sitemap = await check('/sitemap.xml', { type: 'application/xml' });
const sitemapDocument = new JSDOM(sitemap.text, { contentType: 'application/xml' }).window.document;
assert.equal(
  sitemapDocument.documentElement.namespaceURI,
  'http://www.sitemaps.org/schemas/sitemap/0.9',
);
for (const location of sitemapDocument.querySelectorAll('loc')) {
  const path = new URL(location.textContent).pathname;
  if (path !== '/') await check(path, { type: 'text/html' });
}
const robots = await check('/robots.txt', { type: 'text/plain' });
assert.match(robots.text, /Sitemap: https:\/\/cgs\.games\/sitemap\.xml/);
const manifest = await check('/manifest.json', { type: 'application/' });
assert.equal(JSON.parse(manifest.text).name, 'CGS Games');
await check('/favicon.ico', { type: 'image/' });
await check('/opengraph-image.png', { type: 'image/' });
for (const icon of JSON.parse(manifest.text).icons) await check(icon.src, { type: 'image/' });

const catalog = await check('/api/games', { type: 'application/json' });
const games = JSON.parse(catalog.text);
assert.ok(Array.isArray(games));
assert.equal(catalog.response.headers.get('api-version'), '1');
const versioned = await check('/api/games', {
  headers: { 'API-Version': '1' },
  type: 'application/json',
});
assert.deepEqual(JSON.parse(versioned.text), games);
const unsupported = await check('/api/games', {
  headers: { 'API-Version': '2' },
  status: 400,
  type: 'application/json',
});
assert.equal(JSON.parse(unsupported.text).code, 'UNSUPPORTED_API_VERSION');
const sandbox = await check('/api/sandbox/games', { type: 'application/json' });
const fixtures = JSON.parse(sandbox.text);
assert.equal(fixtures.length, 1);
assert.equal(fixtures[0].id, 'sandbox-example');
for (const game of [...games, ...fixtures]) {
  for (const field of JSON.parse(specification.text).components.schemas.Game.required) {
    assert.equal(typeof game[field], 'string', `Game field ${field}`);
  }
}
const browse = await check('/api/browse', { type: 'application/json' });
assert.deepEqual(JSON.parse(browse.text), games);
if (games[0]) {
  await check('/' + encodeURIComponent(games[0].username), { type: 'text/html' });
  await check('/' + encodeURIComponent(games[0].username) + '/' + games[0].slug, {
    type: 'text/html',
  });
}
const spoilers = await check('/api/gatcg_spoilers', { type: 'application/json' });
assert.match(spoilers.response.headers.get('ratelimit'), /^"spoilers";r=\d+;t=\d+$/);
assert.equal(spoilers.response.headers.get('ratelimit-policy'), '"spoilers";q=10;w=60');
assert.equal(spoilers.response.headers.get('cache-control'), 'no-store');
assert.ok(spoilers.response.headers.get('access-control-expose-headers').includes('RateLimit'));
await check('/api/proxy/cgs.games/robots.txt', { type: 'text/plain' });
const cliAuth = await check('/cli/auth', { type: 'text/html' });
assert.match(cliAuth.text, /Authorize CGS Games CLI/);
assert.match(cliAuth.text, /noindex/);
assert.match(cliAuth.text, /<meta name="referrer" content="origin"/);

for (const [path, method, status] of [
  ['/api/no-such-endpoint', 'GET', 404],
  ['/api', 'GET', 404],
  ['/api/games', 'PUT', 405],
  ['/api/games/upload', 'GET', 405],
  ['/api/sandbox/games', 'POST', 405],
  ['/api/games', 'POST', 401],
  ['/api/games/upload', 'POST', 401],
  ['/api/cli/session', 'POST', 401],
  ['/api/cli/session', 'GET', 405],
  ['/api/games/agent-readiness-no-write', 'DELETE', 401],
  ['/api/gatcg_spoilers?warm=1', 'GET', 401],
  ['/api/proxy/nonexistent-agent-readiness.invalid/resource', 'GET', 502],
  ['/api/proxy/nonexistent-agent-readiness.invalid/resource', 'POST', 502],
]) {
  const result = await check(path, { method, status, type: 'application/json' });
  const error = JSON.parse(result.text);
  for (const key of ['error', 'code', 'message', 'hint'])
    assert.ok(typeof error[key] === 'string' && error[key].length > 0);
  if (status === 405) assert.ok(result.response.headers.get('allow'));
}
const spec = JSON.parse(await readFile(new URL('../public/openapi.json', import.meta.url), 'utf8'));
for (const [path, operations] of Object.entries(spec.paths)) {
  const concrete = path
    .replace('{id}', 'agent-readiness-no-write')
    .replace('{url}', 'example.com/resource');
  if ('head' in operations) {
    const headPath = path.includes('{url}') ? '/api/proxy/cgs.games/robots.txt' : concrete;
    const result = await check(headPath, { method: 'HEAD' });
    assert.equal(result.text, '');
  }
  for (const method of ['get', 'head', 'post', 'delete'].filter((method) => method in operations)) {
    const requestingOrigin = 'https://cgs.gg';
    const requestedHeaders = ['content-type', 'authorization', 'api-version'];
    const result = await check(concrete, {
      method: 'OPTIONS',
      status: 204,
      headers: {
        Origin: requestingOrigin,
        'Access-Control-Request-Method': method.toUpperCase(),
        'Access-Control-Request-Headers': requestedHeaders.join(', '),
      },
    });
    assert.ok(
      ['*', requestingOrigin].includes(result.response.headers.get('access-control-allow-origin')),
    );
    const allowedMethods = (result.response.headers.get('access-control-allow-methods') || '')
      .split(',')
      .map((value) => value.trim().toUpperCase());
    assert.ok(allowedMethods.includes(method.toUpperCase()));
    const allowedHeaders = (result.response.headers.get('access-control-allow-headers') || '')
      .split(',')
      .map((value) => value.trim().toLowerCase());
    for (const header of requestedHeaders) assert.ok(allowedHeaders.includes(header));
  }
}
console.log(
  `Verified ${checks} HTTP responses; homepage contains ${contentLength} visible text characters without JavaScript.`,
);

// Exercise the real limiter only on a local instance, never by flooding the public service.
if (['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname)) {
  let limited;
  for (let attempt = 0; attempt < 11; attempt++) {
    const response = await fetch(new URL('/api/gatcg_spoilers', origin));
    const body = await response.json();
    assert.ok([200, 429].includes(response.status));
    if (response.status === 429) {
      limited = response;
      assert.equal(body.code, 'RATE_LIMITED');
      break;
    }
  }
  assert.ok(limited, 'The local spoiler endpoint should enforce its quota');
  assert.match(limited.headers.get('ratelimit'), /^"spoilers";r=0;t=\d+$/);
  assert.ok(Number(limited.headers.get('retry-after')) >= 1);
  console.log('PASS local spoiler quota: HTTP 429 with RateLimit and Retry-After');
}
