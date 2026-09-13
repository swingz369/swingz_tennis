/**
 * Vorkonfiguriertes ts-morph-Projekt für Codemods.
 *
 * Zweck: docs/ARCHIV/2026-09-13-architektur-analyse-datenzugriff.md § 6/§ 7 —
 * mechanische Massenänderungen mit Typverständnis (Imports umhängen, tote
 * Exporte entfernen, Service+Adapter zusammenlegen), statt Suchen/Ersetzen
 * über hunderte Dateien von Hand.
 *
 * Kein eigenständiges Skript — ein einzelner Codemod importiert `getProject()`
 * und schreibt seine Transformation dort hinein. Beispiel:
 *
 * ```ts
 * import { getProject, saveIfChanged } from './codemod-project';
 *
 * const project = getProject();
 * for (const sf of project.getSourceFiles('src/application/services/*.ts')) {
 *   // z. B. Imports von '@/infrastructure/persistence/db' ersetzen
 * }
 * await saveIfChanged(project);
 * ```
 *
 * Immer erst mit `--dry-run` (kein `save()`) gegen ein bis zwei Dateien
 * prüfen, dann `npx tsc --noEmit` und die betroffenen Tests laufen lassen —
 * ts-morph schreibt syntaktisch gültigen, nicht automatisch korrekten Code.
 */
import { Project } from 'ts-morph';

export function getProject(): Project {
  return new Project({
    tsConfigFilePath: 'tsconfig.json',
    skipAddingFilesFromTsConfig: true,
  });
}

/** Speichert nur Dateien, die der Codemod tatsächlich verändert hat. */
export async function saveIfChanged(project: Project): Promise<void> {
  const changed = project.getSourceFiles().filter((sf) => sf.isSaved() === false);
  if (changed.length === 0) {
    console.log('Keine Änderungen.');
    return;
  }
  console.log(`${changed.length} Datei(en) geändert:`);
  for (const sf of changed) console.log(`  ${sf.getFilePath()}`);
  await project.save();
}
