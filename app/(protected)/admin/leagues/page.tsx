import LeaguesClient from './leagues-client';

export const metadata = {
  title: 'Liga & Mannschaft — SwingZ',
};

export default function LeaguesPage() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-primary">Liga & Mannschaft</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Mannschaftsaufstellung, Liga-Verwaltung und Spieltag-Planung
        </p>
      </div>
      <LeaguesClient />
    </div>
  );
}
