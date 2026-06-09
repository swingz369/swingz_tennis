/**
 * Accessibility Utilities
 *
 * Helper functions for improving accessibility across the application
 */

/**
 * Generate unique IDs for ARIA attributes
 */
export function generateAriaId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Announce message to screen readers
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  if (typeof window === 'undefined') return;

  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Get keyboard navigation props
 */
export function getKeyboardProps(onClick: () => void) {
  return {
    onClick,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    },
    role: 'button',
    tabIndex: 0,
  };
}

/**
 * Focus management utilities
 */
export const focusManager = {
  /**
   * Focus first focusable element in container
   */
  focusFirst(container: HTMLElement): void {
    const focusable = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) {
      focusable[0].focus();
    }
  },

  /**
   * Trap focus within container
   */
  trapFocus(container: HTMLElement): () => void {
    const focusable = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusable.length === 0) return () => {};

    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  },

  /**
   * Save and restore focus
   */
  saveFocus(): () => void {
    const previouslyFocused = document.activeElement as HTMLElement;

    return () => {
      if (previouslyFocused && previouslyFocused.focus) {
        previouslyFocused.focus();
      }
    };
  },
};

/**
 * Skip to content link (for screen readers and keyboard navigation)
 */
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-foreground focus:rounded-lg focus:shadow-lg"
    >
      Skip to main content
    </a>
  );
}

/**
 * Visually hidden but accessible to screen readers
 */
export function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
