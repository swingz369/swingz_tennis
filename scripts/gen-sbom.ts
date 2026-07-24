/**
 * gen-sbom.ts — Erzeugt eine CycloneDX 1.5 SBOM aus pnpm list --json
 *
 * Usage:
 *   # Nur direkte Abhängigkeiten (schnell, für Übersicht):
 *   pnpm list --json --depth=0 --prod | npx tsx scripts/gen-sbom.ts
 *
 *   # Vollständig mit transitiven Abhängigkeiten (für Compliance):
 *   pnpm list --json --depth=Infinity --prod | npx tsx scripts/gen-sbom.ts
 *
 * Output: CycloneDX 1.5 JSON auf stdout
 */

import { randomUUID } from 'crypto';

interface PnpmDep {
  from: string;
  version: string;
  resolved?: string;
  path: string;
  dependencies?: Record<string, PnpmDep>;
}

interface PnpmRoot {
  name: string;
  version: string;
  path: string;
  private: boolean;
  dependencies: Record<string, PnpmDep>;
}

interface CycloneDxComponent {
  type: 'library';
  'bom-ref': string;
  name: string;
  version: string;
  purl: string;
  licenses?: { license?: { name?: string } }[];
}

async function main() {
  // Read pnpm list JSON from stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf-8');
  const data: [PnpmRoot] = JSON.parse(raw);
  const root = data[0];

  // Build CycloneDX components from direct dependencies
  const components: CycloneDxComponent[] = [];
  const deps: { ref: string; dependsOn: string[] }[] = [];

  const rootRef = `pkg:npm/${root.name}@${root.version}`;

  const directDeps: string[] = [];

  function walkDeps(depMap: Record<string, PnpmDep>, parentRefs: string[]) {
    for (const [name, dep] of Object.entries(depMap)) {
      const version = dep.version;
      const bomRef = `pkg:npm/${name}@${version}`;

      if (!seen.has(bomRef)) {
        seen.add(bomRef);
        components.push({
          type: 'library',
          'bom-ref': bomRef,
          name,
          version,
          purl: bomRef,
        });
      }

      parentRefs.push(bomRef);

      // Recurse into transitive dependencies
      if (dep.dependencies) {
        const childRefs: string[] = [];
        walkDeps(dep.dependencies, childRefs);
        if (childRefs.length > 0) {
          deps.push({ ref: bomRef, dependsOn: childRefs });
        }
      }
    }
  }

  const seen = new Set<string>();
  walkDeps(root.dependencies, directDeps);

  deps.push({
    ref: rootRef,
    dependsOn: directDeps,
  });

  const bom = {
    $schema: 'http://cyclonedx.org/schema/bom-1.5.schema.json',
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [
        {
          vendor: 'SwingZ',
          name: 'gen-sbom',
          version: '1.0.0',
        },
      ],
      component: {
        type: 'application',
        'bom-ref': rootRef,
        name: root.name,
        version: root.version,
        purl: rootRef,
      },
    },
    components,
    dependencies: deps,
  };

  process.stdout.write(JSON.stringify(bom, null, 2) + '\n');
}

main().catch((err) => {
  console.error('Failed to generate SBOM:', err);
  process.exit(1);
});
