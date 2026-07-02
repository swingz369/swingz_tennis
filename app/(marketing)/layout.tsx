/**
 * Marketing Route Group Layout
 *
 * Wraps all /, /landing, /pricing (etc.) marketing pages with the
 * `.theme-editorial` scope so Cream + Editorial-Serif tokens apply.
 *
 * Critically, this MUST NOT alter any global element (no <html> / <body>
 * className manipulation). The (protected) layouts below it inherit the
 * global :root / .dark tokens untouched.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-editorial min-h-screen bg-background text-foreground">{children}</div>
  );
}
