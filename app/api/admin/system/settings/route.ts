import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

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

const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  appName: 'SWINGZ',
  emailNotifications: true,
  reminderDaysBefore: 1,
  stripePublicKey: '',
};

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Rate limiting
    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    // Permission check
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) return forbiddenResponse('Admin access required');

    try {
      const supabase = await createClient();

      // Fetch system settings
      const { data: settings, error } = await supabase.from('system_settings').select('key, value');

      if (error) {
        return NextResponse.json(DEFAULT_SYSTEM_SETTINGS);
      }

      // Convert array of {key, value} to object
      const settingsObj: Partial<SystemSettings> = {};
      for (const { key, value } of settings) {
        if (key === 'emailNotifications') {
          settingsObj.emailNotifications = value === 'true';
        } else if (key === 'reminderDaysBefore') {
          settingsObj.reminderDaysBefore = parseInt(value, 10) || 1;
        } else if (key === 'appName') {
          settingsObj.appName = value;
        } else if (key === 'stripePublicKey') {
          settingsObj.stripePublicKey = value;
        }
      }

      // Ensure all keys are present
      const finalSettings: SystemSettings = {
        appName: settingsObj.appName || DEFAULT_SYSTEM_SETTINGS.appName,
        emailNotifications:
          settingsObj.emailNotifications ?? DEFAULT_SYSTEM_SETTINGS.emailNotifications,
        reminderDaysBefore:
          settingsObj.reminderDaysBefore ?? DEFAULT_SYSTEM_SETTINGS.reminderDaysBefore,
        stripePublicKey: settingsObj.stripePublicKey ?? DEFAULT_SYSTEM_SETTINGS.stripePublicKey,
      };

      return NextResponse.json(finalSettings);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      console.error('Error fetching system settings:', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

export async function PUT(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Rate limiting (strict for PUT)
    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) return rateLimitError;

    // Permission check
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) return forbiddenResponse('Admin access required');

    try {
      const supabase = await createClient();
      const input = await _request.json();

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
          .upsert({ key, value, updated_at: new Date().toISOString() } as any, {
            onConflict: 'key',
          });

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
  });
}
