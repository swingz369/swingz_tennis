import { createServiceClient } from '@/lib/supabase/service';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createServiceClient();

async function setSiteUrl() {
  const newSiteUrl = 'https://swingz-fxdvirllf-bartmz-3856s-projects.vercel.app';
  const redirectUrls = [`${newSiteUrl}/*`];

  try {
    // First, get current config
    const { data: currentConfig, error: getError } = await supabase
      .from('auth.config')
      .select('*')
      .single();

    if (getError && getError.code !== 'PGRST116') {
      console.error('Error fetching current config:', getError);
    } else {
      console.log('Current config:', currentConfig);
    }
  } catch (_e) {
    console.log('Could not fetch current config (may not exist yet)');
  }

  // Try to update via RPC or direct table update
  try {
    const { error } = await supabase.from('auth.config').upsert(
      {
        key: 'site_url',
        value: newSiteUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    if (error) {
      console.error('Error updating site_url via table:', error);
    } else {
      console.log('✅ site_url updated successfully');
    }
  } catch (_e) {
    console.error('Failed to update site_url:', _e);
  }

  // Update redirect_urls similarly
  try {
    const { error } = await supabase.from('auth.config').upsert(
      {
        key: 'redirect_urls',
        value: redirectUrls,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    if (error) {
      console.error('Error updating redirect_urls via table:', error);
    } else {
      console.log('✅ redirect_urls updated successfully');
    }
  } catch (_e) {
    console.error('Failed to update redirect_urls:', _e);
  }
}

setSiteUrl();
