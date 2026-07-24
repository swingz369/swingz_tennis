// Vitest/jsdom has no equivalent of Next.js's webpack alias that no-ops
// `server-only` for server bundles — its real implementation unconditionally
// throws outside that special bundling context. Stub it out for tests.
export {};
