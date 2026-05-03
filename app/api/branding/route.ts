import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

const BrandingSchema = z.object({
  clubId: z.string().uuid(),
  brand: z.object({
    primaryColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Hex color required')
      .default('#1B4332'),
    secondaryColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Hex color required')
      .default('#1e3a5f'),
    accentColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Hex color required')
      .default('#FF6B35'),
  }),
  logos: z.object({
    light: z.string().url().optional().nullable(),
    dark: z.string().url().optional().nullable(),
    favicon: z.string().url().optional().nullable(),
  }),
  customDomain: z.string().url().optional().nullable(),
});

export async function GET(___request: NextRequest) {
  const { searchParams } = new URL(__request.url);
  const clubId = searchParams.get('clubId');

  if (!clubId) {
    return NextResponse.json({ error: 'clubId required' }, { status: 400 });
  }

  // Mock response - in real app fetch from database
  return NextResponse.json({
    clubId,
    brand: {
      primaryColor: '#1B4332',
      secondaryColor: '#1e3a5f',
      accentColor: '#FF6B35',
    },
    logos: { light: null, dark: null, favicon: null },
    customDomain: null,
  });
}

export async function PUT(___request: NextRequest) {
  try {
    const clubId = __request.headers.get('x-club-id') || __request.headers.get('x-tenant-id');
    if (!clubId) {
      return NextResponse.json({ error: 'Club ID header missing' }, { status: 400 });
    }
    const body = await __request.json();
    const validated = BrandingSchema.parse({ clubId, ...body });

    // In real implementation: save to database
    // await db.insert(brandingTable).values(validated);

    return NextResponse.json({
      success: true,
      message: 'Branding updated',
      data: validated,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Validation failed' },
      { status: 400 }
    );
  }
}
