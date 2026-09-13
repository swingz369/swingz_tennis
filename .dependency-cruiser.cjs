/**
 * Architektur-Regeln als Build-Check.
 *
 * Hintergrund: docs/ARCHIV/2026-09-13-architektur-analyse-datenzugriff.md.
 * Zielbild (§ 5.1): Routes/Components greifen nie direkt auf die Datenbank
 * zu, nur über Services/Repositories. src/domain kennt keine Technologie.
 *
 * "error"-Regeln gelten schon heute (0 Verstöße) und brechen den Build.
 * "warn"-Regeln erfassen den heutigen Ist-Zustand als Baseline (Phase 0)
 * und sollen mit jeder migrierten Domäne kleiner werden (Phase 3) — nicht
 * ausklammern, wenn eine Datei neu dazukommt, siehe AGENTS.md § 3a.
 */
module.exports = {
  forbidden: [
    {
      name: 'domain-no-infrastructure',
      severity: 'error',
      comment:
        'src/domain kennt keine Technologie (Clean Architecture, Analyse § 5.1). ' +
        'Aktuell 0 Verstöße — jeder neue ist ein echter Architekturbruch, kein Baseline-Fall.',
      from: { path: '^src/domain' },
      to: { path: '^src/infrastructure' },
    },
    {
      name: 'domain-no-application',
      severity: 'error',
      comment: 'src/domain darf nicht von src/application abhängen (Abhängigkeitsrichtung nach innen).',
      from: { path: '^src/domain' },
      to: { path: '^src/application' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Zirkuläre Importe erschweren jede Migration einer Domäne (Analyse § 6, Phase 3).',
      from: {},
      to: { circular: true },
    },
    {
      name: 'routes-no-direct-db-baseline',
      severity: 'warn',
      comment:
        'Zielbild: Routes/Components/Hooks gehen nie direkt an Drizzle oder den Service-Client, ' +
        'sondern über ein Repository (Analyse § 5.1, § 6 Phase 3). Heute ~85 Routes über Drizzle ' +
        'und 86 über den Service-Client (§ 3.1) — das ist die Baseline, die schrumpfen soll. ' +
        'Neue Treffer beim Anfassen einer Domäne: auf getUserDb()/systemDb() umstellen statt ignorieren.',
      from: { path: '^(app|components|hooks)/' },
      to: {
        path: [
          '^src/infrastructure/persistence/(db|schema|repositories)',
          'drizzle-orm',
          '^lib/supabase/service',
        ],
      },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment:
        'Unbenutzte Module — Kandidaten für knip/Phase 1, aber hier nur informativ. ' +
        'knip.json bleibt die genauere Quelle für toten Code (kennt Next.js-Entry-Konventionen); ' +
        'diese Regel ergänzt nur um Nicht-App-Router-Dateien (z. B. lib/, components/).',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts)$',
          '\\.d\\.ts$',
          '(^|/)tsconfig\\.json$',
          '(^|/)(babel|webpack)\\.config\\.(js|cjs|mjs|ts)$',
          '^(scripts|e2e|tests)/',
          '\\.(test|spec)\\.(ts|tsx)$',
          // Next.js App-Router-Konventionen: von Next.js selbst geladen, nie von Code importiert
          // — dieselbe entry-Liste wie knip.json.
          '(^|/)(page|layout|loading|error|not-found|global-error|icon)\\.tsx$',
          '^app/sitemap\\.ts$',
        ],
      },
      to: {},
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default'] },
    exclude: {
      path: [
        'node_modules',
        '^\\.next',
        '^\\.turbo',
        '^coverage',
        '^supabase/(\\.branches|functions)',
        '^ds-bundle',
        '^\\.ds-sync',
        '^\\.design-sync',
        '^\\.audit-captures',
        '^playwright-report',
        '^midscene_run',
        '^\\.claude',
        '\\.test\\.(ts|tsx)$',
        '\\.spec\\.(ts|tsx)$',
        '^src/__tests__',
      ],
    },
    doNotFollow: { path: 'node_modules' },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
