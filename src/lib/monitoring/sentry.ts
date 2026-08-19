/**
 * Crash and error reporting.
 *
 * Sentry is initialised only when a DSN is present and the build is not a dev
 * build. Two reasons: a missing DSN would otherwise log a warning on every
 * launch, and reporting from Metro-reloaded dev sessions floods the project
 * with noise that nobody triages.
 *
 * `EXPO_PUBLIC_SENTRY_DSN` is inlined into the bundle — that is fine and
 * expected. A DSN is a write-only ingest key, not a secret; it can submit
 * events but cannot read them.
 *
 * ── Why the SDK is loaded lazily ────────────────────────────────────────────
 * `@sentry/react-native` ships its own Android and iOS native code and is not
 * an Expo module, so it is **not present in Expo Go** — unlike every other
 * native dependency here (reanimated, worklets, secure-store, glass-effect),
 * which Expo Go bundles. Importing it at module scope runs its top-level
 * initialisation, which reaches for a native binding that does not exist there.
 *
 * Requiring it only when `isSentryEnabled` means that never happens in the two
 * cases where Sentry does nothing anyway — a dev session, or a build with no
 * DSN — so the app loads in Expo Go. A release build with a DSN takes the same
 * path it always did. (Metro still bundles the module either way; what changes
 * is whether its side effects run.)
 */
import type * as SentryTypes from '@sentry/react-native';

/**
 * The integration object `reactNavigationIntegration` produces. Derived rather
 * than imported: the SDK does not export an `Integration` type by name.
 */
type NavigationIntegration = ReturnType<
  typeof SentryTypes.reactNavigationIntegration
>;

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const isSentryEnabled = Boolean(DSN) && !__DEV__;

/** The real SDK, or null when it must not be touched. Resolved once. */
function loadSentry(): typeof SentryTypes | null {
  if (!isSentryEnabled) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@sentry/react-native') as typeof SentryTypes;
}

const sentry = loadSentry();

/**
 * Navigation instrumentation, exported so the root layout can register the
 * expo-router integration. It has to exist before the navigation container
 * mounts, so this is resolved eagerly — as an inert stub when Sentry is off,
 * which keeps the call site free of null checks.
 */
export const navigationIntegration = sentry
  ? sentry.reactNavigationIntegration({ enableTimeToInitialDisplay: true })
  : { registerNavigationContainer: () => {} };

export function initSentry(): void {
  if (!sentry) return;

  sentry.init({
    dsn: DSN,
    // Traces are sampled rather than captured wholesale — full tracing on a
    // consumer app is expensive and rarely more informative.
    tracesSampleRate: 0.2,
    // Non-null here by construction: `sentry` is only truthy when the real
    // integration was built above, but TypeScript can't see across that.
    integrations: [navigationIntegration as NavigationIntegration],
    // Screenshots can contain a customer's address and order history; opt in
    // deliberately rather than inherit a default that leaks PII.
    attachScreenshot: false,
    attachStacktrace: true,
    sendDefaultPii: false,
    beforeSend(event) {
      // Belt and braces: strip the auth header if a request ever rides along
      // on a breadcrumb.
      if (event.request?.headers) {
        delete event.request.headers.Authorization;
        delete event.request.headers.authorization;
      }
      return event;
    },
  });
}

/**
 * Report a handled error.
 *
 * No-ops when Sentry is disabled, so call sites don't need to guard. Network
 * failures are deliberately not reported — they are the user's connection, not
 * a defect, and would drown the real signal.
 */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (__DEV__) {
    console.error('[captureError]', error, context);
  }

  if (!sentry) return;

  sentry.captureException(error, context ? { extra: context } : undefined);
}

/**
 * Attach the signed-in user to subsequent events, so a crash can be traced to
 * an account. Only the id — no email or name, which would be PII sitting in a
 * third-party system.
 */
export function setSentryUser(userId: number | null): void {
  if (!sentry) return;
  sentry.setUser(userId === null ? null : { id: String(userId) });
}

/** Wraps the root component. A no-op passthrough when Sentry is disabled. */
export const wrapRoot = sentry
  ? sentry.wrap
  : <T,>(component: T): T => component;
