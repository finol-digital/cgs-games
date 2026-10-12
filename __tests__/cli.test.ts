/** @jest-environment node */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer, type Server } from 'node:http';
import { type AddressInfo } from 'node:net';

const execute = promisify(execFile);
const cli = 'packages/cli/bin/cgs-games.mjs';
let server: Server;
let base: string;
let status: number;
let requests: { path: string; version: string | string[] | undefined }[];

beforeAll(async () => {
  server = createServer((request, response) => {
    requests.push({ path: request.url!, version: request.headers['api-version'] });
    response.writeHead(status, { 'Content-Type': 'application/json', 'Retry-After': '15' });
    response.end(JSON.stringify({ path: request.url }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
});
beforeEach(() => {
  status = 200;
  requests = [];
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('official read-only CLI', () => {
  it('explains how to invoke packaging when npm has not supplied its executable', async () => {
    const env = { ...process.env };
    delete env.npm_execpath;
    await expect(
      execute(process.execPath, ['scripts/pack-cli.mjs'], { env }),
    ).rejects.toMatchObject({
      code: 1,
      stdout: '',
      stderr: 'Run this script with: npm run pack:cli\n',
    });
  });

  it.each([
    ['games', [], '/api/games'],
    ['games', ['--sandbox'], '/api/sandbox/games'],
    ['browse', [], '/api/games'],
    ['browse', ['--sandbox'], '/api/sandbox/games'],
    ['openapi', [], '/openapi.json'],
  ])('prints JSON for %s %s and selects version 1', async (command, options, path) => {
    const result = await execute(process.execPath, [cli, command, ...options, '--base-url', base]);
    expect(JSON.parse(result.stdout)).toEqual({ path });
    expect(result.stderr).toBe('');
    expect(requests).toEqual([{ path, version: '1' }]);
  });

  it('reports throttling without retrying or printing a success payload', async () => {
    status = 429;
    await expect(
      execute(process.execPath, [cli, 'games', '--base-url', base]),
    ).rejects.toMatchObject({
      code: 1,
      stdout: '',
      stderr: expect.stringContaining('HTTP 429; Retry-After: 15'),
    });
    expect(requests).toHaveLength(1);
  });

  it('rejects the removed spoilers command without making a request', async () => {
    await expect(
      execute(process.execPath, [cli, 'spoilers', '--base-url', base]),
    ).rejects.toMatchObject({
      code: 1,
      stdout: '',
      stderr: 'cgs-games: Unknown command. Use --help.\n',
    });
    expect(requests).toHaveLength(0);
  });

  it.each([
    ['delete'],
    ['games', '--unknown'],
    ['openapi', '--sandbox'],
    ['games', '--base-url'],
    ['games', '--base-url', 'http://example.com'],
    ['games', '--base-url', 'https://user:secret@example.com'],
    ['games', '--base-url', 'https://example.com/path'],
    ['games', '--sandbox', '--sandbox'],
  ])('rejects invalid arguments %j before making a request', async (...args) => {
    await expect(execute(process.execPath, [cli, ...args])).rejects.toMatchObject({
      code: 1,
      stdout: '',
    });
    expect(requests).toHaveLength(0);
  });

  it('provides version and help without network access', async () => {
    expect((await execute(process.execPath, [cli, '--version'])).stdout.trim()).toBe('1.0.0');
    const help = (await execute(process.execPath, [cli, '--help'])).stdout;
    expect(help).toContain('https://cgs.games/developers');
    expect(help).toContain('browse      Alias for games');
    expect(help).not.toContain('spoilers');
    expect(requests).toHaveLength(0);
  });
});
