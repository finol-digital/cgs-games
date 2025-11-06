import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import nextConfig from 'eslint-config-next/core-web-vitals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      '.firebase/**',
      '.next/**',
      'next-env.d.ts',
      'node_modules/**',
      'out/**',
      'build/**',
      'public/**',
      'app/terms/**',
      'app/privacy/**',
    ],
  },
  js.configs.recommended,
  ...nextConfig,
  {
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
  ...compat.extends('plugin:prettier/recommended'),
  {
    files: [
      '__tests__/**/*.{js,jsx,ts,tsx}',
      '**/*.test.{js,jsx,ts,tsx}',
      '**/*.spec.{js,jsx,ts,tsx}',
    ],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
      },
    },
  },
];
export default eslintConfig;
