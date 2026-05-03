import { NextRequest, NextResponse } from 'next/server';
import { SystemSettingsService } from '@/src/application/services/system-settings.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      category,
      key,
      value,
      type,
      description,
      isPublic,
      isRequired,
      validation,
    } = body;

    if (!category || !key || !value || !type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create system setting
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
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const key = searchParams.get('key');
    const public = searchParams.get('public');
    const object = searchParams.get('object');

    if (object) {
      const settings = await SystemSettingsService.getSystemSettingsAsObject(
        category as any
      );
      return NextResponse.json({ settings });
    }

    if (key) {
      const systemSetting = await SystemSettingsService.getSystemSettingByKey(key);
      if (!systemSetting) {
        return NextResponse.json(
          { error: 'System setting not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ systemSetting });
    }

    if (public) {
      const systemSettings = await SystemSettingsService.getPublicSystemSettings();
      return NextResponse.json({ systemSettings });
    }

    if (category) {
      const systemSettings = await SystemSettingsService.getSystemSettingsByCategory(category as any);
      return NextResponse.json({ systemSettings });
    }

    // Get all system settings
    const systemSettings = await SystemSettingsService.getAllSystemSettings();
    return NextResponse.json({ systemSettings });
  } catch (error) {
    console.error('System settings fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
