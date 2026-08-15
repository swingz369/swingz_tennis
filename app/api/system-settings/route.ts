import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { systemSettingsService } from '@/src/application/services/system-settings-service.adapter';
import type { SystemSettings } from '@/src/domain/entities/system-settings.entity';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:system-settings');

export async function POST(_request: NextRequest) {
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
      const body = await _request.json();

      const {
        category,
        key,
        value,
        type,
        description,
        isPublic,
        isRequired,
        validation,
        clubId: bodyClubId,
      } = body;

      if (!category || !key || !value || !type) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      // Only superadmins can override club context via body
      const effectiveClubId = auth.role === 'superadmin' ? bodyClubId || null : auth.clubId;

      const systemSetting = await systemSettingsService.createSystemSetting(
        {
          category,
          key,
          value,
          type,
          description,
          isPublic,
          isRequired,
          validation,
        },
        effectiveClubId
      );

      return NextResponse.json({ success: true, systemSetting });
    } catch (error) {
      log.error('System setting creation error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

export async function GET(_request: NextRequest) {
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
      const { searchParams } = new URL(_request.url);
      const requestedClubId = searchParams.get('clubId');
      const category = searchParams.get('category');
      const key = searchParams.get('key');
      const isPublic = searchParams.get('public');
      const object = searchParams.get('object');

      // Only superadmins can override club context via query param
      const effectiveClubId = auth.role === 'superadmin' ? requestedClubId || null : auth.clubId;

      if (object) {
        const settings = await systemSettingsService.getSystemSettingsAsObject(
          category as SystemSettings['category'],
          effectiveClubId
        );
        return NextResponse.json({ settings });
      }

      if (key) {
        const systemSetting = await systemSettingsService.getSystemSettingByKey(
          key,
          effectiveClubId
        );
        if (!systemSetting) {
          return NextResponse.json({ error: 'System setting not found' }, { status: 404 });
        }
        return NextResponse.json({ systemSetting });
      }

      if (isPublic) {
        const systemSettings = await systemSettingsService.getPublicSystemSettings(effectiveClubId);
        return NextResponse.json({ systemSettings });
      }

      if (
        category &&
        (category === 'general' ||
          category === 'email' ||
          category === 'security' ||
          category === 'notifications' ||
          category === 'integrations' ||
          category === 'other')
      ) {
        const systemSettings = await systemSettingsService.getSystemSettingsByCategory(
          category,
          effectiveClubId
        );
        return NextResponse.json({ systemSettings });
      }

      const systemSettings = await systemSettingsService.getAllSystemSettings(effectiveClubId);
      return NextResponse.json({ systemSettings });
    } catch (error) {
      log.error('System settings fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
