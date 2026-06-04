export const emailConfig = {
  // Email service configuration
  service: {
    provider: 'resend',
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM || 'SwingZ <noreply@swingz.app>',
    replyTo: process.env.EMAIL_REPLY_TO,
  },

  // Club information for emails
  club: {
    name: process.env.CLUB_NAME || 'SwingZ Tennis Club',
    address: process.env.CLUB_ADDRESS || '',
    phone: process.env.CLUB_PHONE || '',
    email: process.env.CLUB_EMAIL || 'info@swingz.app',
    website: process.env.NEXT_PUBLIC_APP_URL || 'https://swingz.app',
  },

  // Email templates configuration
  templates: {
    // Onboarding emails
    welcome: {
      enabled: true,
      subject: 'Willkommen bei {clubName}!',
      includeTemporaryPassword: true,
      includeWelcomeGuide: true,
      welcomeGuideUrl: 'https://swingz.app/welcome',
    },

    trial: {
      enabled: true,
      subject: 'Dein Probetraining bei {clubName}',
      includeLocationDetails: true,
    },

    approval: {
      enabled: true,
      subject: 'Deine Mitgliedschaft bei {clubName} wurde genehmigt',
      includeGroupAssignment: true,
      includeStartDate: true,
    },

    rejection: {
      enabled: true,
      subject: 'Deine Bewerbung bei {clubName}',
      includeReason: true,
      includeNextSteps: true,
    },

    // Booking emails
    bookingConfirmation: {
      enabled: true,
      subject: 'Training bestätigt – {sessionStart}',
      includeTrainerInfo: true,
      includeCourtInfo: true,
    },

    bookingCancellation: {
      enabled: true,
      subject: 'Buchung storniert',
      includeReason: true,
      includeNotes: true,
    },

    bookingStatusChanged: {
      enabled: true,
      subject: 'Buchungsstatus geändert: {status}',
      includeSessionDetails: true,
    },

    bookingReminder: {
      enabled: true,
      subject: 'Erinnerung: Training morgen um {sessionStart}',
      includeTrainerInfo: true,
      includeCourtInfo: true,
    },

    // Member management emails
    memberStatus: {
      enabled: true,
      subject: 'Mitgliedschaft {status}',
      includeClubInfo: true,
    },

    roleChange: {
      enabled: true,
      subject: 'Deine Rolle wurde geändert',
      includePermissionsInfo: true,
    },

    invitation: {
      enabled: true,
      subject: 'Einladung zu {clubName}',
      includeLoginUrl: true,
      includePasswordResetUrl: true,
    },
  },

  // Email scheduling configuration
  scheduling: {
    // Booking reminders
    reminders: {
      enabled: true,
      times: [24, 48], // hours before session
    },

    // Daily digest
    dailyDigest: {
      enabled: false,
      time: '08:00',
      timezone: 'Europe/Berlin',
    },

    // Weekly summary
    weeklySummary: {
      enabled: false,
      day: 'monday',
      time: '09:00',
      timezone: 'Europe/Berlin',
    },
  },

  // Email rate limiting
  rateLimiting: {
    enabled: true,
    maxPerHour: 100,
    maxPerDay: 1000,
  },

  // Email tracking
  tracking: {
    enabled: true,
    trackOpens: true,
    trackClicks: true,
  },

  // Email retry configuration
  retry: {
    enabled: true,
    maxAttempts: 3,
    backoffMs: [1000, 5000, 15000],
  },
};

export type EmailConfig = typeof emailConfig;
