import { BrandMark, Wordmark } from '@/components/ui/brand-logo';
import PublicTrialBooking from '@/components/public-trial-booking';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

import { createLogger } from '@/lib/logger';

const log = createLogger('trial-training:page');

export const metadata: Metadata = {
  title: 'Probetraining buchen | SWINGZ',
  description: 'Buche jetzt ein kostenloses Probetraining bei deinem Tennisclub über SWINGZ.',
  alternates: {
    canonical: '/trial-training',
  },
};
import { ClubService } from '@/application/services/club.service';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function fetchClubInfo(
  clubId: string
): Promise<{ name: string; logoUrl: string | null } | null> {
  try {
    return await ClubService.findPublic(clubId);
  } catch (error) {
    log.error('Failed to fetch club info for trial booking page:', error);
    return null;
  }
}

export default async function PublicTrialBookingPage({ searchParams }: PageProps) {
  // Next.js 16: searchParams ist ein Promise — ohne await blieb `club` immer undefined.
  const clubParam = (await searchParams).club;
  const clubId =
    typeof clubParam === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clubParam)
      ? clubParam
      : undefined;

  const clubInfo = clubId ? await fetchClubInfo(clubId) : null;

  return (
    <div className="min-h-dvh bg-background">
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
                className="rounded-full object-cover border-2 border-border"
              />
              <span className="text-xl font-bold text-foreground">{clubInfo.name}</span>
            </div>
          ) : (
            <Link href="/" className="inline-flex items-center gap-2 mb-4">
              <BrandMark className="h-8 w-8" />
              <Wordmark className="text-2xl" />
            </Link>
          )}
          {clubInfo && !clubInfo.logoUrl && (
            <p className="text-lg font-semibold text-foreground mb-4">{clubInfo.name}</p>
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
