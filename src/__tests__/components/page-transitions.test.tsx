import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React, { useRef } from 'react';
import { useExitAnimation } from '@/hooks/use-exit-animation';
import { PageTransition } from '@/components/animations';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
let mockPathname = '/admin';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));

// ─── Test Wrapper for useExitAnimation ────────────────────────────────────────

function ExitAnimationTestWrapper({
  children,
  options,
}: {
  children?: React.ReactNode;
  options?: Parameters<typeof useExitAnimation>[1];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useExitAnimation(containerRef, options);
  return (
    <div ref={containerRef} data-testid="container">
      {children}
    </div>
  );
}

// ─── useExitAnimation Hook ───────────────────────────────────────────────────

describe('useExitAnimation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockPathname = '/admin';
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  // ── Internal link interception ────────────────────────────────────────────

  describe('Internal link interception', () => {
    it('intercepts clicks on internal links and adds exit class', () => {
      render(
        <ExitAnimationTestWrapper>
          <a href="/admin/members">Members</a>
        </ExitAnimationTestWrapper>
      );

      const link = screen.getByText('Members');
      fireEvent.click(link);

      const container = screen.getByTestId('container');
      expect(container).toHaveClass('page-transition-exit');
      expect(container).not.toHaveClass('page-transition-enter');
    });

    it('calls router.push after the exit animation duration', () => {
      render(
        <ExitAnimationTestWrapper options={{ duration: 200 }}>
          <a href="/admin/members">Members</a>
        </ExitAnimationTestWrapper>
      );

      fireEvent.click(screen.getByText('Members'));

      expect(mockPush).not.toHaveBeenCalled();
      vi.advanceTimersByTime(200);
      expect(mockPush).toHaveBeenCalledWith('/admin/members');
    });

    it('uses custom duration from options', () => {
      render(
        <ExitAnimationTestWrapper options={{ duration: 500 }}>
          <a href="/admin/members">Members</a>
        </ExitAnimationTestWrapper>
      );

      fireEvent.click(screen.getByText('Members'));

      vi.advanceTimersByTime(400);
      expect(mockPush).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(mockPush).toHaveBeenCalledWith('/admin/members');
    });

    it('uses custom CSS class names from options', () => {
      render(
        <ExitAnimationTestWrapper
          options={{ exitClass: 'custom-exit', entryClass: 'custom-enter' }}
        >
          <a href="/admin/members">Members</a>
        </ExitAnimationTestWrapper>
      );

      // Add the entry class manually to test removal
      const container = screen.getByTestId('container');
      container.classList.add('custom-enter');

      fireEvent.click(screen.getByText('Members'));

      expect(container).toHaveClass('custom-exit');
      expect(container).not.toHaveClass('custom-enter');
    });
  });

  // ── Skipped link types ────────────────────────────────────────────────────

  describe('Skipped link types', () => {
    it('does not intercept external links (http)', () => {
      render(
        <ExitAnimationTestWrapper>
          <a href="https://example.com">External</a>
        </ExitAnimationTestWrapper>
      );

      fireEvent.click(screen.getByText('External'));
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('does not intercept external links (http://)', () => {
      render(
        <ExitAnimationTestWrapper>
          <a href="http://example.com">External HTTP</a>
        </ExitAnimationTestWrapper>
      );

      fireEvent.click(screen.getByText('External HTTP'));
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('does not intercept mailto links', () => {
      render(
        <ExitAnimationTestWrapper>
          <a href="mailto:test@example.com">Email</a>
        </ExitAnimationTestWrapper>
      );

      fireEvent.click(screen.getByText('Email'));
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('does not intercept tel links', () => {
      render(
        <ExitAnimationTestWrapper>
          <a href="tel:+49123456789">Phone</a>
        </ExitAnimationTestWrapper>
      );

      fireEvent.click(screen.getByText('Phone'));
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('does not intercept hash links', () => {
      render(
        <ExitAnimationTestWrapper>
          <a href="#section">Section</a>
        </ExitAnimationTestWrapper>
      );

      fireEvent.click(screen.getByText('Section'));
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('does not intercept links to the same pathname', () => {
      mockPathname = '/admin/settings';
      render(
        <ExitAnimationTestWrapper>
          <a href="/admin/settings">Same Page</a>
        </ExitAnimationTestWrapper>
      );

      fireEvent.click(screen.getByText('Same Page'));
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('does not intercept links with empty href', () => {
      render(
        <ExitAnimationTestWrapper>
          <a href="">Empty</a>
        </ExitAnimationTestWrapper>
      );

      fireEvent.click(screen.getByText('Empty'));
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  // ── Modifier keys ────────────────────────────────────────────────────────

  describe('Modifier keys', () => {
    it('does not intercept clicks with Ctrl key', () => {
      render(
        <ExitAnimationTestWrapper>
          <a href="/admin/members">Members</a>
        </ExitAnimationTestWrapper>
      );

      fireEvent.click(screen.getByText('Members'), { ctrlKey: true });
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('does not intercept clicks with Meta key', () => {
      render(
        <ExitAnimationTestWrapper>
          <a href="/admin/members">Members</a>
        </ExitAnimationTestWrapper>
      );

      fireEvent.click(screen.getByText('Members'), { metaKey: true });
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('does not intercept clicks with Shift key', () => {
      render(
        <ExitAnimationTestWrapper>
          <a href="/admin/members">Members</a>
        </ExitAnimationTestWrapper>
      );

      fireEvent.click(screen.getByText('Members'), { shiftKey: true });
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('does not intercept clicks with Alt key', () => {
      render(
        <ExitAnimationTestWrapper>
          <a href="/admin/members">Members</a>
        </ExitAnimationTestWrapper>
      );

      fireEvent.click(screen.getByText('Members'), { altKey: true });
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('does not intercept middle-clicks (button !== 0)', () => {
      render(
        <ExitAnimationTestWrapper>
          <a href="/admin/members">Members</a>
        </ExitAnimationTestWrapper>
      );

      fireEvent.click(screen.getByText('Members'), { button: 1 });
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  // ── Double-trigger prevention ─────────────────────────────────────────────

  describe('Double-trigger prevention', () => {
    it('does not trigger exit animation twice during an exit', () => {
      render(
        <ExitAnimationTestWrapper options={{ duration: 200 }}>
          <a href="/admin/members">Members</a>
          <a href="/admin/trainers">Trainers</a>
        </ExitAnimationTestWrapper>
      );

      fireEvent.click(screen.getByText('Members'));
      fireEvent.click(screen.getByText('Trainers'));

      vi.advanceTimersByTime(200);

      // Only the first click should trigger router.push
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/admin/members');
    });
  });

  // ── isExitingRef reset ────────────────────────────────────────────────────

  describe('isExitingRef reset', () => {
    it('resets isExitingRef when pathname changes', async () => {
      const { rerender } = render(
        <ExitAnimationTestWrapper options={{ duration: 200 }}>
          <a href="/admin/members">Members</a>
        </ExitAnimationTestWrapper>
      );

      fireEvent.click(screen.getByText('Members'));
      vi.advanceTimersByTime(200);

      // Simulate pathname change (navigation complete)
      mockPathname = '/admin/members';
      rerender(
        <ExitAnimationTestWrapper options={{ duration: 200 }}>
          <a href="/admin">Back</a>
        </ExitAnimationTestWrapper>
      );

      // After pathname change, should be able to click again
      fireEvent.click(screen.getByText('Back'));
      vi.advanceTimersByTime(200);

      expect(mockPush).toHaveBeenCalledTimes(2);
      expect(mockPush).toHaveBeenCalledWith('/admin');
    });
  });

  // ── Non-link clicks ──────────────────────────────────────────────────────

  describe('Non-link clicks', () => {
    it('does not intercept clicks on non-anchor elements', () => {
      render(
        <ExitAnimationTestWrapper>
          <button>Not a link</button>
        </ExitAnimationTestWrapper>
      );

      fireEvent.click(screen.getByText('Not a link'));
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('does not intercept clicks on elements without an href', () => {
      render(
        <ExitAnimationTestWrapper>
          <a>No href</a>
        </ExitAnimationTestWrapper>
      );

      fireEvent.click(screen.getByText('No href'));
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  // ── Return value ─────────────────────────────────────────────────────────

  describe('Return value', () => {
    it('returns isExitingRef', () => {
      let hookResult: ReturnType<typeof useExitAnimation> | undefined;

      function TestComponent() {
        const containerRef = useRef<HTMLDivElement>(null);
        hookResult = useExitAnimation(containerRef); // eslint-disable-line react-hooks/globals -- test pattern: capturing hook result from inside component
        return <div ref={containerRef} />;
      }

      render(<TestComponent />);
      expect(hookResult).toBeDefined();
      expect(hookResult!.isExitingRef).toBeDefined();
      expect(hookResult!.isExitingRef.current).toBe(false);
    });
  });
});

// ─── PageTransition Component ────────────────────────────────────────────────

describe('PageTransition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/admin';
  });

  afterEach(() => {
    cleanup();
  });

  // ── Rendering ────────────────────────────────────────────────────────────

  describe('Rendering', () => {
    it('renders children with page-transition-enter class', () => {
      render(
        <PageTransition>
          <p>Test content</p>
        </PageTransition>
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
      const wrapper = screen.getByText('Test content').parentElement;
      expect(wrapper).toHaveClass('page-transition-enter');
    });

    it('applies custom className', () => {
      render(
        <PageTransition className="custom-class">
          <p>Content</p>
        </PageTransition>
      );

      const wrapper = screen.getByText('Content').parentElement;
      expect(wrapper).toHaveClass('page-transition-enter');
      expect(wrapper).toHaveClass('custom-class');
    });

    it('renders multiple children', () => {
      render(
        <PageTransition>
          <h1>Title</h1>
          <p>Paragraph</p>
        </PageTransition>
      );

      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Paragraph')).toBeInTheDocument();
    });
  });

  // ── Entry animation ──────────────────────────────────────────────────────

  describe('Entry animation', () => {
    it('does not restart animation on initial mount (isFirstRender)', () => {
      render(
        <PageTransition>
          <p>Content</p>
        </PageTransition>
      );

      const wrapper = screen.getByText('Content').parentElement!;
      // Should have the initial class but animation restart should not have been triggered
      expect(wrapper).toHaveClass('page-transition-enter');
    });

    it('restarts animation class on pathname change', () => {
      const { rerender } = render(
        <PageTransition>
          <p>Content</p>
        </PageTransition>
      );

      // Change pathname to trigger entry animation restart
      mockPathname = '/admin/members';
      rerender(
        <PageTransition>
          <p>Content</p>
        </PageTransition>
      );

      const wrapper = screen.getByText('Content').parentElement!;
      // After pathname change, the entry class should be re-applied
      expect(wrapper).toHaveClass('page-transition-enter');
    });
  });

  // ── Exit animation integration ───────────────────────────────────────────

  describe('Exit animation integration', () => {
    it('applies exit class when clicking an internal link', () => {
      render(
        <PageTransition>
          <a href="/admin/members">Members</a>
        </PageTransition>
      );

      const wrapper = screen.getByText('Members').parentElement!;
      expect(wrapper).toHaveClass('page-transition-enter');

      fireEvent.click(screen.getByText('Members'));

      expect(wrapper).toHaveClass('page-transition-exit');
      expect(wrapper).not.toHaveClass('page-transition-enter');
    });

    it('does not trigger exit for external links', () => {
      render(
        <PageTransition>
          <a href="https://example.com">External</a>
        </PageTransition>
      );

      const wrapper = screen.getByText('External').parentElement!;
      fireEvent.click(screen.getByText('External'));

      // Should still have entry class (no exit triggered)
      expect(wrapper).toHaveClass('page-transition-enter');
      expect(wrapper).not.toHaveClass('page-transition-exit');
    });
  });
});
