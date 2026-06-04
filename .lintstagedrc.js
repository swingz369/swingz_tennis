module.exports = {
  '*.ts?(x)': ({ filenames }) => {
    const nonScripts = filenames.filter((f) => !f.includes('/scripts/'));
    if (nonScripts.length === 0) return [];
    return [`eslint --fix --max-warnings=0 ${nonScripts.join(' ')}`];
  },
  '*.{ts,tsx,js,jsx,json,md,mdx,css,scss,yml,yaml}': ['prettier --write'],
};
