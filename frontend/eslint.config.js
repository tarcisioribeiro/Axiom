import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import importPlugin from 'eslint-plugin-import'

export default defineConfig([
  globalIgnores(['dist', 'storybook-static', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
        fixStyle: 'inline-type-imports',
      }],
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-misused-promises': ['error', {
        checksVoidReturn: { attributes: false },
      }],
      '@typescript-eslint/no-unused-vars': ['error', {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'warn',
      'max-lines': ['warn', { max: 250, skipBlankLines: true, skipComments: true }],
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'Literal[value=/\\brounded-xl\\b/]',
          message:
            'Use rounded-lg instead of rounded-xl. The design token --radius (0.75rem) maps to rounded-lg.',
        },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { import: importPlugin },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },
    rules: {
      'import/order': ['error', {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        pathGroups: [
          {
            pattern: '@/**',
            group: 'internal',
            position: 'before',
          },
        ],
        pathGroupsExcludedImportTypes: ['builtin'],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      }],
      'import/no-duplicates': 'error',
    },
  },
  {
    files: [
      'src/**/__tests__/**/*.{ts,tsx}',
      'src/**/*.{test,spec}.{ts,tsx}',
      'src/test/**/*.ts',
    ],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      'max-lines': 'off',
    },
  },
  {
    // Enforce semantic spacing tokens in layout/common/pages layers.
    // Direct mapping: 1→xs, 2→sm, 4→md, 6→lg, 8→xl.
    // Numeric values remain acceptable for fine-grained adjustments (icon sizes, borders, etc.).
    files: [
      'src/components/common/**/*.{ts,tsx}',
      'src/components/layout/**/*.{ts,tsx}',
      'src/pages/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'Literal[value=/\\brounded-xl\\b/]',
          message:
            'Use rounded-lg instead of rounded-xl. The design token --radius (0.75rem) maps to rounded-lg.',
        },
        {
          selector:
            'Literal[value=/\\b(?:p|py|px|pt|pb|pl|pr|m|my|mx|mt|mb|ml|mr|gap|space-[xy])-(?:1|2|4|6|8)\\b/]',
          message:
            'Use semantic spacing tokens instead of numeric values. Mapping: 1→xs, 2→sm, 4→md, 6→lg, 8→xl (e.g., gap-4 → gap-md, p-6 → p-lg). See CLAUDE.md "Design Token System".',
        },
      ],
    },
  },
  {
    // Story files: disable rules that conflict with Storybook patterns
    files: ['src/**/*.stories.{ts,tsx}', '.storybook/**/*.{ts,tsx}'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'import/no-anonymous-default-export': 'off',
      'max-lines': 'off',
    },
  },
])
