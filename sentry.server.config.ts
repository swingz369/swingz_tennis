import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  beforeSend(event, hint) {
    if (process.env.NODE_ENV === 'development') {
      console.log('Sentry Event:', event);
      console.log('Sentry Hint:', hint);
    }
    return event;
  },
  beforeSendTransaction(transaction) {
    return transaction;
  },
});
