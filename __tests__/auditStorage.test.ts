/** @jest-environment node */
import { execFileSync } from 'node:child_process';

it('does not let corrupt prefixes hide orphaned published objects in the audit', () => {
  const output = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import { auditStoragePrefixes } from './scripts/lib/auditStorage.mjs';
    const registry = new Map([['alice', 'alice-uid']]);
    const games = [
      { id: 'valid', data: { username: 'alice', slug: 'listed', storageBasePath: 'games/alice-uid/listed' } },
      { id: 'broad', data: { username: 'alice', slug: 'bad', storageBasePath: 'games/alice-uid' } },
      { id: 'cross-owner', data: { username: 'alice', slug: 'bad', storageBasePath: 'games/bob/bad' } },
      { id: 'unknown', data: { username: 'unknown', slug: 'bad', storageBasePath: 'games/unknown/bad' } },
      { id: 'traversal', data: { username: 'alice', slug: '..', storageBasePath: 'games/alice-uid/..' } },
      { id: 'nested', data: { username: 'alice', slug: 'a/b', storageBasePath: 'games/alice-uid/a/b' } },
      { id: 'url-only', data: { username: 'alice', slug: 'remote' } },
    ];
    const {prefixes, findings} = auditStoragePrefixes(games, registry);
    const files = ['games/alice-uid/listed/Card.png', 'games/alice-uid/orphan/Card.png', 'games/bob/bad/Card.png', 'games/alice-uid/listed-other/Card.png'];
    console.log(JSON.stringify({ prefixes: [...prefixes], invalid: findings.map(f => f.gameId), orphans: files.filter(path => ![...prefixes].some(prefix => path.startsWith(prefix))) }));
  `,
    ],
    { encoding: 'utf8' },
  );
  expect(JSON.parse(output)).toEqual({
    prefixes: ['games/alice-uid/listed/'],
    invalid: ['broad', 'cross-owner', 'unknown', 'traversal', 'nested'],
    orphans: [
      'games/alice-uid/orphan/Card.png',
      'games/bob/bad/Card.png',
      'games/alice-uid/listed-other/Card.png',
    ],
  });
});
