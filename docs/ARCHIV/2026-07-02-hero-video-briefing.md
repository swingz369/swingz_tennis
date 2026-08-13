# 🎬 Hero-Video Asset-Briefing — SwingZ Landing

> Verbindliche Specs für die Production des Hero-Videos auf `app/(marketing)/landing/page.tsx`.
> Bestandteil des **Editorial-Sports / Refined-Elegance**-Redesigns (Phase 2-6, abgeschlossen 2026-07-02).
> Owner: Marketing + Design. Production-Slot: ab sofort.

---

## 1. Konzept-Vision

**Die Erzählung:** Ein einziger, stiller Moment auf dem Tennisplatz — gefilmt wie ein Editorial-Print-Spread, nicht wie ein ESPN-Highlight. Kein Spiel, kein Punkt, kein Jubel. Stattdessen die _ruhige Hand_ aus unserem Hero-Claim: "Die Kunst der ruhigen Hand im Vereinshaus."

**Visuelle Referenz:** Hermès Print-Kampagne × Rolex Testimonee × Gentleman's Journal Cover. Slow-Motion, makellose Textur, viel Negativraum, nie hektisch.

**Was wir NICHT zeigen:**

- Keine breiten Match-Shots, keine Crowd, keine Action
- Kein Sonnenbrand-Lifestyle, keine Lifestyle-Inszenierung
- Keine künstliche Lens-Flare, keine Lens-Distortion
- Kein "Klick-klick" Sound-Design (Video ist stumm, `-an`)

**Marken-Brücke:** Die Video-Tonalität muss zum Cream-Paper-Hintergrund der Landing (`.theme-editorial` in `app/globals.css`) und zur Pally-Serif-Typografie passen. Court Clay `#C25934` ist der einzige warme Akzent — er darf als Court-Linie, Sonnenuntergang oder Tonwert-Note auftauchen, aber nie als dominant.

---

## 2. Shot-Liste (3 Hero-Spots, alle loop-fähig)

Production kann mit **einem** Spot starten, wenn Budget eng ist. Empfehlung: alle drei parallel, weil sie zusammen den Editorial-Bogen ergeben.

### Spot A — "The Pause" (Primär-Empfehlung)

- **Komposition:** Macro, flach, 90° von oben. Ein einzelner Tennisball liegt auf der weißen Grundlinie eines Sandplatzes. Schatten wandert langsam von links nach rechts.
- **Tempo:** 15 s Loop. Bewegung = Schatten + minimale Ball-Rotation. Kein Ball-Bounce.
- **Lichttonung:** Golden Hour, hart aber niedrig stehend. Schatten ist lang (~80% Bildbreite). Court Clay warm beleuchtet.
- **Fokus:** Ball-Fuzz (Textur!) im Vordergrund, Grundlinie soft im Hintergrund. f/2.8, 100mm Macro.
- **Audio:** keines.
- **Länge:** 15 s, davon letzte 0.5 s = erste 0.5 s (seamless).

### Spot B — "The Strings"

- **Komposition:** Schulterperspektive, leicht von oben. Ein Schläger liegt entspannt auf einer Bank / einem Rack. Saiten sind angespannt, Licht zeichnet feine Linien auf die Besaitung.
- **Tempo:** 12 s Loop. Minimaler Fokus-Pull (vorderer Saiten-Node → Griff), sonst statisch.
- **Lichttonung:** Window-Light, kühl, neutral. Court Clay als Out-of-Focus-Hintergrundton.
- **Fokus:** Makro auf Saiten-Kreuzungspunkt, f/2.0, 85mm.
- **Länge:** 12 s, seamless.

### Spot C — "The Walk"

- **Komposition:** Low-Angle-Tracking-Shot (15 cm über dem Boden), Kamera folgt unsichtbar den Schritten einer Person auf dem Platz. Nur Schuh-Unterkanten + Schatten sichtbar, kein Gesicht.
- **Tempo:** 18 s Loop. Steady-Cam, kein Ruckeln, kein Sway.
- **Lichttonung:** Späte Nachmittagssonne, lange Schatten, Cream-Over-Exposure.
- **Fokus:** hyperfokal, f/8, 24mm, Tilt-Shift-Optik-Charakter ohne Tilt-Shift-Effekt (also subtil erhöhte Tiefenschärfe).
- **Länge:** 18 s, seamless.

**Fallback wenn keine Production möglich:** Spot A als "Living Still" — Spot ist fast unbewegt, kann notfalls aus Stock-Composite (Artgrid) zusammengesetzt werden.

---

## 3. Technische Specs

### Encoding-Stack (Multi-Format, prioritätsgeordnet)

| #   | Format | Codec             | Container | Browser-Support                          | Priorität                                          |
| --- | ------ | ----------------- | --------- | ---------------------------------------- | -------------------------------------------------- |
| 1   | WebM   | AV1               | .webm     | Chrome 70+, Firefox 67+, Edge (modern)   | **Primär** — bester Quality/Byte                   |
| 2   | WebM   | VP9               | .webm     | Chrome, Firefox, Edge (alte)             | **Sekundär** — iOS-fallback falls AV1 nicht greift |
| 3   | MP4    | H.264 (High@L4.2) | .mp4      | Universal, alle Browser inkl. iOS Safari | **Mandatory Fallback** — muss gehen                |

> **iOS-Safari-Sonderfall:** Safari unterstützt WebM erst seit iOS 17, eingeschränkt. MP4-H.264 ist die einzige _garantiert_ funktionierende Variante. Quelle: WebKit-Blog 2024, caniuse.com 2026.

### ffmpeg-Encoding-Vorlage (production-ready)

```bash
# 1. AV1 (bestes Quality/Byte)
ffmpeg -i source.mov \
  -c:v libaom-av1 -crf 32 -b:v 0 \
  -cpu-used 4 -row-mt 1 -tiles 2x2 \
  -g 450 -keyint_min 450 -sc_threshold 0 \
  -an -movflags +faststart \
  -vf "scale=1920:1080" \
  hero.webm

# 2. VP9 (Fallback für ältere Webkit-Maschinen)
ffmpeg -i source.mov \
  -c:v libvpx-vp9 -crf 36 -b:v 0 \
  -row-mt 1 -tile-columns 2 -tile-rows 1 \
  -g 450 -keyint_min 450 \
  -an -movflags +faststart \
  -vf "scale=1920:1080" \
  hero.vp9.webm

# 3. H.264 (Universal-Fallback)
ffmpeg -i source.mov \
  -c:v libx264 -crf 28 -preset slow \
  -profile:v high -level 4.2 -movflags +faststart \
  -g 450 -keyint_min 450 -sc_threshold 0 \
  -an \
  -vf "scale=1920:1080" \
  hero.mp4
```

### Resolution + Aspect

| Property                | Wert                                                                | Begründung                                                            |
| ----------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Production-Auflösung    | 4K (3840×2160), 30 fps                                              | Skalierungs-Sicherheit, Downscaling kaschiert Artefakte               |
| Delivery-Auflösung      | 1920×1080                                                           | Hero ist max-viewport-breit, mehr bringt auf 95% der Geräte nichts    |
| Optional: 2.5K Variante | 2560×1440                                                           | Für Retina-Displays (1.5x DPR) — nur falls Encoding-Budget es erlaubt |
| Aspect                  | 16:9                                                                | Standard-Hero-Breite, Crop-Plugin auf Mobile zu 9:16 oder 1:1 möglich |
| Frame-Rate              | 30 fps (Delivery) / 60 fps (Production wenn Slow-Motion)            | Slow-Motion wird in Post auf 30 fps zurückgespielt                    |
| Color-Space             | Rec. 709 (Delivery), Rec. 2020 / DCI-P3 (Production wenn verfügbar) | Web-Standard                                                          |
| Audio                   | **`-an` (kein Track)**                                              | Video ist stumm, vermeidet Mobile-Autoplay-Issues                     |

### Size-Budget

| Datei                  | Ziel                                  | Hard-Cap | Notbremse                      |
| ---------------------- | ------------------------------------- | -------- | ------------------------------ |
| `hero.av1.webm`        | 1.2 MB                                | 1.6 MB   | CRF 36, Auflösung auf 1600×900 |
| `hero.vp9.webm`        | 1.4 MB                                | 1.8 MB   | CRF 40                         |
| `hero.mp4`             | 1.5 MB                                | 1.9 MB   | CRF 32, Auflösung 1600×900     |
| **Gesamt (alle drei)** | **< 2 MB ideal, < 2.5 MB akzeptabel** | 3.0 MB   | Resolution-Down auf 1280×720   |

> **Rechner-Beispiel** (2 MB / 15 s):
> 2 MB × 1024 × 8 / 15 s = **~1090 kbit/s** max. average. AV1 erreicht das bei CRF 30-32 für statisches Editorial-Material.

### GOP / Keyframe-Intervall

**KRITISCH für nahtloses Looping:**

- Keyframe-Intervall = **gesamte Loop-Länge** (in Frames)
- Bei 15 s × 30 fps = **GOP 450, Keyframe nur an Position 0**
- Verhindert Mid-Loop-Flicker bei `<video loop>` Übergang
- ffmpeg-Flags: `-g 450 -keyint_min 450 -sc_threshold 0`

### Looping-Strategie

- **In-File-Loop:** Erste und letzte 0.5 s müssen visuell identisch sein (gleiche Position, gleiche Beleuchtung, gleicher Fokus).
- **HTML-Loop:** `<video autoplay muted loop playsinline preload="metadata">` — `playsinline` ist Pflicht für iOS.
- **Position im DOM:** Direkt im `<SectionReveal as="section">` des Heroes, **hinter** dem Headline-Container, mit `mix-blend-mode: multiply` oder `multiply`-Filter, damit Cream-Paper optisch durchscheint.

---

## 4. Color-Grade (Rec. 709, DaVinci Resolve)

Ziel-Look: Cream-Paper + Court Clay. Warmes Understatement, kein Orange-Overload.

| Param          | Wert                               | Wirkung                                        |
| -------------- | ---------------------------------- | ---------------------------------------------- |
| Lift           | R +0.04, G +0.02, B -0.01          | Warmes Schatten-Ton (Court-Clay-Offset)        |
| Gamma          | R +0.02, G 0, B -0.03              | Hauthöflich, Court Clay in den Mitten          |
| Gain           | R +0.03, G +0.01, B -0.05          | Kühle Highlights, sanftes Cream-Push           |
| Saturation     | -0.10                              | Editorial-Desat, kein Color-Block-Buster-Look  |
| Contrast       | -0.05                              | Flau, print-magazin-haft                       |
| LUT (Referenz) | "Kodak 2383 Print Emulation" @ 60% | Falls als Ausgangs-LUT, danach manuell tweaken |

**Wichtig:** Color-Grade muss **vor** dem finalen Encoding passieren. Niemals in After-Effects mit Cap-LUTs auf AV1 — das verstärkt Block-Artefakte.

---

## 5. Production-Optionen (3 Wege)

### Option 1 — Custom-Shoot mit Cinematographer (Premium)

- **Kosten:** €4.500 – €9.000 (1 Tag Dreh + 1 Tag Post, inkl. Color-Grade)
- **Timeline:** 3 Wochen (Briefing → Pre-Pro → Dreh → Post → Delivery)
- **Qualität:** 10/10 — exakt auf Spot zugeschnitten, exklusive Rechte, DSGVO-clean
- **Wer:** Münchener DP-Studios (z.B. HelliVentures, Filmakademie-Alumni), Tennisklub-Anfrage für Court-Zugang
- **Wann sinnvoll:** Wenn 3 Spots parallel gedreht werden, ROI am höchsten

### Option 2 — Stock-Composite (Artgrid / Getty Editorial)

- **Kosten:** €300 – €600 (3-Clip-License, "Web — Commercial — Worldwide — Perpetual")
- **Timeline:** 1 Woche (Suche + Edit + Color-Grade + Delivery)
- **Qualität:** 7/10 — fast immer Kompromiss, aber für "Living Still" (Spot A) absolut ausreichend
- **Wer:** Selbst; oder Freelance-Editor (€500)
- **Lizenz-Stack:** Artlist Max Subscription (~~€30/Monat) deckt 90% ab; spezielle Court-Shots von Getty Editorial (~~€150/Clip, **aber prüfen: Editorial vs Commercial rights — bei Getty ist Editorial oft restriktiv**)
- **Wann sinnvoll:** MVP-Launch, Budget unter €1.000

### Option 3 — AI-Generated (Sora / Runway Gen-4 / Kling 2)

- **Kosten:** ~$200 (Subscriptions) für ~50 Generations
- **Timeline:** 3-4 Tage (Prompt-Iteration → Selection → Upscale → Color-Grade → Delivery)
- **Qualität:** 6/10 für still-life, 4/10 für jede Bewegung mit Personen — oft "uncanny valley" bei Händen, Schuhen, Schatten
- **Wer:** Selbst mit Sora/Runway
- **Risiko:** Spot C ("The Walk" mit Schritten) ist AI-untauglich. Spot A ("The Pause") und Spot B ("The Strings") funktionieren, brauchen aber 10+ Generationen pro Spot, bis ein Loop-cleanes Ergebnis vorliegt
- **Wann sinnvoll:** Schneller Prototyp, A/B-Test der Video-Conversion, Pre-Launch-Validation

### Empfehlung

**Phase 1 (MVP-Launch):** Option 2 mit Artlist, Spot A
**Phase 2 (Marken-Mode):** Option 1, alle 3 Spots in einem Dreh
**Verwerfen:** Option 3 für finalen Hero — Brand-Risiko zu hoch

---

## 6. Integration in Code

Der Slot existiert bereits konzeptionell. Production-Deliverables landen hier:

```
public/
  media/
    hero/
      hero.av1.webm        # Primär
      hero.vp9.webm        # Sekundär
      hero.mp4             # Universal-Fallback
      hero-poster.jpg      # 1920×1080, ~120 KB, vor autoplay angezeigt
```

`<video>`-Markup (serverseitig in der Landing zu rendern):

```tsx
<video
  autoPlay
  muted
  loop
  playsInline
  preload="metadata"
  poster="/media/hero/hero-poster.jpg"
  className="absolute inset-0 w-full h-full object-cover mix-blend-multiply opacity-90"
  aria-hidden="true"
>
  <source src="/media/hero/hero.av1.webm" type="video/webm; codecs=av01.0.05M.08" />
  <source src="/media/hero/hero.vp9.webm" type="video/webm; codecs=vp9" />
  <source src="/media/hero/hero.mp4" type="video/mp4" />
</video>
```

> **Wichtig:** `mix-blend-multiply` auf Cream-Paper ist es, was den Look "imprintet" — Video-Farben werden mit dem Hintergrund multipliziert, was den warmen Print-Look erzeugt. Ohne Blend wirkt das Video wie ein Fremdkörper.

> **Reduced-Motion-Compliance:** `@media (prefers-reduced-motion: reduce) { video { display: none; } }` — Poster-Image zeigt dann das Standbild.

---

## 7. Acceptance Criteria

Ein Spot gilt als "shipping-ready", wenn ALLE folgenden Punkte erfüllt sind:

- [ ] `hero.av1.webm` ≤ 1.6 MB
- [ ] `hero.mp4` ≤ 1.9 MB
- [ ] Alle drei Targets spielen in Chrome, Firefox, Safari (Desktop + iOS), Edge ohne Fehler
- [ ] First-Frame identisch mit Last-Frame (visuell + Pixel-Diff < 1% im Mittel)
- [ ] Kein Mid-Loop-Flicker beim 60-Sekunden-Dauertest
- [ ] Color-Grade matched: Ball-Fuzz = Cream, Court Clay korrekt tonwertig, keine Magenta- oder Cyan-Cast in Schatten
- [ ] Poster-Image hat korrekte 16:9 Aspect, ≤ 150 KB
- [ ] Reduced-Motion-User sehen kein Video (nur Poster)
- [ ] Lighthouse "Video format" Audit = grün
- [ ] Spot funktioniert in 1× DPR, 1.5× DPR, 2× DPR ohne Crop-Artefakte

---

## 8. Timeline-Empfehlung

| Woche     | Schritt                                           | Owner      |
| --------- | ------------------------------------------------- | ---------- |
| 1 (Jetzt) | Brief an DP oder Artlist-Suche                    | Marketing  |
| 1         | Tennis-Club-Zugang klären (für Option 1)          | Marketing  |
| 2         | Dreh-Date oder Stock-Selection                    | Production |
| 2         | Color-Grade in Resolve                            | Post       |
| 3         | Encoding (ffmpeg-Skript oben)                     | Web-Team   |
| 3         | Integration in `app/(marketing)/landing/page.tsx` | Web-Team   |
| 3         | Lighthouse + Cross-Browser-Test                   | QA         |
| 4         | Live-Schaltung, A/B-Test vs. statischer Hero      | Growth     |

---

## 9. Verwandte Dateien

- `app/(marketing)/landing/page.tsx` — Hero-Section, in die das Video integriert wird
- `app/globals.css` — `.theme-editorial` definiert Cream + Court Clay Token-Werte
- `styles/theme.ts` — Brand-Token-Definitionen
- `app/(marketing)/landing/_components/section-reveal.tsx` — IntersectionObserver-Mechanik
- `CONTRIBUTING.md` — Rule 9 (Maintainer-Identity) + Rule 10 (Handbuch-Pflege)

---

> **Maintainer-Hinweis:** Bei Asset-Updates muss (1) `hero-poster.jpg` mit-aktualisiert werden, (2) `mix-blend-multiply` bleibt — ist Teil des Look, nicht des Videos, (3) Reduced-Motion-Branch in globals.css beibehalten.
