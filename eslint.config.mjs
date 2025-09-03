import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
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
  ...compat.extends('next/core-web-vitals', 'plugin:prettier/recommended'),
  js.configs.recommended,
  {
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
];
