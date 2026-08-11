import nextConfig from 'eslint-config-next';
import nextTypescriptConfig from 'eslint-config-next/typescript';
import paginationNavRule from './eslint-rules/pagination-nav-mutually-exclusive-props.js';

const eslintConfig = [
  // ═══ Global ignores ═══
  {
    ignores: [
      // Build outputs
      '.next/**',
      'out/**',
      'dist/**',
      'build/**',
      // Dependencies
      'node_modules/**',
      // Generated / third-party code
      'aws/**',
      'supabase/**',
      'drizzle/**',
      'public/**',
      // Vendor: React-Kopie des Design-System-Bundles, kein eigener Code.
      // Die 71 Fehler daraus verdecken sonst echte Treffer. Auch in .gitignore.
      'ds-bundle/**',
      // Vercel
      '.vercel/**',
      // Temp & cache
      '.tmp/**',
      '.cache/**',
      '.temp/**',
      // IDE & tooling
      '.vscode/**',
      '.idea/**',
      '.claude/**',
      '.kilo/**',
      '.kilocode/**',
      '.opencode/**',
      '.remember/**',
      '.husky/**',
      '.playwright-mcp/**',
      // Infrastructure archive
      '_infrastructure-archive/**',
      // Test outputs
      'test-results/**',
      'playwright-report/**',
      'coverage/**',
      // Misc
      'logs/**',
      'docker/**',
      'monitoring/**',
      'sql/**',
      '.supabase-types-backup/**',
      'scripts/**',
      // TypeScript build info
      '*.tsbuildinfo',
    ],
  },

  // ═══ Next.js core + TypeScript + jsx-a11y (native flat config) ═══
  ...nextConfig,
  ...nextTypescriptConfig,

  // ═══ Main configuration overrides ═══
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],

    rules: {
      // TypeScript
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@next/next/no-html-link-for-pages': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/consistent-type-imports': 'warn',
      'no-console': 'off',

      // React: disable for German UI strings (apostrophes/quotes are valid in de-DE)
      // and for display-name (anonymous forwardRef components are an established pattern)
      'react/no-unescaped-entities': 'off',
      'react/display-name': 'off',
      // Async data fetching in useEffect is a standard React pattern
      'react-hooks/set-state-in-effect': 'off',

      // jsx-a11y: downgrade noisy recommended rules from error to warn
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/label-has-associated-control': 'warn',
      'jsx-a11y/media-has-caption': 'warn',
      'jsx-a11y/mouse-events-have-key-events': 'warn',
      'jsx-a11y/no-access-key': 'warn',
      'jsx-a11y/no-autofocus': 'warn',
      'jsx-a11y/no-noninteractive-element-interactions': 'warn',
      'jsx-a11y/no-noninteractive-tabindex': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/tabindex-no-positive': 'warn',
    },
  },

  // ═══ Test file overrides ═══
  {
    files: ['**/__tests__/**/*.ts', '**/__tests__/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'jsx-a11y/alt-text': 'off',
      'jsx-a11y/label-has-associated-control': 'off',
    },
  },

  // ═══ Custom project rules ═══
  {
    files: ['**/*.{tsx,jsx}'],
    plugins: {
      swingz: {
        rules: {
          'pagination-nav-mutually-exclusive-props': paginationNavRule,
        },
      },
    },
    rules: {
      'swingz/pagination-nav-mutually-exclusive-props': 'error',
    },
  },
];

export default eslintConfig;
