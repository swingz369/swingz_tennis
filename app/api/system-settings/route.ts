import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, rateLimitStrict, checkRateLimitOrFail } from '@/lib/rate-limit';
import { SystemSettingsService } from '@/src/application/services/system-settings.service';
import { SystemSettings } from '@/src/domain/entities/system-settings.entity';

export async function POST(_request: NextRequest) {
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
      const body = await _request.json();

      const { category, key, value, type, description, isPublic, isRequired, validation } = body;

      if (!category || !key || !value || !type) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const systemSetting = await SystemSettingsService.createSystemSetting({
        category,
        key,
        value,
        type,
        description,
        isPublic,
        isRequired,
        validation,
      });

      return NextResponse.json({ success: true, systemSetting });
    } catch (error) {
      console.error('System setting creation error:', error);
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
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, rateLimit);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { searchParams } = new URL(_request.url);
      const category = searchParams.get('category');
      const key = searchParams.get('key');
      const isPublic = searchParams.get('public');
      const object = searchParams.get('object');

      if (object) {
        const settings = await SystemSettingsService.getSystemSettingsAsObject(
          category as SystemSettings['category']
        );
        return NextResponse.json({ settings });
      }

      if (key) {
        const systemSetting = await SystemSettingsService.getSystemSettingByKey(key);
        if (!systemSetting) {
          return NextResponse.json({ error: 'System setting not found' }, { status: 404 });
        }
        return NextResponse.json({ systemSetting });
      }

      if (isPublic) {
        const systemSettings = await SystemSettingsService.getPublicSystemSettings();
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
        const systemSettings = await SystemSettingsService.getSystemSettingsByCategory(category);
        return NextResponse.json({ systemSettings });
      }

      const systemSettings = await SystemSettingsService.getAllSystemSettings();
      return NextResponse.json({ systemSettings });
    } catch (error) {
      console.error('System settings fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
