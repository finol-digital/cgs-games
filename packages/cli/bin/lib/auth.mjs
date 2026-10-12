import process from 'node:process';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { requestJson } from './http.mjs';

/** Isolates saved ID tokens by exact origin, including local port numbers. */
function credentialPath(origin) {
  const directory = process.env.CGS_CONFIG_DIR || join(homedir(), '.cgs-games');
  return join(directory, createHash('sha256').update(origin.origin).digest('hex') + '.json');
}

/** Rejects malformed bearer input without echoing it into terminal output. */
function cleanToken(value) {
  const token = value.trim();
  if (!token || token.length > 16000 || /\s/.test(token))
    throw new Error('Invalid Firebase ID token.');
  return token;
}

/** Verifies the token remotely; decoded local JWT claims are never treated as identity evidence. */
export async function verifySession(origin, token) {
  const session = await requestJson(new URL('/api/cli/session', origin), { method: 'POST', token });
  if (
    typeof session.uid !== 'string' ||
    !session.uid ||
    session.uid.includes('/') ||
    session.uid.includes('\\') ||
    typeof session.storageBucket !== 'string' ||
    !/^[a-z0-9][a-z0-9._-]+$/.test(session.storageBucket) ||
    !Number.isFinite(Date.parse(session.expiresAt)) ||
    Date.parse(session.expiresAt) <= Date.now()
  ) {
    throw new Error('Invalid or expired session response. Sign in again.');
  }
  return session;
}

/** Writes a short-lived, origin-bound credential with owner-only POSIX permissions. */
export async function saveCredential(origin, token, session) {
  const filename = credentialPath(origin);
  await mkdir(join(filename, '..'), { recursive: true, mode: 0o700 });
  const temporary = filename + '.' + randomBytes(8).toString('hex');
  try {
    await writeFile(
      temporary,
      JSON.stringify({ origin: origin.origin, token, expiresAt: session.expiresAt }),
      { mode: 0o600, flag: 'wx' },
    );
    await rename(temporary, filename);
  } finally {
    await rm(temporary, { force: true });
  }
}

/** Reads an environment token first, otherwise only a non-expired credential for this origin. */
export async function loadToken(origin) {
  if (process.env.CGS_TOKEN) return cleanToken(process.env.CGS_TOKEN);
  try {
    const saved = JSON.parse(await readFile(credentialPath(origin), 'utf8'));
    if (saved.origin === origin.origin && Date.parse(saved.expiresAt) > Date.now())
      return cleanToken(saved.token);
  } catch {
    /* Missing or invalid credentials require a new login. */
  }
  throw new Error('No current sign-in for this origin. Run auth login or set CGS_TOKEN.');
}

/** Reads a bounded credential from stdin instead of exposing it in command arguments. */
export async function readToken() {
  if (process.stdin.isTTY) process.stderr.write('Paste a Firebase ID token, then press Enter:\n');
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk.toString();
    if (input.length > 16000) throw new Error('Firebase ID token input is too large.');
    if (input.includes('\n')) break;
  }
  return cleanToken(input);
}

/** Opens the authorization page without interpolating a URL into a shell command. */
function openBrowser(url) {
  const command =
    process.platform === 'win32'
      ? 'rundll32.exe'
      : process.platform === 'darwin'
        ? 'open'
        : 'xdg-open';
  const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
  const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.on('error', () => process.stderr.write('Open the printed sign-in URL in your browser.\n'));
  child.unref();
}

/** Receives one explicit browser approval over loopback, validating state, host, and site origin. */
export async function browserLogin(origin, noBrowser) {
  const state = randomBytes(32).toString('hex');
  let expectedHost;
  let claimed = false;
  let timer;
  let complete;
  let fail;
  const result = new Promise((resolve, reject) => {
    complete = resolve;
    fail = reject;
  });
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (
      request.method !== 'POST' ||
      request.url !== '/callback' ||
      request.headers.host !== expectedHost ||
      request.headers.origin !== origin.origin ||
      !request.headers['content-type']?.startsWith('application/x-www-form-urlencoded')
    ) {
      response.writeHead(403).end('Invalid CLI callback.');
      return;
    }
    try {
      let body = '';
      for await (const chunk of request) {
        body += chunk.toString();
        if (body.length > 20000) {
          response.writeHead(413).end('Callback too large.');
          return;
        }
      }
      const form = new URLSearchParams(body);
      const supplied = form.get('state') || '';
      if (
        !/^[a-f0-9]{64}$/.test(supplied) ||
        !timingSafeEqual(Buffer.from(state), Buffer.from(supplied)) ||
        claimed
      ) {
        response.writeHead(403).end('Invalid or used sign-in state.');
        return;
      }
      claimed = true;
      const token = cleanToken(form.get('token') || '');
      const session = await verifySession(origin, token);
      await saveCredential(origin, token, session);
      response.end(
        'CGS Games CLI authorized. You can close this tab and return to your terminal.',
        () => complete(session),
      );
    } catch {
      response
        .writeHead(401)
        .end('Authorization failed. Return to the CLI and try again.', () =>
          fail(new Error('Browser authorization failed. Run auth login again.')),
        );
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    expectedHost = `127.0.0.1:${server.address().port}`;
    const url = new URL('/cli/auth', origin);
    url.hash = new URLSearchParams({
      callback: `http://${expectedHost}/callback`,
      state,
    }).toString();
    process.stderr.write(`Open this URL to sign in and authorize the CLI:\n${url.href}\n`);
    timer = setTimeout(
      () => fail(new Error('Sign-in timed out after five minutes. Run auth login again.')),
      300000,
    );
    if (!noBrowser) openBrowser(url.href);
    return await result;
  } finally {
    clearTimeout(timer);
    server.closeAllConnections();
    server.close();
  }
}

/** Runs login, remote status verification, or local logout without printing credentials. */
export async function authCommand(action, origin, { tokenStdin, noBrowser }) {
  if (action === 'logout') {
    await rm(credentialPath(origin), { force: true });
    return {
      signedOut: true,
      origin: origin.origin,
      environmentTokenPresent: Boolean(process.env.CGS_TOKEN),
    };
  }
  if (action === 'status')
    return { authenticated: true, ...(await verifySession(origin, await loadToken(origin))) };
  if (tokenStdin) {
    const token = await readToken();
    const session = await verifySession(origin, token);
    await saveCredential(origin, token, session);
    return { authenticated: true, ...session };
  }
  return { authenticated: true, ...(await browserLogin(origin, noBrowser)) };
}
