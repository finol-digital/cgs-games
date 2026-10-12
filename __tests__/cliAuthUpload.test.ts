/** @jest-environment node */
import { execFile } from 'node:child_process';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { mkdtemp, open, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const cli = 'packages/cli/bin/cgs-games.mjs';
let server: Server;
let base: string;
let directory: string;
let publishStatus: number;
let username: string | null;
let redirectSession: boolean;
let requests: { path: string; authorization?: string; body: string }[];
const session = () => ({
  uid: 'test-user',
  username,
  storageBucket: 'test-bucket.appspot.com',
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
});
const env = () => ({ ...process.env, CGS_CONFIG_DIR: directory, CGS_TOKEN: '' });

/** Executes the real CLI with isolated credentials and optional stdin. */
function run(args: string[], input = '', extra = {}) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = execFile(
      process.execPath,
      [cli, ...args, '--base-url', base],
      { env: { ...env(), ...extra }, timeout: 10000 },
      (error, stdout, stderr) => {
        if (error) reject(Object.assign(error, { stdout, stderr }));
        else resolve({ stdout, stderr });
      },
    );
    child.stdin!.end(input);
  });
}

beforeAll(async () => {
  server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk.toString();
    requests.push({ path: request.url!, authorization: request.headers.authorization, body });
    response.setHeader('Content-Type', 'application/json');
    if (request.method === 'GET') {
      response.end('[]');
      return;
    }
    if (request.headers.authorization !== 'Bearer fixture-token') {
      response.writeHead(401).end('{}');
      return;
    }
    if (request.url === '/api/cli/session' && redirectSession) {
      response.writeHead(307, { Location: base + '/credential-destination' }).end();
      return;
    }
    if (request.url === '/api/cli/session') {
      response.end(JSON.stringify(session()));
      return;
    }
    response.writeHead(publishStatus).end(JSON.stringify({ success: true, slug: 'fixture-game' }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
});
beforeEach(async () => {
  requests = [];
  publishStatus = 200;
  username = 'creator';
  redirectSession = false;
  directory = await mkdtemp(join(tmpdir(), 'cgs-cli-test-'));
});
afterEach(async () => {
  expect(directory.startsWith(join(tmpdir(), 'cgs-cli-test-'))).toBe(true);
  await rm(directory, { recursive: true, force: true });
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('CLI authentication and publishing', () => {
  it('does not follow an authenticated redirect', async () => {
    redirectSession = true;
    await expect(run(['auth', 'status'], '', { CGS_TOKEN: 'fixture-token' })).rejects.toMatchObject(
      { code: 1 },
    );
    expect(requests.map((request) => request.path)).toEqual(['/api/cli/session']);
  });
  it('rejects empty or oversized archives before authentication or network access', async () => {
    const file = join(directory, 'game.cgs.zip');
    await writeFile(file, '');
    await expect(run(['upload', '--file', file])).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('nonempty'),
    });
    const handle = await open(file, 'w');
    try {
      await handle.truncate(100 * 1024 * 1024 + 1);
    } finally {
      await handle.close();
    }
    await expect(run(['upload', '--file', file])).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('100 MiB'),
    });
    expect(requests).toEqual([]);
  });
  it('logs in via stdin, verifies status, and removes only local credentials on logout', async () => {
    const login = await run(['auth', 'login', '--token-stdin'], 'fixture-token\n');
    expect(JSON.parse(login.stdout).authenticated).toBe(true);
    expect(login.stdout + login.stderr).not.toContain('fixture-token');
    expect(JSON.parse((await run(['auth', 'status'])).stdout).username).toBe('creator');
    expect(JSON.parse((await run(['auth', 'logout'])).stdout).signedOut).toBe(true);
    await expect(run(['auth', 'status'])).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('No current sign-in'),
    });
  });
  it('does not save rejected credentials or print them', async () => {
    await expect(run(['auth', 'login', '--token-stdin'], 'rejected-token\n')).rejects.toMatchObject(
      { code: 1, stdout: '', stderr: expect.not.stringContaining('rejected-token') },
    );
    expect(await readdir(directory)).toEqual([]);
  });
  it('binds saved credentials to their origin and rejects expired credentials', async () => {
    await run(['auth', 'login', '--token-stdin'], 'fixture-token\n');
    const filename = join(directory, (await readdir(directory))[0]);
    const saved = JSON.parse(await readFile(filename, 'utf8'));
    await writeFile(filename, JSON.stringify({ ...saved, origin: 'https://another.example' }));
    requests = [];
    await expect(run(['auth', 'status'])).rejects.toMatchObject({ code: 1 });
    expect(requests).toEqual([]);
    await writeFile(filename, JSON.stringify({ ...saved, expiresAt: '2000-01-01T00:00:00Z' }));
    await expect(run(['auth', 'status'])).rejects.toMatchObject({ code: 1 });
    expect(requests).toEqual([]);
  });
  it('publishes a URL once using an environment token without storing it', async () => {
    const result = await run(['upload', '--url', 'https://example.test/cgs.json'], '', {
      CGS_TOKEN: 'fixture-token',
    });
    expect(JSON.parse(result.stdout)).toEqual({ success: true, slug: 'fixture-game' });
    expect(requests.map((request) => request.path)).toEqual(['/api/cli/session', '/api/games']);
    expect(JSON.parse(requests[1].body)).toEqual({
      autoUpdateUrl: 'https://example.test/cgs.json',
    });
    expect(await readdir(directory)).toEqual([]);
  });
  it('never sends credentials on public reads', async () => {
    await run(['browse'], '', { CGS_TOKEN: 'fixture-token' });
    expect(requests[0].authorization).toBeUndefined();
  });
  it('requires a creator username and does not retry failed writes', async () => {
    username = null;
    await expect(
      run(['upload', '--url', 'https://example.test/cgs.json'], '', { CGS_TOKEN: 'fixture-token' }),
    ).rejects.toMatchObject({ stderr: expect.stringContaining('Choose a creator username') });
    expect(requests).toHaveLength(1);
    username = 'creator';
    publishStatus = 409;
    requests = [];
    await expect(
      run(['upload', '--url', 'https://example.test/cgs.json'], '', { CGS_TOKEN: 'fixture-token' }),
    ).rejects.toMatchObject({ stderr: expect.stringContaining('HTTP 409') });
    expect(requests.filter((request) => request.path === '/api/games')).toHaveLength(1);
  });
  it('validates dry runs and invalid upload options without requests', async () => {
    const file = join(directory, 'game.cgs.zip');
    await writeFile(file, 'fixture');
    expect(JSON.parse((await run(['upload', '--file', file, '--dry-run'])).stdout)).toMatchObject({
      dryRun: true,
      bytes: 7,
    });
    for (const args of [
      [],
      ['--url', 'http://example.test/cgs.json'],
      ['--file', 'bad.txt'],
      ['--url', 'https://example.test/cgs.json', '--file', file],
      ['--url', 'https://example.test/cgs.json', '--sandbox'],
    ]) {
      await expect(run(['upload', ...args])).rejects.toMatchObject({ code: 1 });
    }
    expect(requests).toEqual([]);
  });
  it.each([200, 409, 500])(
    'stages ZIPs with Firebase auth and cleans up after processing status %i',
    async (status) => {
      const file = join(directory, 'game.cgs.zip');
      await writeFile(file, 'archive-fixture');
      const script = `
      import { uploadCommand } from './packages/cli/bin/lib/upload.mjs';
      const calls = [];
      globalThis.fetch = async (url, options) => {
        const target = new URL(url);
        const body = options.body instanceof Blob ? await options.body.text() : options.body;
        calls.push({ url: target.href, method: options.method, headers: options.headers, redirect: options.redirect, body });
        if (target.pathname === '/api/cli/session') return Response.json({uid:'test-user', username:'creator', storageBucket:'test-bucket.appspot.com', expiresAt:new Date(Date.now()+3600000).toISOString()});
        if (target.hostname === 'firebasestorage.googleapis.com') return new Response('{}', {status:200});
        if (target.pathname === '/api/games/upload') return Response.json({success:true,slug:'fixture-game'}, {status:Number(process.argv[2])});
        throw new Error('Unexpected request');
      };
      let result, error;
      try { result = await uploadCommand(new URL('https://cgs.example'), {file:process.argv[1]}); }
      catch (failure) { error = failure.message; }
      console.log(JSON.stringify({calls,result,error}));
    `;
      const result = await new Promise<string>((resolve, reject) => {
        execFile(
          process.execPath,
          ['--input-type=module', '-e', script, file, String(status)],
          { env: { ...env(), CGS_TOKEN: 'fixture-token' } },
          (error, stdout) => (error ? reject(error) : resolve(stdout)),
        );
      });
      const data = JSON.parse(result);
      expect(data.calls.map((call: { method: string }) => call.method)).toEqual([
        'POST',
        'POST',
        'POST',
        'DELETE',
      ]);
      expect(data.calls.every((call: { redirect: string }) => call.redirect === 'error')).toBe(
        true,
      );
      const storage = data.calls[1];
      expect(storage.headers.Authorization).toBe('Firebase fixture-token');
      expect(storage.headers['X-Goog-Upload-Protocol']).toBe('multipart');
      expect(storage.headers['Content-Type']).toMatch(/^multipart\/related; boundary=/);
      expect(storage.body).toContain('archive-fixture');
      const publish = JSON.parse(data.calls[2].body);
      expect(publish).toEqual({
        stagedPath: expect.stringMatching(/^staged-uploads\/test-user\/[a-f0-9-]+\.cgs\.zip$/),
        originalFilename: 'game.cgs.zip',
      });
      expect(new URL(storage.url).searchParams.get('name')).toBe(publish.stagedPath);
      expect(decodeURIComponent(new URL(data.calls[3].url).pathname)).toContain(
        '/o/' + publish.stagedPath,
      );
      if (status === 200) expect(data.result).toEqual({ success: true, slug: 'fixture-game' });
      else expect(data.error).toContain('HTTP ' + status);
      expect(requests).toEqual([]);
    },
  );
  it('accepts a browser callback only with matching state and origin', async () => {
    let output = '';
    let errors = '';
    let child: ReturnType<typeof execFile>;
    const completed = new Promise<void>((resolve, reject) => {
      child = execFile(
        process.execPath,
        [cli, 'auth', 'login', '--no-browser', '--base-url', base],
        { env: env(), timeout: 15000 },
        (error, stdout, stderr) => {
          output = stdout;
          errors = stderr;
          if (error) reject(error);
          else resolve();
        },
      );
    });
    try {
      const loginUrl = await new Promise<URL>((resolve) => {
        let text = '';
        child!.stderr!.on('data', (chunk) => {
          text += chunk.toString();
          const match = text.match(/http:\/\/[^\s]+\/cli\/auth#[^\s]+/);
          if (match) resolve(new URL(match[0]));
        });
      });
      const params = new URLSearchParams(loginUrl.hash.slice(1));
      const callback = params.get('callback')!;
      const post = (origin: string, state: string) =>
        fetch(callback, {
          method: 'POST',
          headers: { Origin: origin },
          body: new URLSearchParams({ state, token: 'fixture-token' }),
        });
      expect((await post('https://evil.example', params.get('state')!)).status).toBe(403);
      expect((await post(base, 'b'.repeat(64))).status).toBe(403);
      expect(requests).toEqual([]);
      expect((await post(base, params.get('state')!)).status).toBe(200);
      await completed;
      expect(JSON.parse(output).authenticated).toBe(true);
      expect(output + errors).not.toContain('fixture-token');
    } finally {
      child!.kill();
      await completed.catch(() => {});
    }
  }, 20000);
});
