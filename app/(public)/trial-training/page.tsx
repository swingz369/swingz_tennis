import PublicTrialBooking from '@/components/public-trial-booking';
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles } from 'lucide-react';
import { eq } from 'drizzle-orm';
import { db } from '@/infrastructure/persistence/db';
import { clubs } from '@/infrastructure/persistence/schema';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

async function fetchClubInfo(
  clubId: string
): Promise<{ name: string; logoUrl: string | null } | null> {
  try {
    const result = await db
      .select({ name: clubs.name, logoUrl: clubs.logo_url })
      .from(clubs)
      .where(eq(clubs.id, clubId))
      .limit(1);

    if (result.length === 0) return null;
    return { name: result[0].name, logoUrl: result[0].logoUrl ?? null };
  } catch (error) {
    console.error('Failed to fetch club info for trial booking page:', error);
    return null;
  }
}

export default async function PublicTrialBookingPage({ searchParams }: PageProps) {
  const clubParam = searchParams.club;
  const clubId =
    typeof clubParam === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clubParam)
      ? clubParam
      : undefined;

  const clubInfo = clubId ? await fetchClubInfo(clubId) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-primary/5 to-brand-light/5 dark:bg-card">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          {clubInfo?.logoUrl ? (
            <div className="flex items-center justify-center gap-3 mb-4">
              <Image
                src={clubInfo.logoUrl}
                alt={clubInfo.name}
                width={48}
                height={48}
                className="rounded-full object-cover border-2 border-brand-light/20"
              />
              <span className="text-xl font-bold text-brand-primary dark:text-white">
                {clubInfo.name}
              </span>
            </div>
          ) : (
            <Link href="/" className="inline-flex items-center gap-2 mb-4">
              <Sparkles className="h-8 w-8 text-brand-light" />
              <span className="text-xl font-bold text-brand-primary dark:text-white">SWINGZ</span>
            </Link>
          )}
          {clubInfo && !clubInfo.logoUrl && (
            <p className="text-lg font-semibold text-brand-primary dark:text-white mb-4">
              {clubInfo.name}
            </p>
          )}
        </div>

        {/* Booking Form */}
        <PublicTrialBooking
          clubId={clubId}
          clubName={clubInfo?.name}
          clubLogo={clubInfo?.logoUrl ?? undefined}
        />

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Deine Daten werden vertraulich behandelt.{' '}
          <Link href="/datenschutz" className="underline hover:text-brand-primary">
            Datenschutzerklärung
          </Link>
        </p>
      </div>
    </div>
  );
}
