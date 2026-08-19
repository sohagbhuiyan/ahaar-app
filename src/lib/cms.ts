/**
 * Following a link an admin typed into the CMS.
 *
 * A banner's `cta_url` is stored platform-neutrally, because the same row is
 * read by the website and this app: a path (`/plans`, `/food/12`) or an absolute
 * URL. Only the client knows what a path means, so the routing decision lives
 * here rather than in the stored value.
 *
 * External links open in the in-app browser for the same reason payments do (see
 * `lib/payments.ts`): it keeps Ahaar in the foreground instead of task-switching
 * the customer into Safari or Chrome.
 */
import * as WebBrowser from 'expo-web-browser';
import type { ImperativeRouter } from 'expo-router';

import { colors } from './theme';

/**
 * The in-app routes a CMS link may target.
 *
 * An allowlist rather than a straight `router.push(url)`: `cta_url` is free text
 * from the admin panel, and pushing an unrecognised path would either crash the
 * navigator or land the customer on a blank screen. Anything not listed is
 * ignored, which leaves the banner a plain image — a dead press is better than a
 * broken screen.
 *
 * Keys are matched exactly; `/food/:id` and `/plan/:id` are matched by prefix.
 */
const STATIC_ROUTES: Record<string, string> = {
  '/': '/(tabs)',
  '/menu': '/(tabs)/menu',
  '/foods': '/(tabs)/foods',
  '/plans': '/(tabs)/plans',
  '/orders': '/orders',
  '/order': '/order',
  '/deliveries': '/deliveries',
  '/subscriptions': '/subscriptions',
  '/payments': '/payments',
  '/profile': '/profile',
};

function isExternal(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** Strips a locale prefix the web app may have stored (`/en/plans`). */
function normalizePath(url: string): string {
  const path = url.startsWith('/') ? url : `/${url}`;
  return path.replace(/^\/(en|ar)(?=\/|$)/, '') || '/';
}

/**
 * Resolve a stored CMS URL to something this app can act on.
 *
 * Returns null when the link is empty or points somewhere the app has no screen
 * for — callers should then render the banner without a press target.
 */
export function resolveCmsLink(
  url: string | null | undefined,
): { kind: 'external'; href: string } | { kind: 'route'; href: string } | null {
  const value = url?.trim();
  if (!value) return null;

  if (isExternal(value)) return { kind: 'external', href: value };

  const path = normalizePath(value);

  const staticRoute = STATIC_ROUTES[path];
  if (staticRoute) return { kind: 'route', href: staticRoute };

  // Detail routes: /food/12 and /plan/7.
  const detail = /^\/(food|plan)\/([\w-]+)$/.exec(path);
  if (detail) return { kind: 'route', href: `/${detail[1]}/${detail[2]}` };

  return null;
}

/** Follow a resolved CMS link. Safe to call with a null link — it no-ops. */
export async function openCmsLink(
  url: string | null | undefined,
  router: ImperativeRouter,
): Promise<void> {
  const link = resolveCmsLink(url);
  if (!link) return;

  if (link.kind === 'external') {
    await WebBrowser.openBrowserAsync(link.href, {
      toolbarColor: colors.surface.DEFAULT,
      controlsColor: colors.brand[500],
      dismissButtonStyle: 'close',
      enableBarCollapsing: true,
    });
    return;
  }

  router.push(link.href as never);
}

/**
 * First non-empty value, treating a whitespace-only CMS string as absent.
 *
 * The fallback rule the whole screen depends on: an admin clearing a field means
 * "go back to the built-in copy", never "render a blank heading".
 */
export function cmsText(...values: (string | null | undefined)[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return '';
}
