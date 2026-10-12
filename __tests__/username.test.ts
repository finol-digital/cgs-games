/** @jest-environment node */
import { readFileSync, readdirSync } from 'node:fs';
import reserved from '@/lib/reservedUsernames.json';
import { isReservedUsername, isValidUsername } from '@/lib/username';
import { staticPaths } from '@/lib/siteRoutes';

describe('creator username policy', () => {
  it.each(reserved)('reserves %s, including case variants', (name) => {
    expect(isReservedUsername(name)).toBe(true);
    expect(isReservedUsername(name.toUpperCase())).toBe(true);
    expect(isValidUsername(name)).toBe(false);
  });
  it.each([
    'alice',
    'my-game',
    'my_game',
    'my.game',
    '-ab',
    'ab-',
    'a'.repeat(15),
    'session',
    'games',
    'sandbox',
  ])('accepts %s', (name) => {
    expect(isValidUsername(name)).toBe(true);
  });
  it.each([
    'ab',
    'a'.repeat(16),
    'Alice',
    '.abc',
    'abc_',
    'a..b',
    'a_.b',
    'a__b',
    'a/b',
    'a b',
    'a%b',
    'abc\n',
  ])('rejects malformed name %s', (name) => {
    expect(isValidUsername(name)).toBe(false);
  });
  it('reserves every static route prefix, public asset, and application namespace', () => {
    const names = [
      ...Array.from(staticPaths, (route) => route.split('/')[1]),
      ...readdirSync('public'),
      ...(readdirSync('app', { recursive: true }) as string[])
        .map((file) => file.replaceAll('\\', '/'))
        .filter((file) => /\/(page|route)\.tsx?$/.test(file) && !file.startsWith('['))
        .map((file) => file.split('/')[0]),
      '_next',
    ].filter(Boolean);
    // Generated hashed assets may already be excluded by the username length/format rules.
    expect(names.filter((name) => isValidUsername(name.toLowerCase()))).toEqual([]);
  });
  it('keeps the database reserved-name list identical to the browser policy', () => {
    const rules = readFileSync('firestore.rules', 'utf8');
    const list = rules.match(/username in \[([\s\S]*?)\]/)![1];
    const names = Array.from(list.matchAll(/'([^']+)'/g), (match) => match[1]);
    expect(names.sort()).toEqual([...reserved].sort());
  });
});
