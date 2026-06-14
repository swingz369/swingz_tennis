# Animation-Komponenten

> Stand: Juni 2026 · Pfad: `components/animations.tsx`

Zwei wiederverwendbare UI-Komponenten für animierte Zahlen-Counter und Scroll-basierte Einfahr-Effekte. Werden in allen Dashboards (Admin, Trainer, Club, Member, Analytics) eingesetzt.

---

## AnimatedCounter

Animiert einen Zahlenwert von `0` zu `value` mittels `requestAnimationFrame` und Ease-Out-Cubic Interpolation. Große Zahlen (≥ 1000) werden automatisch mit `toLocaleString()` formatiert.

### Props

| Prop       | Typ      | Standard     | Beschreibung                            |
| ---------- | -------- | ------------ | --------------------------------------- |
| `value`    | `number` | _(required)_ | Zielwert, zu dem animiert wird          |
| `suffix`   | `string` | `''`         | Angehängtes Zeichen (z.B. `'%'`, `'€'`) |
| `duration` | `number` | `1500`       | Animationsdauer in Millisekunden        |

### Beispiele

**Einfacher Counter:**

```tsx
import { AnimatedCounter } from '@/components/animations';

<AnimatedCounter value={247} />;
// Rendert: "247" (zählt von 0 hoch)
```

**Mit Suffix (Prozent):**

```tsx
<AnimatedCounter value={78} suffix="%" duration={1000} />
// Rendert: "78%" (1 Sekunde Animation)
```

**Währung:**

```tsx
<div className="flex items-baseline gap-1">
  <span>€</span>
  <AnimatedCounter value={totalRevenue} />
</div>
```

**In einer StatCard (empfohlener Weg):**

```tsx
import { StatCard } from '@/components/ui/stat-card';
import { Users } from 'lucide-react';

<StatCard
  icon={Users}
  label="Aktive Mitglieder"
  value={42}
  animate // ← aktiviert AnimatedCounter automatisch
  suffix="%"
  color="brand"
  href="/admin/members"
/>;
```

### Technische Details

- Nutzt `useRef` um doppelte Animationen bei Re-Renders zu verhindern
- Easing: `1 - (1 - progress)³` (Ease-Out-Cubic) für natürliches Abbremsen
- Rendert `<span className="tabular-nums">` für stabile Ziffernbreite

---

## ScrollReveal

Enthüllt Kind-Elemente mit einer Fade-In + Translate-Up Animation, wenn sie in den Viewport scrollen. Nutzt `IntersectionObserver` mit einem Threshold von 10%.

### Props

| Prop        | Typ         | Standard     | Beschreibung                                  |
| ----------- | ----------- | ------------ | --------------------------------------------- |
| `children`  | `ReactNode` | _(required)_ | Inhalt, der animiert werden soll              |
| `className` | `string`    | `''`         | Zusätzliche CSS-Klassen                       |
| `delay`     | `number`    | `0`          | Verzögerung in ms bevor die Animation startet |

### Beispiele

**Einfache Nutzung:**

```tsx
import { ScrollReveal } from '@/components/animations';

<ScrollReveal>
  <div className="p-6 bg-white rounded-xl shadow">
    <h3>Statistik</h3>
    <p>Wird eingeblendet beim Scrollen</p>
  </div>
</ScrollReveal>;
```

**Gestaffelte KPI-Karten:**

```tsx
{
  stats.map((stat, i) => (
    <ScrollReveal key={stat.label} delay={i * 100}>
      <StatCard icon={stat.icon} label={stat.label} value={stat.value} animate color={stat.color} />
    </ScrollReveal>
  ));
}
// Karte 0: sofort, Karte 1: +100ms, Karte 2: +200ms, Karte 3: +300ms
```

**Header + Charts gestaffelt:**

```tsx
<ScrollReveal>
  <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
</ScrollReveal>

<ScrollReveal delay={100}>
  <KPIGrid data={metrics} />
</ScrollReveal>

<ScrollReveal delay={200}>
  <LineChart data={monthlyData} />
</ScrollReveal>
```

**Mit Custom-Klassen:**

```tsx
<ScrollReveal className="col-span-full" delay={300}>
  <RecentActivityList items={activities} />
</ScrollReveal>
```

### Technische Details

- Beobachtet das Element mit `IntersectionObserver` (threshold: `0.1`)
- Animation triggert nur einmal (Observer wird nach Sichtbarkeit disconnected)
- CSS-Klassen: `opacity-0 translate-y-8` → `opacity-100 translate-y-0` über `transition-all duration-700`
- Delay wird via `setTimeout` umgesetzt

---

## Verwendung im Projekt

| Datei                                                      | AnimatedCounter | ScrollReveal |
| ---------------------------------------------------------- | :-------------: | :----------: |
| `components/ui/stat-card.tsx`                              |       ✅        |      —       |
| `admin/dashboard/dashboard-client.tsx`                     |       ✅        |      ✅      |
| `admin/analytics/analytics-client.tsx`                     |       ✅        |      ✅      |
| `admin/clubs/[clubId]/dashboard/club-dashboard-client.tsx` |        —        |      ✅      |
| `components/ai/churn-risk-panel.tsx`                       |       ✅        |      —       |

---

## Import

```tsx
import { AnimatedCounter, ScrollReveal } from '@/components/animations';
```

Beide Komponenten sind als benannte Exports (`named exports`) verfügbar. Die Datei enthält `'use client'` — sie muss in Client-Komponenten oder mit dynamischem Import in Server-Komponenten verwendet werden.

---

## Best Practices

1. **ScrollReveal für Listen**: Nutze `delay={i * 100}` in `.map()`-Loops für gestaffelte Entrance-Animationen
2. **AnimatedCounter + StatCard**: Setze `animate` Prop auf `StatCard` statt manuell `<AnimatedCounter>` zu verwenden
3. **Performance**: ScrollReveal nutzt IntersectionObserver — kein Scroll-Event-Listener, keine Layout-Shifts
4. **Accessibility**: Beide Komponenten sind reine visuelle Effekte. Der endgültige Zahlenwert wird nach der Animation als Text gerendert (kein aria-hidden)
