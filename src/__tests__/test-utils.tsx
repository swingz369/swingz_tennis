import type { ReactElement } from 'react';
import type { RenderOptions } from '@testing-library/react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import de from '@/i18n/dictionaries/de.json';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

interface TestProvidersProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
  locale?: string;
}

const TestProviders = ({ children, queryClient, locale = 'de' }: TestProvidersProps) => {
  const client = queryClient || createTestQueryClient();
  const messages = locale === 'de' ? de : {};

  return (
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
};

const customRender = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) => {
  return render(ui, { wrapper: TestProviders, ...options });
};

export * from '@testing-library/react';
export { customRender as render, TestProviders, createTestQueryClient };
