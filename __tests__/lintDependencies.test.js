/** @jest-environment node */

const { execFile } = require('node:child_process');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { createRequire } = require('node:module');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');
const lockfile = require('../package-lock.json');

const execute = promisify(execFile);
const fromNextConfig = createRequire(require.resolve('eslint-config-next/core-web-vitals'));
const fromNextPlugin = createRequire(fromNextConfig.resolve('@next/eslint-plugin-next'));
const { getRootDirs } = fromNextPlugin('./utils/get-root-dirs');

describe('Next.js lint dependency replacement', () => {
  let directory;
  let web;
  let admin;

  beforeAll(() => {
    directory = mkdtempSync(path.join(tmpdir(), 'cgs-lint-roots-'));
    web = path.join(directory, 'web');
    admin = path.join(directory, 'admin');
    mkdirSync(path.join(web, 'app'), { recursive: true });
    mkdirSync(path.join(admin, 'pages'), { recursive: true });
    writeFileSync(path.join(directory, 'README.md'), 'fixture');
  });

  afterAll(() => rmSync(directory, { recursive: true, force: true }));

  const roots = (rootDir) =>
    getRootDirs({ cwd: directory, settings: { next: { rootDir } } }).map((root) =>
      path.resolve(root),
    );

  it('keeps the default project root', () => {
    expect(roots(undefined)).toEqual([directory]);
  });

  it('does not expand a literal root into its app and other subdirectories', () => {
    expect(roots(web)).toEqual([web]);
    expect(roots(web + '/')).toEqual([web]);
  });

  it('finds directory globs and brace alternatives without including files', () => {
    expect(roots(directory + '/*').sort()).toEqual([admin, web].sort());
    expect(roots(directory + '/{web,admin}').sort()).toEqual([admin, web].sort());
    expect(roots(directory + '/**/pages')).toEqual([path.join(admin, 'pages')]);
    expect(roots(path.join(directory, 'README.md'))).toEqual([]);
    expect(roots(path.join(directory, 'missing'))).toEqual([]);
  });

  it('supports multiple configured roots', () => {
    expect(roots([web, admin])).toEqual([web, admin]);
  });

  it('removes the vulnerable dependency chain from the lockfile', () => {
    const removed = ['braces', 'micromatch', 'patch-package', '@eslint/eslintrc'];
    const remaining = Object.keys(lockfile.packages).filter((entry) =>
      removed.some((name) => entry.endsWith(`node_modules/${name}`)),
    );
    expect(remaining).toEqual([]);
  });

  it('limits the adapter to the verified Next.js consumer', () => {
    const consumers = Object.entries(lockfile.packages)
      .filter(([, entry]) => entry.dependencies?.['fast-glob'])
      .map(([name]) => name);
    expect(consumers).toEqual(['node_modules/@next/eslint-plugin-next']);
    const installations = Object.entries(lockfile.packages)
      .filter(([name]) => name.endsWith('node_modules/fast-glob'))
      .map(([, entry]) => entry.name);
    expect(installations).toEqual(['@cgs-games/next-root-glob']);
    expect(fromNextPlugin('fast-glob/package.json').name).toBe('@cgs-games/next-root-glob');
  });

  it('still enforces Next.js, React, hooks, accessibility, and formatting rules without patches', async () => {
    // Load the ESM flat configuration in Node, outside Jest's module transformer.
    const { stdout } = await execute(process.execPath, [
      '--input-type=module',
      '-e',
      String.raw`
        import { ESLint } from 'eslint';
        const eslint = new ESLint();
        const [result] = await eslint.lintText(
          'import { useEffect } from "react";\n' +
          'export default function Example({ enabled }: { enabled: boolean }) {\n' +
          '  if (enabled) useEffect(() => {}, []);\n' +
          '  return <><img src="/card.png" /><script src="/sync.js" />{[1].map(n => <span>{n}</span>)}</>;\n' +
          '}\n',
          { filePath: 'app/dependency-check.tsx' },
        );
        console.log(JSON.stringify(result.messages.map(message => message.ruleId)));
      `,
    ]);
    expect(JSON.parse(stdout)).toEqual(
      expect.arrayContaining([
        '@next/next/no-sync-scripts',
        'react/jsx-key',
        'react-hooks/rules-of-hooks',
        'jsx-a11y/alt-text',
        'prettier/prettier',
      ]),
    );
  }, 90000);
});
