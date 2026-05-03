import { NextRequest, NextResponse } from 'next/server';
import { SystemSettingsService } from '@/src/application/services/system-settings.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const systemSetting = await SystemSettingsService.getSystemSettingById(params.id);

    if (!systemSetting) {
      return NextResponse.json(
        { error: 'System setting not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ systemSetting });
  } catch (error) {
    console.error('System setting fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const {
      value,
      description,
      isPublic,
      isRequired,
      validation,
    } = body;

    const updated = await SystemSettingsService.updateSystemSetting(params.id, {
      value,
      description,
      isPublic,
      isRequired,
      validation,
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'System setting not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, systemSetting: updated });
  } catch (error) {
    console.error('System setting update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const success = await SystemSettingsService.deleteSystemSetting(params.id);

    if (!success) {
      return NextResponse.json(
        { error: 'System setting not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('System setting delete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
