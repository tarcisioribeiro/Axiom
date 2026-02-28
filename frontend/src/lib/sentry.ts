import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    // Capture 10% of transactions for performance monitoring
    tracesSampleRate: 0.1,
    // Do not send PII (no user emails / IPs by default)
    sendDefaultPii: false,
  });
}
