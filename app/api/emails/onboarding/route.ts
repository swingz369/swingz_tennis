import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email, firstName, clubId } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // In production, this would use Resend to send the actual email
    // For now, we log the onboarding trigger
    console.log(
      `[ONBOARDING] Triggered for ${email} (${firstName || 'N/A'}), club: ${clubId || 'N/A'}`
    );

    // TODO: Integrate with Resend for actual email sending
    // const { data, error } = await resend.emails.send({
    //   from: 'SWINGZ <noreply@swingz.app>',
    //   to: email,
    //   subject: `Willkommen bei SWINGZ${firstName ? `, ${firstName}` : ''}!`,
    //   html: `<h1>Willkommen!</h1><p>Deine Mitgliedschaft wurde genehmigt.</p>`,
    // });

    return NextResponse.json({ success: true, message: 'Onboarding email triggered' });
  } catch (error: any) {
    console.error('Onboarding email error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
