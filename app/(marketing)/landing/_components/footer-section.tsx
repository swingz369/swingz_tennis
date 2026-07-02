/**
 * Editorial Footer — Editorial Sports (Phase 2-6)
 *
 * 4-column link grid (Produkt / Unternehmen / Rechtliches) plus a SWINGZ
 * brand column on the left, all atop a hairline-bordered cream paper.
 * Bottom strip: copyright line + Munich-region mono metadata.
 *
 * Server Component. No `'use client'`. Extracted from page.tsx so the
 * App Router can stream/code-split it independently of the hero/bento
 * above the fold.
 */

import Link from 'next/link';

export function FooterSection() {
  return (
    <footer className="bg-background hairline-t">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex items-baseline gap-2">
              <span className="font-editorial text-2xl text-foreground tracking-tight">SWINGZ</span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                est. 2026
              </span>
            </Link>
            <p className="mt-3 font-editorial italic text-sm text-muted-foreground">
              Die Kunst der ruhigen Hand.
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
              Produkt
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="#section-features"
                  className="link-mask text-foreground/70 hover:text-foreground transition-colors"
                >
                  Funktionen
                </Link>
              </li>
              <li>
                <Link
                  href="#section-pricing"
                  className="link-mask text-foreground/70 hover:text-foreground transition-colors"
                >
                  Preise
                </Link>
              </li>
              <li>
                <Link
                  href="/register"
                  className="link-mask text-foreground/70 hover:text-foreground transition-colors"
                >
                  Probetraining
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
              Unternehmen
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/about"
                  className="link-mask text-foreground/70 hover:text-foreground transition-colors"
                >
                  Über uns
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="link-mask text-foreground/70 hover:text-foreground transition-colors"
                >
                  Kontakt
                </Link>
              </li>
              <li>
                <Link
                  href="/impressum"
                  className="link-mask text-foreground/70 hover:text-foreground transition-colors"
                >
                  Impressum
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
              Rechtliches
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/datenschutz"
                  className="link-mask text-foreground/70 hover:text-foreground transition-colors"
                >
                  Datenschutz
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="link-mask text-foreground/70 hover:text-foreground transition-colors"
                >
                  AGB
                </Link>
              </li>
              <li>
                <Link
                  href="/avv"
                  className="link-mask text-foreground/70 hover:text-foreground transition-colors"
                >
                  AVV
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="pt-6 hairline-t flex flex-col md:flex-row items-start md:items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <p>© 2026 SWINGZ GmbH · Alle Rechte vorbehalten</p>
          <p>Munich · DE · EU-Hosted</p>
        </div>
      </div>
    </footer>
  );
}
