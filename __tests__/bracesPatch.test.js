/** @jest-environment node */

const braces = require('braces');
const micromatch = require('micromatch');
const { runInNewContext } = require('node:vm');

describe('braces stack-exhaustion mitigation', () => {
  it.each([
    ['braces', '{'.repeat(101) + 'a,b' + '}'.repeat(101)],
    ['parentheses', '('.repeat(101) + 'a' + ')'.repeat(101)],
    ['mixed nesting', '{('.repeat(51) + 'a,b' + ')}'.repeat(51)],
  ])('rejects excessive %s nesting before traversing the AST', (_name, pattern) => {
    for (const method of ['parse', 'compile', 'expand', 'stringify']) {
      expect(() => braces[method](pattern)).toThrow(/exceeds max depth/);
      expect(() => braces[method](pattern, { maxDepth: Infinity })).toThrow(/exceeds max depth/);
      expect(() => braces[method](pattern, { maxDepth: 1000 })).toThrow(/exceeds max depth/);
    }
  });

  it.each(['compile', 'expand', 'stringify'])('guards direct AST input to %s', (method) => {
    let ast = { type: 'text', value: 'a' };
    for (let i = 0; i < 101; i++) ast = { type: 'brace', nodes: [ast] };
    expect(() => braces[method]({ type: 'root', nodes: [ast] })).toThrow(/exceeds max depth/);
  });

  it('rejects cyclic parent links without hanging', () => {
    const ast = { type: 'paren', nodes: [{ type: 'text', value: 'a' }] };
    ast.parent = ast;
    expect(() => runInNewContext('braces.expand(ast)', { braces, ast }, { timeout: 1000 })).toThrow(
      /parent chain contains a cycle/,
    );
  });

  it('preserves normal expansion, nesting, escaping, and glob matching', () => {
    expect(braces.expand('file-{1..3}.{js,ts}')).toEqual([
      'file-1.js',
      'file-1.ts',
      'file-2.js',
      'file-2.ts',
      'file-3.js',
      'file-3.ts',
    ]);
    expect(braces.expand('foo/({a,b})')).toEqual(['foo/(a)', 'foo/(b)']);
    expect(braces.stringify('{{a,b},c}', { escapeInvalid: true })).toBe('{{a,b},c}');
    expect(braces.stringify('{'.repeat(100) + 'a' + '}'.repeat(100))).toBe(
      '{'.repeat(100) + 'a' + '}'.repeat(100),
    );
    expect(micromatch(['app/page.tsx', 'lib/game.ts', 'README.md'], '**/*.{ts,tsx}')).toEqual([
      'app/page.tsx',
      'lib/game.ts',
    ]);
  });
});
