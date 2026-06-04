module.exports = {
  '*.{js,jsx,ts,tsx}': ['eslint --fix --max-warnings=0 --no-warn-ignored', 'prettier --write'],
  '*.{json,md,mdx,css,scss,yml,yaml}': ['prettier --write'],
};
