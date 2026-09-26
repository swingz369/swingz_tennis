import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local for test environment (vitest only auto-loads .env)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Routen-Tests prüfen Fachlogik, nicht die Abo-Schranke. Ohne .env.local (CI)
// würde jede geschützte Route 402 liefern. Die Gate-Suites setzen den Wert selbst.
process.env.SUBSCRIPTION_ENFORCEMENT ??= 'off';

afterEach(() => {
  cleanup();
});

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    pathname: '/',
    query: {},
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'de',
  useMessages: () => ({}),
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    })),
  },
}));

// Mock TanStack Query
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    useQueryClient: vi.fn(() => ({
      invalidateQueries: vi.fn(),
      refetchQueries: vi.fn(),
      setQueryData: vi.fn(),
    })),
  };
});
