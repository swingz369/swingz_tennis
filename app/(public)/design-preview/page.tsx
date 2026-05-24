'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

// ── Token Data ──

const brandColors = [
  { name: 'Brand Primary', var: '--brand-primary', light: '#1B4332', dark: '#2D6A4F' },
  { name: 'Brand Light', var: '--brand-primary-light', light: '#40916C', dark: '#52B788' },
  { name: 'Brand Secondary', var: '--brand-secondary', light: '#1e3a5f', dark: '#3e5c76' },
  { name: 'Brand Accent', var: '--brand-accent', light: '#FF6B35', dark: '#FF8C5A' },
  { name: 'Surface', var: '--surface', light: '#FFFFFF', dark: '#0d1a12' },
  { name: 'Surface Elevated', var: '--surface-elevated', light: '#FCFCFD', dark: '#1a2e22' },
  { name: 'Border Subtle', var: '--border-subtle', light: '#e8ece9', dark: '#263b2e' },
  { name: 'Text Primary', var: '--text-primary', light: '#141a17', dark: '#FAFAF9' },
  { name: 'Text Secondary', var: '--text-secondary', light: '#6b726e', dark: '#949a96' },
];

const typographySizes = [
  { name: 'Hero XL', class: 'text-hero-xl', text: 'The Quick Brown Fox' },
  { name: 'Hero LG', class: 'text-hero-lg', text: 'The Quick Brown Fox' },
  { name: 'Hero MD', class: 'text-hero-md', text: 'The Quick Brown Fox' },
  { name: 'Display 1', class: 'text-display-1', text: 'The Quick Brown Fox' },
  { name: 'Display 2', class: 'text-display-2', text: 'The Quick Brown Fox' },
  { name: 'Display 3', class: 'text-display-3', text: 'The Quick Brown Fox' },
  { name: 'Display 4', class: 'text-display-4', text: 'The Quick Brown Fox' },
  { name: 'Body XL', class: 'text-xl', text: 'Premium Tennis Club Management für anspruchsvolle Vereine.' },
  { name: 'Body LG', class: 'text-lg', text: 'Premium Tennis Club Management für anspruchsvolle Vereine.' },
  { name: 'Body', class: 'text-base', text: 'Premium Tennis Club Management für anspruchsvolle Vereine.' },
  { name: 'Body SM', class: 'text-sm', text: 'Premium Tennis Club Management für anspruchsvolle Vereine.' },
  { name: 'Caption', class: 'text-xs', text: 'Premium Tennis Club Management' },
  { name: 'Overline', class: 'text-[10px] uppercase tracking-[0.15em]', text: 'PREMIUM TENNIS CLUB' },
];

const shadows = [
  { name: 'Soft Shadow', class: 'shadow-soft' },
  { name: 'Medium Shadow', class: 'shadow-medium' },
  { name: 'Strong Shadow', class: 'shadow-strong' },
  { name: 'Glass Shadow', class: 'shadow-glass' },
  { name: 'Elegant Shadow', class: 'shadow-elegant' },
  { name: 'Premium Shadow', class: 'shadow-premium' },
  { name: 'Glow Green', class: 'shadow-glow-green-sm' },
  { name: 'Glow Orange', class: 'shadow-glow-orange-sm' },
];

const radii = [
  { name: 'None', class: 'rounded-none', size: '0' },
  { name: 'SM', class: 'rounded-sm', size: '6px' },
  { name: 'MD', class: 'rounded-md', size: '8px' },
  { name: 'LG', class: 'rounded-lg', size: '12px' },
  { name: 'XL', class: 'rounded-xl', size: '16px' },
  { name: '2XL', class: 'rounded-2xl', size: '24px' },
  { name: '3XL', class: 'rounded-3xl', size: '32px' },
  { name: '4XL', class: 'rounded-4xl', size: '48px' },
  { name: 'Full', class: 'rounded-full', size: '9999px' },
];

const animations = [
  { name: 'Float', class: 'animate-float' },
  { name: 'Float Slow', class: 'animate-float-slow' },
  { name: 'Pulse Glow', class: 'animate-pulse-glow' },
  { name: 'Shimmer', class: 'animate-shimmer' },
  { name: 'Fade In', class: 'animate-fade-in' },
  { name: 'Scale In', class: 'animate-scale-in' },
  { name: 'Slide In Right', class: 'animate-slide-in-right' },
  { name: 'Gradient Shift', class: 'animate-gradient' },
];

const spacingScale = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24];

const hoverEffects = [
  { name: 'Hover Lift', class: 'hover-lift' },
  { name: 'Hover Glow', class: 'hover-glow' },
  { name: 'Tap Scale', class: 'tap-scale' },
];

// ── Components ──

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold font-display text-gray-900 dark:text-white">{title}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <div className="border border-gray-100 dark:border-white/[0.06] rounded-2xl bg-white dark:bg-surface-dark/50 p-6">
        {children}
      </div>
    </section>
  );
}

function ColorSwatch({ color }: { color: typeof brandColors[0] }) {
  return (
    <div className="space-y-2">
      <div
        className="h-24 w-full rounded-xl border border-gray-200/60 dark:border-white/[0.08]"
        style={{ backgroundColor: `hsl(var(${color.var}))` }}
      />
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-gray-800 dark:text-white">{color.name}</p>
        <p className="text-xs font-mono text-gray-400 dark:text-gray-500">
          <span className="inline-block w-24">var{color.var}</span>
        </p>
      </div>
    </div>
  );
}

// ── Page ──

export default function DesignPreviewPage() {
  const [activeTab, setActiveTab] = useState('colors');

  const tabs = [
    { id: 'colors', label: 'Farben' },
    { id: 'typography', label: 'Typografie' },
    { id: 'shadows', label: 'Schatten' },
    { id: 'glass', label: 'Glass' },
    { id: 'radius', label: 'Radius' },
    { id: 'animations', label: 'Animationen' },
    { id: 'spacing', label: 'Abstände' },
    { id: 'interactive', label: 'Interaktion' },
  ];

  const [animKey, setAnimKey] = useState(0);

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-[#0a120e]">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0A3D2E] via-[#1B4332] to-[#2D6A4F]">
        <div className="absolute inset-0 bg-grid opacity-[0.04]" />
        <div className="relative mx-auto max-w-7xl px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 mb-8">                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
            <span className="text-xs font-medium text-white/70">SwingZ Design System v1.0</span>
          </div>
          <h1 className="text-hero-md sm:text-hero-lg font-bold font-display text-white tracking-tight mb-4">
            Design Token<br />
            <span className="text-gradient-accent">Preview</span>
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Vollständige Übersicht aller Design-Tokens, Komponenten-States und UI-Patterns
            des SwingZ Premium Tennis Club Management Systems.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 text-sm text-white/40">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              9 Brand Colors
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              13 Type Scales
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              8 Shadow Layers
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              8 Animations
            </span>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-64 h-64 bg-brand-accent/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-brand-primary-light/10 rounded-full blur-3xl" />
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="sticky top-0 z-10 border-b border-gray-200/60 dark:border-white/[0.06] bg-white/80 dark:bg-[#0a120e]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex gap-1 overflow-x-auto py-3 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap',
                  activeTab === tab.id
                    ? 'bg-brand-light/10 text-brand-light dark:text-green-300'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="mx-auto max-w-7xl px-6 py-12 space-y-16">

        {/* ── COLORS ── */}
        {activeTab === 'colors' && (
          <Section title="Brand Colors" description="Primäre Farbskala des SwingZ-Design-Systems. Alle Werte als HSL-CSS-Variablen definiert.">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {brandColors.map((color) => (
                <ColorSwatch key={color.name} color={color} />
              ))}
            </div>

            <div className="mt-8 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Opacity Variants</h3>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {(['bg-brand-primary/5', 'bg-brand-primary/10', 'bg-brand-primary/20', 'bg-brand-light/5', 'bg-brand-light/10', 'bg-brand-light/20'] as const).map((cls) => (
                  <div key={cls} className="space-y-1.5">
                    <div className={cn('h-10 rounded-lg border border-gray-200/40 dark:border-white/[0.06]', cls)} />
                    <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500 truncate">{cls}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Text & Background Utilities</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(['text-brand-primary', 'text-brand-light', 'text-brand-accent', 'text-gradient-primary', 'text-gradient-accent', 'text-gradient-warm'] as const).map((cls) => (
                  <div key={cls} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-white/[0.03]">
                    <span className={cn('text-sm font-semibold', cls)}>SwingZ</span>
                    <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">{cls}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        )}

        {/* ── TYPOGRAPHY ── */}
        {activeTab === 'typography' && (
          <Section title="Typografie" description="Clash Display für Überschriften, DM Sans für Fließtext. Hierarchy von Hero XL bis Overline.">
            <div className="space-y-6">
              {typographySizes.map((t) => (
                <div key={t.name} className="flex items-baseline gap-4 border-b border-gray-100 dark:border-white/[0.04] pb-4 last:border-0">
                  <span className={cn('flex-1 font-display', t.class)}>{t.text}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-mono shrink-0">{t.name}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Font Family</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/[0.03]">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Display</p>
                  <p className="text-lg font-display text-gray-800 dark:text-white">Clash Display</p>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/[0.03]">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Sans</p>
                  <p className="text-lg font-sans text-gray-800 dark:text-white">DM Sans</p>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/[0.03]">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Mono</p>
                  <p className="text-lg font-mono text-gray-800 dark:text-white">JetBrains Mono</p>
                </div>
              </div>
            </div>
          </Section>
        )}

        {/* ── SHADOWS ── */}
        {activeTab === 'shadows' && (
          <Section title="Schatten" description="Vier Hierarchiestufen (soft → premium) plus Akzent-Glow-Varianten für Buttons und Cards.">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {shadows.map((s) => (
                <div key={s.name} className={cn('h-28 rounded-xl bg-white dark:bg-surface-dark border border-gray-200/40 dark:border-white/[0.06] flex items-center justify-center', s.class)}>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{s.name}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Card Shadows</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(['shadow-card-default', 'shadow-card-hover', 'shadow-card-elevated'] as const).map((s) => (
                  <div key={s} className={cn('h-24 rounded-xl bg-white dark:bg-surface-dark border border-gray-200/40 dark:border-white/[0.06] flex items-center justify-center', s)}>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 capitalize">{s.replace('shadow-card-', '')}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        )}

        {/* ── GLASS ── */}
        {activeTab === 'glass' && (
          <Section title="Glass Morphism" description="Zwei Varianten: .glass (leicht) und .glass-strong (verstärkt). Beide passen sich via CSS-Variablen an Light/Dark-Mode an.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">                    <div className="relative overflow-hidden rounded-2xl h-48 bg-gradient-to-br from-brand-primary to-emerald-950">
                <div className="absolute inset-0 bg-grid opacity-[0.08]" />
                <div className="absolute inset-4 glass rounded-xl flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">.glass</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      background: surface / 0.8<br />
                      backdrop-filter: blur(24px)
                    </p>
                  </div>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-2xl h-48 bg-gradient-to-br from-brand-accent/80 to-brand-primary/80">
                <div className="absolute inset-0 bg-grid opacity-[0.08]" />
                <div className="absolute inset-4 glass-strong rounded-xl flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">.glass-strong</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      background: surface / 0.9<br />
                      backdrop-filter: blur(40px)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 p-6 glass rounded-2xl">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Glass-Varianten werden in Sidebar, Bottom-Nav, Modals und Cards eingesetzt.
                Durch die <code className="text-xs bg-brand-light/10 px-1.5 py-0.5 rounded text-brand-light">backdrop-filter</code> entsteht ein
                moderner, tiefenwirkender UI-Look.
              </p>
            </div>
          </Section>
        )}

        {/* ── RADIUS ── */}
        {activeTab === 'radius' && (
          <Section title="Border Radius" description="Einheitliche Radius-Skala von none (0) bis full (9999px). Verwendet in Cards, Buttons, Inputs und Modals.">
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-4">
              {radii.map((r) => (
                <div key={r.name} className="space-y-2">
                  <div className={cn('h-20 bg-gradient-to-br from-brand-light to-brand-primary', r.class)} />
                  <div className="text-center">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{r.name}</p>
                    <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500">{r.size}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Usage Examples</h3>
              <div className="flex flex-wrap gap-3">
                {[{ label: 'Button', cls: 'rounded-lg' }, { label: 'Card', cls: 'rounded-xl' }, { label: 'Modal', cls: 'rounded-2xl' }, { label: 'Badge', cls: 'rounded-full' }].map((ex) => (
                  <div key={ex.label} className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-white/[0.03] rounded-lg border border-gray-200/40 dark:border-white/[0.06]">
                    <span className="text-sm text-gray-600 dark:text-gray-300">{ex.label}</span>
                    <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{ex.cls}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        )}

        {/* ── ANIMATIONS ── */}
        {activeTab === 'animations' && (
          <Section title="Animationen" description="Acht Keyframe-Animationen mit dazugehörigen CSS-Klassen. Respektieren prefers-reduced-motion.">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {animations.map((anim) => (
                <div key={anim.name} className="group relative overflow-hidden rounded-xl border border-gray-200/40 dark:border-white/[0.06] bg-white dark:bg-surface-dark p-6 text-center">
                  <div key={animKey} className={cn('w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-brand-light to-brand-primary flex items-center justify-center shadow-lg mb-3', anim.class)}>
                    <span className="text-white text-lg">✦</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{anim.name}</p>
                  <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500 mt-1">{anim.class}</p>
                  <button
                    onClick={() => setAnimKey((k) => k + 1)}
                    className="mt-3 text-[10px] text-brand-light hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Neu abspielen
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-8 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-500/20">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                ℹ️ <code className="text-xs">@media (prefers-reduced-motion: reduce)</code> deaktiviert alle Animationen
                für Barrierefreiheit.
              </p>
            </div>
          </Section>
        )}

        {/* ── SPACING ── */}
        {activeTab === 'spacing' && (
          <Section title="Abstände" description="4px/8px/16px/24px/32px-Raster für konsistente Layouts. Basis aller Spacing-Entscheidungen.">
            <div className="space-y-3">
              {spacingScale.map((unit) => (
                <div key={unit} className="flex items-center gap-4">
                  <span className="w-16 text-xs font-mono text-gray-400 dark:text-gray-500 shrink-0">
                    {unit === 0 ? '0' : unit < 1 ? `p-${unit}`.replace('.', '-') : `p-${unit}`}
                  </span>
                  <div className="flex-1 flex items-center">
                    <div
                      className="h-6 bg-gradient-to-r from-brand-light to-brand-primary rounded"
                      style={{ width: `${unit * 4}px`, maxWidth: '100%' }}
                    />
                    {unit > 0 && (
                      <span className="ml-2 text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                        {unit * 4}px
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 p-6 glass rounded-2xl">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Spacing in der Praxis</h3>
              <div className="flex gap-2">
                {[1, 2, 4, 6, 8].map((g) => (
                  <div key={g} className="flex flex-col items-center gap-1">
                    <div className="flex gap-1">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="w-6 h-6 rounded bg-brand-light/20 dark:bg-brand-light/10" />
                      ))}
                    </div>
                    <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">gap-{g}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        )}

        {/* ── INTERACTIVE ── */}
        {activeTab === 'interactive' && (
          <Section title="Interaktive Zustände" description="Hover-, Focus-, Active- und Glow-Effekte für Buttons, Cards und Navigationselemente.">
            <div className="space-y-8">
              {/* Hover Effects */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Hover Effects</h3>
                <div className="flex flex-wrap gap-4">
                  {hoverEffects.map((h) => (
                    <div key={h.name} className={cn('px-6 py-4 rounded-xl bg-white dark:bg-surface-dark border border-gray-200/40 dark:border-white/[0.06] cursor-pointer transition-all duration-200', h.class)}>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{h.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Button States */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Button States</h3>
                <div className="flex flex-wrap gap-3">
                  <button className="px-5 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-dark transition-colors focus-visible:ring-2 focus-visible:ring-brand-light focus-visible:ring-offset-2">
                    Button Default
                  </button>
                  <button className="px-5 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-dark transition-colors focus-visible:ring-2 focus-visible:ring-brand-light focus-visible:ring-offset-2 shadow-glow-green-sm">
                    Button Glow
                  </button>
                  <button className="px-5 py-2.5 rounded-lg border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors focus-visible:ring-2 focus-visible:ring-brand-light focus-visible:ring-offset-2">
                    Button Outline
                  </button>
                  <button disabled className="px-5 py-2.5 rounded-lg bg-gray-200 dark:bg-white/[0.06] text-gray-400 dark:text-gray-500 text-sm font-medium cursor-not-allowed">
                    Button Disabled
                  </button>
                </div>
              </div>

              {/* Focus States */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Focus Ring (Tab durchklicken)</h3>
                <div className="flex flex-wrap gap-3">
                  {['Link', 'Button', 'Input', 'Select'].map((el) => (
                    <div key={el} className="px-5 py-3 rounded-xl bg-white dark:bg-surface-dark border border-gray-200/40 dark:border-white/[0.06]">
                      <span className="text-sm text-gray-600 dark:text-gray-300" tabIndex={0}>{el}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gradient Buttons */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Gradient Border</h3>
                <div className="gradient-border p-6 max-w-md">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Cards mit gradient-border erhalten einen sanften Farbverlauf-Rahmen.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-500/20">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                ✅ Alle interaktiven Elemente haben <code className="text-xs">focus-visible</code>-Ring für Tastatur-Navigation
                (WCAG 2.2 AA).
              </p>
            </div>
          </Section>
        )}

      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-200/60 dark:border-white/[0.06] py-8">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            SwingZ Design System · Version 1.0 · Generiert aus globals.css + theme.ts
          </p>
          <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">
            Clash Display via Fontshare · DM Sans via Google Fonts
          </p>
        </div>
      </footer>
    </div>
  );
}
