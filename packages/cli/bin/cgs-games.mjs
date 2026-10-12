#!/usr/bin/env node
import process from 'node:process';

const help = `CGS Games CLI 1.0.0
Usage: cgs-games <games|browse|openapi> [--sandbox] [--base-url URL]

games       Read the newest public games (up to 100).
browse      Alias for games; accepts the same options.
openapi     Print the OpenAPI specification.
--sandbox   Use deterministic fixtures; supported for games and browse.
--base-url  Default: https://cgs.games. Local HTTP is allowed on loopback only.
--help      Show this help.
--version   Show the CLI version.

Public reads only; no credentials needed. Output is JSON. Errors go to stderr.
HTTP 429 reports Retry-After; no automatic retries or writes are performed.
Documentation: https://cgs.games/developers
`;

/** Parse a small, read-only command surface and fail on ambiguous input. */
async function main(args) {
  if (!args.length || (args.length === 1 && args[0] === '--help')) {
    process.stdout.write(help);
    return;
  }
  if (args.length === 1 && args[0] === '--version') {
    process.stdout.write('1.0.0\n');
    return;
  }
  const [requestedCommand, ...options] = args;
  const command = requestedCommand === 'browse' ? 'games' : requestedCommand;
  const paths = { games: '/api/games', openapi: '/openapi.json' };
  if (!Object.hasOwn(paths, command)) throw new Error('Unknown command. Use --help.');
  let base = 'https://cgs.games';
  let sandbox = false;
  let hasBase = false;
  for (let index = 0; index < options.length; index++) {
    const option = options[index];
    if (option === '--sandbox' && !sandbox) sandbox = true;
    else if (option === '--base-url' && !hasBase && options[index + 1]) {
      base = options[++index];
      hasBase = true;
    } else throw new Error(`Unknown, duplicate, or incomplete option: ${option}. Use --help.`);
  }
  if (sandbox && command !== 'games')
    throw new Error('--sandbox is only available for games and browse.');
  const origin = new URL(base);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  if (
    (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && loopback)) ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== '/'
  )
    throw new Error(
      '--base-url must be an HTTPS origin or a local loopback HTTP origin, without credentials.',
    );
  const response = await fetch(new URL(sandbox ? '/api/sandbox/games' : paths[command], origin), {
    headers: { Accept: 'application/json', 'API-Version': '1' },
    signal: AbortSignal.timeout(30000),
    redirect: 'error',
  });
  if (!response.ok) {
    const retry = response.headers.get('retry-after');
    throw new Error(
      `HTTP ${response.status}${retry ? `; Retry-After: ${retry}` : ''}. See https://cgs.games/developers.`,
    );
  }
  process.stdout.write(JSON.stringify(await response.json(), null, 2) + '\n');
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`cgs-games: ${error.message}\n`);
  process.exitCode = 1;
});
