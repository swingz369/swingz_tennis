module.exports = {
  root: true,
  extends: ['next/core-web-vitals', 'next/typescript'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off', // Too strict, causes noise
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', ignoreRestSiblings: true },
    ],
    'no-html-link-for-pages': 'off',
    '@typescript-eslint/no-require-imports': 'off',
    '@typescript-eslint/consistent-type-imports': 'warn',
    'no-console': 'off', // Allow console statements in production code (useful for debugging)
  },
  overrides: [
    {
      files: ['**/__tests__/**/*.ts', '**/__tests__/**/*.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
  ],
};
