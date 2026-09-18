'use client';

/**
 * Hero-Slideshow: Browserfenster mit vier Produktansichten (Beispieldaten).
 *
 * Slide 1 ist der echte Dashboard-Screenshot, die übrigen sind gerenderte
 * Platzhalter-Oberflächen im selben Look, bis echte Screenshots vorliegen
 * (dann pro Slide `image` statt `render` setzen). Alle Slides werden auf einer
 * festen 1040×634-Fläche gezeichnet und per Transform auf die Containerbreite
 * skaliert — so bleibt das Layout auf jedem Viewport identisch.
 *
 * Autoplay pausiert bei Hover/Fokus, ausgeblendetem Tab und bei
 * prefers-reduced-motion (dann nur manuelles Blättern).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Image from 'next/image';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Receipt,
  Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const W = 1040;
const H = 634;
const INTERVAL_MS = 5500;

interface Slide {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  alt: string;
  image?: string;
  render?: () => ReactNode;
}

/* ───────────── Mock-Oberflächen (Beispieldaten) ───────────── */

const PANEL = 'flex h-full w-full flex-col bg-[#f1f0ed] text-[#141a17] p-6 font-sans';
const CARD = 'rounded-xl border border-black/10 bg-[#fbfaf8]';

const ROW = 84;

function PlatzKalender() {
  const hours = ['15:00', '16:00', '17:00', '18:00', '19:00'];
  const courts = ['Platz 1', 'Platz 2', 'Platz 3', 'Halle 1'];
  // [Platz, Startzeile, Höhe in Stunden, Titel, Ton]
  const blocks: [number, number, number, string, 'g' | 'b' | 'o'][] = [
    [0, 1, 1.5, 'Kids Anfänger', 'g'],
    [0, 3, 1, 'Mitglied · Meier', 'b'],
    [1, 0, 1, 'Anfänger Gruppe 1', 'g'],
    [1, 2, 2, 'Punktspiel Herren 40', 'o'],
    [2, 1, 1, 'Mitglied · Kraus', 'b'],
    [2, 3, 1.5, 'Fortgeschrittene 1', 'g'],
    [3, 0, 2, 'Turnierspieler', 'g'],
    [3, 3, 1, 'Mitglied · Wolf', 'b'],
  ];
  const tone = {
    g: 'bg-success-50 border-success-200 text-success-700',
    b: 'bg-info-50 border-info-200 text-info-700',
    o: 'bg-warning-50 border-warning-200 text-warning-700',
  };
  return (
    <div className={PANEL}>
      <div className="flex items-end justify-between">
        <div>
          <h3 className="text-[34px] font-extrabold tracking-tight">
            Platzkalender · TC Musterstadt
          </h3>
          <p className="mt-1 text-[17px] text-black/60">
            Heute, Donnerstag · alle Plätze auf einen Blick
          </p>
        </div>
        <div className="flex gap-2 text-[15px] font-semibold">
          <span className="rounded-full bg-[#14532d] px-4 py-1.5 text-white">Tag</span>
          <span className="rounded-full border border-black/15 px-4 py-1.5">Woche</span>
        </div>
      </div>
      <div className={cn(CARD, 'mt-6 grid grid-cols-[76px_repeat(4,1fr)] overflow-hidden')}>
        <div />
        {courts.map((c) => (
          <div key={c} className="border-l border-black/10 px-4 py-3 text-[15px] font-bold">
            {c}
          </div>
        ))}
        {hours.map((h, r) => (
          <div key={h} className="contents">
            <div
              className="border-t border-black/10 px-4 pt-2 text-[14px] text-black/50"
              style={{ height: ROW }}
            >
              {h}
            </div>
            {courts.map((c) => (
              <div
                key={c + h}
                className="relative border-l border-t border-black/10"
                style={{ height: ROW }}
              >
                {blocks
                  .filter(([ci, row]) => courts[ci] === c && row === r)
                  .map(([, , len, title, t]) => (
                    <div
                      key={title}
                      className={cn(
                        'absolute inset-x-1.5 top-1.5 z-10 rounded-md border px-3 py-2 text-[14px] font-semibold leading-tight',
                        tone[t]
                      )}
                      style={{ height: len * ROW - 12 }}
                    >
                      {title}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Saisonplanung() {
  const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
  const rows: [string, string, string, 'g' | 'b' | 'o' | 'p'][][] = [
    [
      ['16:00', 'Kids Anfänger', 'S. Klein', 'g'],
      ['17:30', 'Fortgeschrittene 1', 'M. Weber', 'b'],
      ['19:00', 'Erwachsene Mix', 'J. Fischer', 'o'],
    ],
    [
      ['16:00', 'Anfänger Gruppe 1', 'M. Weber', 'g'],
      ['18:00', 'Turnierspieler', 'J. Fischer', 'p'],
      ['19:30', 'Kids Fortgeschritten', 'S. Klein', 'g'],
    ],
    [
      ['16:30', 'Kids Fortgeschritten', 'S. Klein', 'g'],
      ['18:00', 'Erwachsene Mix', 'J. Fischer', 'o'],
      ['19:30', 'Turnierspieler', 'J. Fischer', 'p'],
    ],
    [
      ['16:00', 'Anfänger Gruppe 1', 'M. Weber', 'g'],
      ['17:30', 'Fortgeschrittene 1', 'M. Weber', 'b'],
      ['19:00', 'Kids Anfänger', 'S. Klein', 'g'],
    ],
    [
      ['15:30', 'Kids Anfänger', 'S. Klein', 'g'],
      ['17:00', 'Turnierspieler', 'J. Fischer', 'p'],
      ['18:30', 'Erwachsene Mix', 'J. Fischer', 'o'],
    ],
  ];
  const tone = {
    g: 'border-l-success-600',
    b: 'border-l-info-600',
    o: 'border-l-warning-600',
    p: 'border-l-brand-primary',
  };
  return (
    <div className={PANEL}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-[34px] font-extrabold tracking-tight">Saisonplanung · Sommer 2026</h3>
          <p className="mt-1 text-[17px] text-black/60">
            Vorschlag aus Trainerkapazität, Gruppenwünschen und Platzbelegung
          </p>
        </div>
        <div className="rounded-full bg-success-50 px-4 py-2 text-[15px] font-bold text-success-700">
          0 Konflikte
        </div>
      </div>
      <div className="mt-5 grid flex-1 grid-cols-5 gap-4">
        {days.map((d, i) => (
          <div key={d} className={cn(CARD, 'p-4')}>
            <div className="text-[15px] font-extrabold uppercase tracking-wider text-black/50">
              {d}
            </div>
            <div className="mt-3 space-y-3">
              {rows[i].map(([time, group, trainer, t]) => (
                <div
                  key={time + group}
                  className={cn(
                    'rounded-md border border-black/10 border-l-4 bg-white px-3 py-3.5',
                    tone[t]
                  )}
                >
                  <div className="text-[13px] font-semibold text-black/50">{time}</div>
                  <div className="text-[16px] font-bold leading-tight">{group}</div>
                  <div className="mt-0.5 text-[13px] text-black/60">{trainer}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className={cn(CARD, 'mt-5 flex items-center justify-between px-6 py-4 text-[16px]')}>
        <span className="text-black/70">
          <strong className="text-black">42 Einheiten</strong> auf 4 Plätze und 2 Hallen verteilt
        </span>
        <span className="rounded-full bg-[#14532d] px-5 py-2 text-[15px] font-bold text-white">
          Veröffentlichen
        </span>
      </div>
    </div>
  );
}

function Abrechnung() {
  const rows: [string, string, string, 'paid' | 'open' | 'due'][] = [
    ['R-2026-0142', 'Familie Meier', '184,00 €', 'paid'],
    ['R-2026-0143', 'Jonas Fischer', '92,00 €', 'paid'],
    ['R-2026-0144', 'Lena Kraus', '92,00 €', 'open'],
    ['R-2026-0145', 'Familie Wolf', '276,00 €', 'due'],
    ['R-2026-0146', 'Tim Hartmann', '92,00 €', 'paid'],
  ];
  const badge = {
    paid: ['Bezahlt', 'bg-success-50 text-success-700'],
    open: ['Offen', 'bg-info-50 text-info-700'],
    due: ['Überfällig', 'bg-error-50 text-error-700'],
  };
  return (
    <div className={PANEL}>
      <h3 className="text-[34px] font-extrabold tracking-tight">Abrechnung · Juni</h3>
      <p className="mt-1 text-[17px] text-black/60">Rechnungen, Lastschriften und Mahnwesen</p>
      <div className="mt-5 grid grid-cols-3 gap-4">
        {[
          ['Offen', '3.420 €'],
          ['Bezahlt', '11.860 €'],
          ['Überfällig', '276 €'],
        ].map(([l, v]) => (
          <div key={l} className={cn(CARD, 'px-6 py-5')}>
            <div className="text-[14px] font-semibold uppercase tracking-wider text-black/50">
              {l}
            </div>
            <div className="mt-1 text-[40px] font-extrabold leading-none">{v}</div>
          </div>
        ))}
      </div>
      <div className={cn(CARD, 'mt-4 flex-1 overflow-hidden')}>
        <div className="grid grid-cols-[1.2fr_1.6fr_1fr_1fr] px-6 py-3 text-[13px] font-bold uppercase tracking-wider text-black/50">
          <span>Nr.</span>
          <span>Empfänger</span>
          <span>Betrag</span>
          <span>Status</span>
        </div>
        {rows.map(([nr, who, sum, st]) => (
          <div
            key={nr}
            className="grid grid-cols-[1.2fr_1.6fr_1fr_1fr] items-center border-t border-black/10 px-6 py-[13px] text-[16px]"
          >
            <span className="text-black/60">{nr}</span>
            <span className="font-semibold">{who}</span>
            <span>{sum}</span>
            <span
              className={cn('w-fit rounded-full px-3 py-1 text-[13px] font-bold', badge[st][1])}
            >
              {badge[st][0]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const SLIDES: Slide[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    image: '/landing/kalender.png',
    alt: 'Admin-Dashboard mit Mitgliederzahlen und den nächsten Trainingseinheiten (Beispieldaten)',
  },
  {
    id: 'kalender',
    label: 'Platzkalender',
    icon: CalendarDays,
    alt: 'Platzkalender mit Belegung aller Plätze und Hallen (Beispieldaten)',
    render: PlatzKalender,
  },
  {
    id: 'saison',
    label: 'Saisonplanung',
    icon: Wand2,
    alt: 'Wochenplan der Saisonplanung mit Trainern und Gruppen (Beispieldaten)',
    render: Saisonplanung,
  },
  {
    id: 'abrechnung',
    label: 'Abrechnung',
    icon: Receipt,
    alt: 'Rechnungsübersicht mit Status und Summen (Beispieldaten)',
    render: Abrechnung,
  },
];

/* ───────────── Karussell ───────────── */

export function HeroShowcase() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [scale, setScale] = useState(0.5);
  const stageRef = useRef<HTMLDivElement>(null);

  const go = useCallback((i: number) => setIndex((i + SLIDES.length) % SLIDES.length), []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (paused || reduced) return;
    const t = setTimeout(() => {
      if (!document.hidden) setIndex((i) => (i + 1) % SLIDES.length);
    }, INTERVAL_MS);
    return () => clearTimeout(t);
  }, [index, paused, reduced]);

  const autoplay = !paused && !reduced;

  return (
    // Die Handler pausieren nur den Autoplay; jede Aktion ist auch per Tabs/Pfeil-Buttons erreichbar.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="group"
      aria-roledescription="Karussell"
      aria-label="Produktansichten von SWINGZ (Beispieldaten)"
      className="group relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(index + 1);
        if (e.key === 'ArrowLeft') go(index - 1);
      }}
    >
      {/* Leuchtfläche hinter dem Fenster */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-brand-light/20 blur-3xl"
      />

      {/* Zweite und dritte Ebene für Tiefe */}
      <div
        aria-hidden="true"
        className="absolute inset-x-6 -bottom-3 h-full rounded-xl border border-white/10 bg-white/5"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-12 -bottom-6 h-full rounded-xl border border-white/5 bg-white/[0.03]"
      />

      <div className="relative overflow-hidden rounded-xl border border-white/15 bg-[#0d1b14] shadow-2xl shadow-black/40 ring-1 ring-black/20">
        {/* Fensterleiste mit Tabs */}
        <div className="flex items-center gap-3 border-b border-white/10 bg-white/5 px-4 py-2.5">
          <div className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
          </div>
          <div
            role="tablist"
            aria-label="Ansicht wählen"
            className="flex min-w-0 flex-1 gap-1 overflow-x-auto"
          >
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                onClick={() => go(i)}
                className={cn(
                  'relative inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light',
                  i === index ? 'bg-white/10 text-white' : 'text-white/55 hover:text-white'
                )}
              >
                <s.icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{s.label}</span>
                {i === index && autoplay && (
                  <span
                    key={index}
                    aria-hidden="true"
                    className="absolute inset-x-2 bottom-0 h-0.5 origin-left rounded-full bg-brand-light"
                    style={{ animation: `hero-progress ${INTERVAL_MS}ms linear forwards` }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Bühne */}
        <div
          ref={stageRef}
          className="relative w-full bg-[#f1f0ed]"
          style={{ aspectRatio: `${W} / ${H}` }}
          aria-live={autoplay ? 'off' : 'polite'}
        >
          {SLIDES.map((s, i) => (
            <div
              key={s.id}
              role="tabpanel"
              aria-label={s.alt}
              aria-hidden={i !== index}
              className={cn(
                'absolute left-0 top-0 origin-top-left transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none',
                i === index ? 'opacity-100' : 'pointer-events-none opacity-0'
              )}
              style={{ width: W, height: H, transform: `scale(${scale})` }}
            >
              {s.image ? (
                <Image
                  src={s.image}
                  alt={s.alt}
                  width={W}
                  height={H}
                  priority={i === 0}
                  sizes="(min-width: 1024px) 55vw, 100vw"
                  className="h-full w-full object-cover"
                />
              ) : (
                s.render?.()
              )}
            </div>
          ))}

          {/* Pfeile */}
          {(
            [
              ['Vorherige Ansicht', -1, 'left-3', ChevronLeft],
              ['Nächste Ansicht', 1, 'right-3', ChevronRight],
            ] as const
          ).map(([label, dir, pos, Icon]) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              onClick={() => go(index + dir)}
              className={cn(
                'absolute top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full',
                'opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100',
                'bg-black/55 text-white backdrop-blur transition hover:bg-black/75',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light',
                pos
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-white/50">
        Beispieldaten · {index + 1} / {SLIDES.length} · {SLIDES[index].label}
      </p>
    </div>
  );
}
