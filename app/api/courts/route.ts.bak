import { NextRequest, NextResponse } from 'next/server';
import { DrizzleCourtRepository } from '@/infrastructure/persistence/repositories/court.repository';
import { ClubId } from '@/domain/value-objects';
import { cookies } from 'next/headers';

const courtRepo = new DrizzleCourtRepository();

// Helper: Check for demo mode cookie
async function isDemoMode(): Promise<boolean> {
  const cookieStore = await cookies();
  const hasDemoMode = cookieStore.get('demo-mode');
  return !!hasDemoMode?.value;
}

// Mock courts for demo mode
const DEMO_COURTS = [
  {
    id: 'demo-court-1',
    name: 'Platz 1',
    surface: 'clay' as const,
    hasIndoor: false,
    isActive: true,
    clubId: 'demo-club',
  },
  {
    id: 'demo-court-2',
    name: 'Platz 2',
    surface: 'hard' as const,
    hasIndoor: true,
    isActive: true,
    clubId: 'demo-club',
  },
  {
    id: 'demo-court-3',
    name: 'Platz 3',
    surface: 'clay' as const,
    hasIndoor: false,
    isActive: true,
    clubId: 'demo-club',
  },
];

// GET /api/courts?clubId=xxx – Courts für einen Club
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const clubIdParam = url.searchParams.get('clubId');

  // Validate clubId is present
  if (!clubIdParam) {
    return NextResponse.json({ error: 'clubId required' }, { status: 400 });
  }

  // Demo mode: return mock courts
  if (await isDemoMode()) {
    return NextResponse.json(DEMO_COURTS);
  }

  // Optional: validate clubId format (UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(clubIdParam)) {
    return NextResponse.json({ error: 'Invalid club ID format' }, { status: 400 });
  }

  try {
    const clubId = ClubId.fromString(clubIdParam);
    const courts = await courtRepo.findByClub(clubId);

    const courtsList = courts.map((c) => ({
      id: c.id,
      name: c.name,
      surface: c.surface,
      hasIndoor: c.hasIndoor,
      isActive: c.isActive,
      clubId: clubId.getValue(),
    }));

    return NextResponse.json(courtsList);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching courts:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}