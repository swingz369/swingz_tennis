import React from 'react';
import { UseQueryResult } from '@tanstack/react-query';
import { QueryError, EmptyState, NotFound } from '@/components/ui/error-states';
import { FullPageLoading } from '@/components/ui/loading-skeletons';

interface UseQueryStateOptions {
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
  notFoundComponent?: React.ReactNode;
  onRetry?: () => void;
  onBack?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ReactNode;
  emptyAction?: {
    label: string;
    onClick: () => void;
  };
}

export function useQueryState<T>(query: UseQueryResult<T>, options: UseQueryStateOptions = {}) {
  const {
    loadingComponent,
    errorComponent,
    emptyComponent,
    notFoundComponent,
    onRetry,
    onBack,
    emptyTitle,
    emptyDescription,
    emptyIcon,
    emptyAction,
  } = options;

  const defaultLoadingComponent = React.createElement(FullPageLoading);

  if (emptyComponent !== undefined) {
  }

  if (notFoundComponent !== undefined) {
  }

  if (emptyTitle !== undefined) {
  }

  if (emptyDescription !== undefined) {
  }

  if (emptyIcon !== undefined) {
  }

  if (emptyAction !== undefined) {
  }

  if (query.isLoading) {
    return {
      state: 'loading' as const,
      component: loadingComponent || defaultLoadingComponent,
      data: null,
    };
  }

  if (query.isError) {
    const component =
      errorComponent ||
      React.createElement(QueryError, {
        error: query.error as Error,
        onRetry: onRetry || (() => query.refetch()),
        ...(onBack ? { onBack } : {}),
      });
    return {
      state: 'error' as const,
      component,
      data: null,
    };
  }

  if (!query.data) {
    const component =
      notFoundComponent ||
      React.createElement(NotFound, {
        ...(onBack ? { onBack } : {}),
      });
    return {
      state: 'notFound' as const,
      component,
      data: null,
    };
  }

  if (Array.isArray(query.data) && query.data.length === 0) {
    const emptyStateProps: any = {
      title: emptyTitle || 'Keine Daten',
      description: emptyDescription || 'Es sind keine Daten verfügbar.',
    };
    if (emptyIcon) emptyStateProps.icon = emptyIcon;
    if (emptyAction) emptyStateProps.action = emptyAction;
    const defaultEmptyComponent = React.createElement(EmptyState, emptyStateProps);
    const finalEmptyComponent = emptyComponent ? emptyComponent : defaultEmptyComponent;
    return {
      state: 'empty' as const,
      component: finalEmptyComponent,
      data: null,
    };
  }

  return {
    state: 'success' as const,
    component: null,
    data: query.data,
  };
}

export function WithQueryState<T>(
  query: UseQueryResult<T>,
  render: (data: T) => React.ReactNode,
  options: UseQueryStateOptions = {}
) {
  const { state, component, data } = useQueryState(query, options);

  if (state !== 'success') {
    return component;
  }

  return render(data);
}

export { QueryError, EmptyState, NotFound, FullPageLoading };
