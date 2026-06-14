import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';

const BrandingUpdateSchema = z.object({
  brand: z
    .object({
      primaryColor: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/, 'Hex color required')
        .optional(),
      secondaryColor: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/, 'Hex color required')
        .optional(),
      accentColor: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/, 'Hex color required')
        .optional(),
    })
    .optional(),
  logos: z
    .object({
      light: z.string().url().optional().nullable(),
      dark: z.string().url().optional().nullable(),
      favicon: z.string().url().optional().nullable(),
    })
    .optional(),
  customDomain: z.string().url().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clubId = searchParams.get('clubId');

  if (!clubId) {
    return NextResponse.json({ error: 'clubId required' }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('clubs')
      .select(
        'primary_color, secondary_color, accent_color, logo_light_url, logo_dark_url, favicon_url, custom_domain'
      )
      .eq('id', clubId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 });
    }

    return NextResponse.json({
      clubId,
      brand: {
        primaryColor: data.primary_color || '#1B4332',
        secondaryColor: data.secondary_color || '#1e3a5f',
        accentColor: data.accent_color || '#FF6B35',
      },
      logos: {
        light: data.logo_light_url || null,
        dark: data.logo_dark_url || null,
        favicon: data.favicon_url || null,
      },
      customDomain: data.custom_domain || null,
    });
  } catch (err) {
    console.error('GET /api/branding error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const clubId = request.headers.get('x-club-id') || request.headers.get('x-tenant-id');
      if (!clubId) {
        return NextResponse.json({ error: 'Club ID header missing' }, { status: 400 });
      }
      const body = await request.json();
      const validated = BrandingUpdateSchema.parse(body);

      // Build update object from validated fields
      const updates: Record<string, string | null> = {};
      if (validated.brand?.primaryColor) updates.primary_color = validated.brand.primaryColor;
      if (validated.brand?.secondaryColor) updates.secondary_color = validated.brand.secondaryColor;
      if (validated.brand?.accentColor) updates.accent_color = validated.brand.accentColor;
      if (validated.logos?.light !== undefined) updates.logo_light_url = validated.logos.light;
      if (validated.logos?.dark !== undefined) updates.logo_dark_url = validated.logos.dark;
      if (validated.logos?.favicon !== undefined) updates.favicon_url = validated.logos.favicon;
      if (validated.customDomain !== undefined) updates.custom_domain = validated.customDomain;

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
      }

      updates.updated_at = new Date().toISOString();

      const supabase = createServiceClient();
      const { error } = await supabase.from('clubs').update(updates).eq('id', clubId);

      if (error) {
        console.error('Branding update error:', error);
        return NextResponse.json({ error: 'Failed to update branding' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Branding updated',
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Validation failed' },
        { status: 400 }
      );
    }
  });
}
