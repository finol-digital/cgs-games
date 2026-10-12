import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const destination = fileURLToPath(new URL('../public/downloads', import.meta.url));
mkdirSync(destination, { recursive: true });
// npm supplies the actual CLI path, avoiding Windows shell quoting for file paths.
const result = spawnSync(
  process.execPath,
  [
    process.env.npm_execpath,
    'pack',
    './packages/cli',
    '--pack-destination',
    destination,
    '--ignore-scripts',
  ],
  { stdio: 'inherit' },
);
process.exitCode = result.status ?? 1;
