import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../test-utils';
import { QueryError, EmptyState, NotFound, AccessDenied } from '@/components/ui/error-states';

describe('Error States Components', () => {
  describe('QueryError', () => {
    it('should render error message', () => {
      const error = new Error('Test error');
      render(<QueryError error={error} message="Test error" />);
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });

    it('should render default error message when not provided', () => {
      const error = new Error('Test error');
      render(<QueryError error={error} />);
      expect(screen.getByText(/die daten konnten nicht geladen werden/i)).toBeInTheDocument();
    });

    it('should render retry button when onRetry is provided', () => {
      const onRetry = vi.fn();
      const error = new Error('Test error');
      render(<QueryError error={error} message="Test error" onRetry={onRetry} />);
      const retryButton = screen.getByRole('button', { name: /erneut versuchen/i });
      expect(retryButton).toBeInTheDocument();
    });

    it('should render back button when onBack is provided', () => {
      const onBack = vi.fn();
      const error = new Error('Test error');
      render(<QueryError error={error} message="Test error" onBack={onBack} />);
      const backButton = screen.getByRole('button', { name: /zurück/i });
      expect(backButton).toBeInTheDocument();
    });
  });

  describe('EmptyState', () => {
    it('should render empty message', () => {
      render(<EmptyState title="No data" description="No data available" />);
      expect(screen.getByText('No data')).toBeInTheDocument();
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    it('should render action button when provided', () => {
      render(
        <EmptyState
          title="No data"
          description="No data available"
          action={{ label: 'Add', onClick: vi.fn() }}
        />
      );
      expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    });

    it('should render icon when provided', () => {
      render(
        <EmptyState
          title="No data"
          description="No data available"
          icon={<div data-testid="test-icon">Icon</div>}
        />
      );
      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });
  });

  describe('NotFound', () => {
    it('should render not found message', () => {
      render(<NotFound title="Resource not found" description="The resource was not found" />);
      expect(screen.getByText('Resource not found')).toBeInTheDocument();
      expect(screen.getByText('The resource was not found')).toBeInTheDocument();
    });

    it('should render default message when not provided', () => {
      render(<NotFound />);
      expect(screen.getAllByText(/nicht gefunden/i)).toHaveLength(2);
    });

    it('should render back button when onBack is provided', () => {
      const onBack = vi.fn();
      render(<NotFound onBack={onBack} />);
      const backButton = screen.getByRole('button', { name: /zurück/i });
      expect(backButton).toBeInTheDocument();
    });
  });

  describe('AccessDenied', () => {
    it('should render access denied message', () => {
      render(<AccessDenied title="Access Denied" description="You do not have permission" />);
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      expect(screen.getByText('You do not have permission')).toBeInTheDocument();
    });

    it('should render default message when not provided', () => {
      render(<AccessDenied />);
      expect(screen.getByText(/zugriff verweigert/i)).toBeInTheDocument();
    });
  });
});
