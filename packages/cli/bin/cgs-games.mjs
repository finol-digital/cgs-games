#!/usr/bin/env node
import process from 'node:process';
import { parseOrigin, requestJson } from './lib/http.mjs';
import { authCommand } from './lib/auth.mjs';
import { uploadCommand } from './lib/upload.mjs';

const help = `CGS Games CLI 1.0.0
Usage: cgs-games <games|browse|openapi|auth|upload> [options]

games       Read the newest public games (up to 100).
browse      Alias for games; accepts the same options.
openapi     Print the OpenAPI specification.
auth login  Sign in with Google in a browser; approve this CLI on the website.
auth status Verify the current sign-in without printing its credential.
auth logout Remove the saved token for this origin (does not revoke browser sessions).
upload      Publish a real listing using --url HTTPS_URL or --file GAME.cgs.zip.

--sandbox   Use deterministic fixtures; supported for games and browse only.
--base-url  Default: https://cgs.games. Local HTTP is allowed on loopback only.
--no-browser  Print the auth login URL without opening a browser.
--token-stdin Read a Firebase ID token from stdin for auth login.
--dry-run   Validate upload arguments/files without authentication or network requests.
--help      Show this help.
--version   Show the CLI version.

Public reads need no credentials. Uploads use CGS_TOKEN or an origin-bound saved
Firebase ID token. Tokens expire within one hour; sign in again when needed.
Credentials are stored in ~/.cgs-games (override with CGS_CONFIG_DIR).
Never pass tokens as command arguments. CGS_TOKEN is not removed by auth logout.
Output is JSON. Errors and browser sign-in instructions go to stderr.
HTTP 429 reports Retry-After. Requests are never automatically retried.
Documentation: https://cgs.games/developers
`;

/** Parses the command-specific surface before reading credentials or making any request. */
async function main(args) {
  if (!args.length || (args.length <= 2 && args.at(-1) === '--help')) {
    process.stdout.write(help);
    return;
  }
  if (args.length === 1 && args[0] === '--version') {
    process.stdout.write('1.0.0\n');
    return;
  }
  const [requestedCommand, ...remaining] = args;
  const command = requestedCommand === 'browse' ? 'games' : requestedCommand;
  if (!['games', 'openapi', 'auth', 'upload'].includes(command))
    throw new Error('Unknown command. Use --help.');
  const action = command === 'auth' ? remaining.shift() : null;
  if (command === 'auth' && !['login', 'status', 'logout'].includes(action))
    throw new Error('Use auth login, auth status, or auth logout.');
  const allowed = new Set(['--base-url']);
  if (command === 'games') allowed.add('--sandbox');
  if (command === 'upload') ['--url', '--file', '--dry-run'].forEach((flag) => allowed.add(flag));
  if (action === 'login') ['--no-browser', '--token-stdin'].forEach((flag) => allowed.add(flag));
  const values = {};
  for (let index = 0; index < remaining.length; index++) {
    const flag = remaining[index];
    if (!allowed.has(flag) || Object.hasOwn(values, flag))
      throw new Error('Unknown, duplicate, or incomplete option. Use --help.');
    if (['--base-url', '--url', '--file'].includes(flag)) {
      if (!remaining[index + 1] || remaining[index + 1].startsWith('--'))
        throw new Error('Missing option value. Use --help.');
      values[flag] = remaining[++index];
    } else values[flag] = true;
  }
  if (values['--token-stdin'] && values['--no-browser'])
    throw new Error('Choose --token-stdin or --no-browser, not both.');
  if (command === 'upload' && Boolean(values['--url']) === Boolean(values['--file']))
    throw new Error('Upload requires exactly one of --url or --file.');
  const origin = parseOrigin(values['--base-url'] || 'https://cgs.games');
  let result;
  if (command === 'auth') {
    result = await authCommand(action, origin, {
      tokenStdin: values['--token-stdin'],
      noBrowser: values['--no-browser'],
    });
  } else if (command === 'upload') {
    result = await uploadCommand(origin, {
      url: values['--url'],
      file: values['--file'],
      dryRun: values['--dry-run'],
    });
  } else {
    const path =
      command === 'openapi'
        ? '/openapi.json'
        : values['--sandbox']
          ? '/api/sandbox/games'
          : '/api/games';
    result = await requestJson(new URL(path, origin));
  }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`cgs-games: ${error.message}\n`);
  process.exitCode = 1;
});
