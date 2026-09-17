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
 * the customer into Safari or Chrome. `tel:` and `mailto:` go to the system,
 * since only the phone or mail app can act on them.
 */
import * as WebBrowser from 'expo-web-browser';
import type { ImperativeRouter } from 'expo-router';
import { Linking } from 'react-native';

import type { HeadingContent } from './api/types/home';
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
 * Keys are website paths, since that is what admins type. `/menu` is the
 * website's dish listing, which in this app is the Foods tab — not the tab
 * whose route happens to be called `menu` (that one is Account).
 *
 * Keys are matched exactly; detail routes are matched by prefix below.
 */
const STATIC_ROUTES: Record<string, string> = {
  '/': '/(tabs)',
  '/menu': '/(tabs)/foods',
  '/foods': '/(tabs)/foods',
  '/plans': '/(tabs)/plans',
  '/media': '/media',
  '/packages': '/packages',
  '/account': '/(tabs)/menu',
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

function isSystem(url: string): boolean {
  return /^(tel|mailto):/i.test(url);
}

/** Strips a locale prefix the web app may have stored (`/en/plans`). */
function normalizePath(url: string): string {
  const path = url.startsWith('/') ? url : `/${url}`;
  return path.replace(/^\/(en|ar)(?=\/|$)/, '') || '/';
}

export type CmsLink =
  | { kind: 'external'; href: string }
  | { kind: 'system'; href: string }
  | { kind: 'route'; href: string };

/**
 * Resolve a stored CMS URL to something this app can act on.
 *
 * Returns null when the link is empty or points somewhere the app has no screen
 * for — callers should then render the banner or button without a press target.
 */
export function resolveCmsLink(url: string | null | undefined): CmsLink | null {
  const value = url?.trim();
  if (!value) return null;

  if (isExternal(value)) return { kind: 'external', href: value };
  if (isSystem(value)) return { kind: 'system', href: value };

  const path = normalizePath(value);

  const staticRoute = STATIC_ROUTES[path];
  if (staticRoute) return { kind: 'route', href: staticRoute };

  // Detail routes: /food/12, /plan/7, /package/3, /media/5.
  const detail = /^\/(food|plan|package|media)\/([\w-]+)$/.exec(path);
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

  if (link.kind === 'system') {
    await Linking.openURL(link.href).catch(() => undefined);
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

/**
 * A section's eyebrow / heading / sub-heading, with the shipped copy filling
 * the gaps.
 *
 * A CMS heading without a sub-heading means "no sub-heading" rather than the
 * shipped one, which was written to sit under the shipped heading.
 */
export function cmsHeading(
  content: HeadingContent | null | undefined,
  fallback: { eyebrow?: string; title: string; subtitle?: string },
): { eyebrow: string; title: string; subtitle: string } {
  return {
    eyebrow: cmsText(content?.eyebrow, fallback.eyebrow),
    title: cmsText(content?.heading, fallback.title),
    subtitle: cmsText(content?.subheading, content?.heading ? '' : fallback.subtitle),
  };
}

/** `wa.me` link from a stored bare number. Tolerates a pasted `+` and spaces. */
export function whatsappHref(number: string | null | undefined): string | null {
  const digits = number?.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : null;
}

/** `tel:` link from a stored phone number, keeping a leading `+`. */
export function telHref(number: string | null | undefined): string | null {
  const value = number?.replace(/[^\d+]/g, '');
  return value ? `tel:${value}` : null;
}

/**
 * A loadable URL for a CMS image.
 *
 * The API sends `image_url` beside every stored `image_path`; that is always
 * preferred. The path is the fallback for an API from before it did: an
 * absolute path passes through, and a storage path is resolved against the API
 * host the same way the backend would (`…/storage/<path>`).
 */
export function resolveCmsImage(
  url: string | null | undefined,
  path: string | null | undefined,
  apiBase: string | undefined = process.env.EXPO_PUBLIC_API_URL,
): string | null {
  const resolved = cmsText(url);
  if (resolved) return resolved;

  const stored = cmsText(path);
  if (!stored) return null;
  if (isExternal(stored)) return stored;

  const host = apiBase?.replace(/\/api(\/v\d+)?\/?$/, '');
  return host ? `${host}/storage/${stored.replace(/^\/+/, '')}` : null;
}
