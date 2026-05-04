import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, rateLimitStrict, checkRateLimitOrFail } from '@/lib/rate-limit';
import { SystemSettingsService } from '@/src/application/services/system-settings.service';

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
      const systemSetting = await SystemSettingsService.getSystemSettingById(id);

      if (!systemSetting) {
        return NextResponse.json({ error: 'System setting not found' }, { status: 404 });
      }

      return NextResponse.json({ systemSetting });
    } catch (error) {
      console.error('System setting fetch error:', error);
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

      const { value, description, isPublic, isRequired, validation } = body;

      const updated = await SystemSettingsService.updateSystemSetting(id, {
        value,
        description,
        isPublic,
        isRequired,
        validation,
      });

      if (!updated) {
        return NextResponse.json({ error: 'System setting not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, systemSetting: updated });
    } catch (error) {
      console.error('System setting update error:', error);
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
      const success = await SystemSettingsService.deleteSystemSetting(id);

      if (!success) {
        return NextResponse.json({ error: 'System setting not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('System setting delete error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
