/**
 * Marketing Route Group Layout
 *
 * Die Landing nutzt dieselben :root / .dark Design-Tokens wie die App —
 * kein eigener Theme-Scope mehr (früher .theme-editorial mit Cream/Serif).
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}
