/** @jest-environment node */

const { createRequire } = require('node:module');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const lockfile = require('../package-lock.json');
const fromJest = createRequire(require.resolve('jest-config'));
const merge = fromJest('deepmerge');
const { mergeConfig, readConfig } = require('jest-config');

describe('Jest configuration merge dependency', () => {
  it('replaces the vulnerable package only for the verified Jest consumer', () => {
    const consumers = Object.entries(lockfile.packages)
      .filter(([, entry]) => entry.dependencies?.deepmerge)
      .map(([name]) => name);
    expect(consumers).toEqual(['node_modules/jest-config']);
    const installations = Object.entries(lockfile.packages)
      .filter(([name]) => name.endsWith('node_modules/deepmerge'))
      .map(([, entry]) => entry.name);
    expect(installations).toEqual(['@cgs-games/jest-config-merge']);
    expect(fromJest('deepmerge/package.json').name).toBe('@cgs-games/jest-config-merge');
  });

  it('merges nested configuration and concatenates arrays without sharing mutable inputs', () => {
    const defaults = {
      globals: { enabled: true, nested: { left: 1 } },
      setupFiles: [{ file: 'a' }],
    };
    const overrides = {
      globals: { enabled: false, nested: { right: 2 } },
      setupFiles: [{ file: 'b' }],
    };
    const result = mergeConfig(defaults, overrides);
    expect(result).toEqual({
      globals: { enabled: false, nested: { left: 1, right: 2 } },
      setupFiles: [{ file: 'a' }, { file: 'b' }],
    });
    result.globals.nested.left = 99;
    result.setupFiles[0].file = 'changed';
    result.setupFiles[1].file = 'changed';
    expect(defaults.globals.nested.left).toBe(1);
    expect(defaults.setupFiles).toEqual([{ file: 'a' }]);
    expect(overrides.setupFiles).toEqual([{ file: 'b' }]);
  });

  it('preserves special values and enumerable symbols used by configuration objects', () => {
    const symbol = Symbol('config');
    const hidden = Symbol('hidden');
    const date = new Date('2026-10-27T00:00:00Z');
    const expression = /test/i;
    const callback = () => 'value';
    const source = { date, expression, callback, [symbol]: { value: 1 } };
    Object.defineProperty(source, hidden, { value: 'private', enumerable: false });
    const result = merge({}, source);
    expect(result.date).toBe(date);
    expect(result.expression).toBe(expression);
    expect(result.callback).toBe(callback);
    expect(result[symbol]).toEqual({ value: 1 });
    expect(result[symbol]).not.toBe(source[symbol]);
    expect(result[hidden]).toBeUndefined();
  });

  it('handles empty and ordered multi-config merges and rejects unsupported options', () => {
    expect(merge.all([])).toEqual({});
    expect(merge.all([{ value: 1 }, { value: 2 }, { value: 3 }])).toEqual({ value: 3 });
    expect(() => merge.all({})).toThrow('Expected an array');
    expect(() => merge({}, {}, { clone: false })).toThrow('does not support deepmerge options');
    expect(() => merge.all([{}], {})).toThrow('does not support deepmerge options');
  });

  it.each(['target', 'source'])(
    'rejects prototype keys from the %s, including nested clones',
    (side) => {
      const payload = JSON.parse(
        '{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"prototype":{"polluted":true},"safe":1}',
      );
      const configuration = { globals: payload, items: [payload] };
      const result = side === 'target' ? merge(configuration, {}) : merge({}, configuration);
      for (const value of [result.globals, result.items[0]]) {
        expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
        expect(value.polluted).toBeUndefined();
        expect(Object.keys(value)).toEqual(['safe']);
      }
      expect({}.polluted).toBeUndefined();
    },
  );

  it('rejects poisoning when the target has a null prototype', () => {
    const payload = JSON.parse('{"__proto__":{"polluted":true},"safe":1}');
    const result = merge(Object.create(null), payload);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(result).toEqual({ safe: 1 });
    expect(result.polluted).toBeUndefined();
    expect({}.polluted).toBeUndefined();
  });

  it('uses the replacement when Jest merges a preset with local globals', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'cgs-jest-merge-'));
    try {
      writeFileSync(
        path.join(directory, 'jest-preset.json'),
        JSON.stringify({
          globals: { nested: { preset: true, override: 'old' }, values: ['preset'] },
        }),
      );
      writeFileSync(
        path.join(directory, 'jest.config.json'),
        JSON.stringify({
          rootDir: directory,
          preset: './jest-preset.json',
          globals: { nested: { local: true, override: 'new' }, values: ['local'] },
        }),
      );
      const { projectConfig } = await readConfig({}, directory);
      expect(projectConfig.globals).toEqual({
        nested: { preset: true, local: true, override: 'new' },
        values: ['preset', 'local'],
      });
    } finally {
      if (path.dirname(directory) === path.resolve(tmpdir())) {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  });
});
