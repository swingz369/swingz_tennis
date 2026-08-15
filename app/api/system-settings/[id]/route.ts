import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { systemSettingsService } from '@/src/application/services/system-settings-service.adapter';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:system-settings:[id]');

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const systemSetting = await systemSettingsService.getSystemSettingById(id);

      if (!systemSetting) {
        return NextResponse.json({ error: 'Systemeinstellung nicht gefunden' }, { status: 404 });
      }

      return NextResponse.json({ systemSetting });
    } catch (error) {
      log.error('System setting fetch error:', error);
      return internalErrorResponse();
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
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const body = await _request.json();

      const { value, description, isPublic, isRequired, validation } = body;

      const updated = await systemSettingsService.updateSystemSetting(id, {
        value,
        description,
        isPublic,
        isRequired,
        validation,
      });

      if (!updated) {
        return NextResponse.json({ error: 'Systemeinstellung nicht gefunden' }, { status: 404 });
      }

      return NextResponse.json({ success: true, systemSetting: updated });
    } catch (error) {
      log.error('System setting update error:', error);
      return internalErrorResponse();
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
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const success = await systemSettingsService.deleteSystemSetting(id);

      if (!success) {
        return NextResponse.json({ error: 'Systemeinstellung nicht gefunden' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      log.error('System setting delete error:', error);
      return internalErrorResponse();
    }
  });
}
