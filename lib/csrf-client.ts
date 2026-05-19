export function csrfHeaders(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  const token = document.cookie
    .split('; ')
    .find((c) => c.startsWith('csrf-token='))
    ?.split('=')[1];
  return token ? { 'x-csrf-token': token } : {};
}
