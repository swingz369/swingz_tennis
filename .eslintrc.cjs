module.exports = {
  root: true,
  extends: [
    "next/core-web-vitals",
    "next/typescript",
  ],
  rules: {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-html-link-for-pages": "off",
    "@typescript-eslint/no-require-imports": "off"
  },
};
