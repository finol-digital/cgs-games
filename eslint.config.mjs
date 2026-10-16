import js from '@eslint/js';
import { fixupConfigRules } from '@eslint/compat';
import nextConfig from 'eslint-config-next/core-web-vitals';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

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
  // Keep older React/import plugins compatible with ESLint 10 without source patches.
  ...fixupConfigRules(nextConfig),
  {
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
  prettierRecommended,
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
