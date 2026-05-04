import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, rateLimitStrict, checkRateLimitOrFail } from '@/lib/rate-limit';
import { HourlyRateService } from '@/src/application/services/hourly-rate.service';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, rateLimit);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const rateTier = await HourlyRateService.getHourlyRateTierById(id);

      if (!rateTier) {
        return NextResponse.json({ error: 'Hourly rate tier not found' }, { status: 404 });
      }

      return NextResponse.json({ rateTier });
    } catch (error) {
      console.error('Hourly rate tier fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, rateLimitStrict);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const body = await _request.json();

      const { name, description, baseRate, trainingTypes, experienceLevel, isActive } = body;

      const updated = await HourlyRateService.updateHourlyRateTier(id, {
        name,
        description,
        baseRate,
        trainingTypes,
        experienceLevel,
        isActive,
      });

      if (!updated) {
        return NextResponse.json({ error: 'Hourly rate tier not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, rateTier: updated });
    } catch (error) {
      console.error('Hourly rate tier update error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, rateLimitStrict);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const success = await HourlyRateService.deleteHourlyRateTier(id);

      if (!success) {
        return NextResponse.json({ error: 'Hourly rate tier not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Hourly rate tier delete error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
