import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
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
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
  ...compat.extends('plugin:prettier/recommended'),
];
export default eslintConfig;
