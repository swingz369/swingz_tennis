import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';

const SYSTEM_SETTINGS_KEYS = [
  'appName',
  'emailNotifications',
  'reminderDaysBefore',
  'stripePublicKey',
] as const;

type SystemSettings = {
  appName: string;
  emailNotifications: boolean;
  reminderDaysBefore: number;
  stripePublicKey: string;
};

function isDemoMode(req: NextRequest): boolean {
  const cookies = req.cookies.get('demo-mode');
  return !!cookies?.value;
}

const DEMO_SYSTEM_SETTINGS: SystemSettings = {
  appName: 'SWINGZ',
  emailNotifications: true,
  reminderDaysBefore: 1,
  stripePublicKey: '',
};

export async function GET(req: NextRequest) {
  try {
    if (isDemoMode(req)) {
      return NextResponse.json(DEMO_SYSTEM_SETTINGS);
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is superadmin
    const { data: memberships } = await supabase
      .from('user_club_memberships')
      .select('role')
      .eq('user_id', user.id);
    const roles = (memberships as Array<{ role: string }> | null)?.map((m) => m.role) || [];
    if (!roles.includes('superadmin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch system settings
    const { data: settings, error } = await supabase.from('system_settings').select('key, value');

    if (error) {
      // If table doesn't exist, return defaults
      return NextResponse.json(DEMO_SYSTEM_SETTINGS);
    }

    // Convert array of {key, value} to object
    const settingsObj = settings.reduce((acc, { key, value }) => {
      // Parse values based on expected type
      if (key === 'emailNotifications') {
        acc[key] = value === 'true';
      } else if (key === 'reminderDaysBefore') {
        acc[key] = parseInt(value, 10) || 1;
      } else {
        acc[key] = value;
      }
      return acc;
    }, {} as SystemSettings);

    // Ensure all keys are present (fill missing with defaults)
    const finalSettings: SystemSettings = {
      appName: settingsObj.appName || DEMO_SYSTEM_SETTINGS.appName,
      emailNotifications: settingsObj.emailNotifications ?? DEMO_SYSTEM_SETTINGS.emailNotifications,
      reminderDaysBefore: settingsObj.reminderDaysBefore ?? DEMO_SYSTEM_SETTINGS.reminderDaysBefore,
      stripePublicKey: settingsObj.stripePublicKey ?? DEMO_SYSTEM_SETTINGS.stripePublicKey,
    };

    return NextResponse.json(finalSettings);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error fetching system settings:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (isDemoMode(req)) {
      // In demo mode, just pretend to save
      await new Promise((resolve) => setTimeout(resolve, 500));
      return NextResponse.json({ success: true, message: 'Saved (demo)' });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is superadmin
    const { data: memberships } = await supabase
      .from('user_club_memberships')
      .select('role')
      .eq('user_id', user.id);
    const roles = (memberships as Array<{ role: string }> | null)?.map((m) => m.role) || [];
    if (!roles.includes('superadmin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const input = await req.json();
    // Validate input keys
    const updates: Array<{ key: string; value: string }> = [];

    for (const key of SYSTEM_SETTINGS_KEYS) {
      if (input[key] !== undefined) {
        let value: string;
        if (typeof input[key] === 'boolean') {
          value = input[key] ? 'true' : 'false';
        } else if (typeof input[key] === 'number') {
          value = String(input[key]);
        } else {
          value = String(input[key]);
        }
        updates.push({ key, value });
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: true, message: 'No changes' });
    }

    // Upsert each setting
    for (const { key, value } of updates) {
      const { error } = await supabase
        .from('system_settings')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: ['key'] });

      if (error) {
        throw error;
      }
    }

    return NextResponse.json({ success: true, message: 'System settings saved' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error saving system settings:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
