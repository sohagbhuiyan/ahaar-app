/**
 * Homepage CMS content — what an admin has configured for the app.
 *
 * A shorter `staleTime` than the catalogue hooks: this is the surface an admin
 * edits and then checks on a device, and a promo that stays hidden for ten
 * minutes after being published reads as a broken save. Two minutes still means
 * Home doesn't re-fetch on every tab switch.
 *
 * Public read — no session needed, so it stays out of `PRIVATE_QUERY_ROOTS` and
 * survives sign-out along with the rest of the catalogue.
 *
 * The same read also feeds the Plans and Account tabs, which show the
 * `app_home` promo carousel from one cached response.
 */
import { useQuery } from '@tanstack/react-query';

import * as homeApi from '../../api/endpoints/home';
import type {
  AppSectionType,
  CatalogSectionContent,
  CtaContent,
  HeadingContent,
  HomeContent,
  HomeSection,
  PromoCode,
} from '../../api/types/home';
import { queryKeys } from '../keys';

const HOME_STALE_MS = 2 * 60 * 1000;

/** The first API contract that gives the app its own section list and order. */
const APP_LAYOUT_VERSION = 2;

export function useHomeContent() {
  return useQuery({
    queryKey: queryKeys.home.content(),
    queryFn: homeApi.getHomeContent,
    staleTime: HOME_STALE_MS,
  });
}

/**
 * Everything Home needs from the CMS, in one shape.
 *
 * Derived with `select` so the decisions live here rather than being re-made in
 * the screen.
 */
export interface HomeLayout {
  /**
   * The sections below the customer's own state, in the admin's app order.
   * Home pins the greeting, today's meals and the subscription above these —
   * they are this customer's day, not marketing — and renders the rest in
   * exactly this sequence.
   */
  sections: HomeSection[];
  /** The `app_home` carousel, for the Plans and Account tabs. */
  promoBanners: HomeSection['banners'];
  promoHeading: string | null;
  /** Empty until the API serves a `promo_codes` section. */
  promoCodes: PromoCode[];
  promoCodesContent: HeadingContent | null;
  featuredMenu: { enabled: boolean; content: CatalogSectionContent | null };
  plans: { enabled: boolean; content: CatalogSectionContent | null };
  cta: CtaContent | null;
}

/** The order this build ships with — what a fresh seed gives the app, too. */
const SHIPPED_ORDER: AppSectionType[] = [
  'hero',
  'promo_top',
  'promo_app',
  'promo_codes',
  'category_showcase',
  'featured_menu',
  'media_videos',
  'plans',
  'promo_mid',
  'how_it_works',
  'why_us',
  'testimonials',
  'faq',
  'cta',
];

/**
 * Sections an older API cannot describe, and which Home always showed before
 * the CMS learned about them.
 */
const SHIPPED_ALWAYS_ON: ReadonlySet<AppSectionType> = new Set<AppSectionType>([
  'hero',
  'category_showcase',
  'media_videos',
  'how_it_works',
  'why_us',
  'testimonials',
  'faq',
]);

function blankSection(type: AppSectionType, sortOrder = 0): HomeSection {
  return { type, sort_order: sortOrder, content: null, banners: [], codes: [] };
}

/**
 * Home's sections when the API predates the app layout (`layoutVersion` 1).
 *
 * Such a server only knows the promo carousel, the two catalogue rails and the
 * CTA, so those keep obeying it; everything it cannot describe renders from
 * shipped copy, in the shipped order. An app release that lands before the
 * backend deploy therefore still shows a complete Home — the CMS stays
 * additive, never load-bearing.
 */
export function legacyAppSections(fromApi: HomeSection[]): HomeSection[] {
  const byType = new Map(fromApi.map((section) => [section.type, section]));

  return SHIPPED_ORDER.flatMap((type, index) => {
    const section = byType.get(type);
    if (section) return [{ ...section, sort_order: index }];
    return SHIPPED_ALWAYS_ON.has(type) ? [blankSection(type, index)] : [];
  });
}

export function selectHomeLayout(data: HomeContent): HomeLayout {
  const find = (type: AppSectionType) => data.sections.find((s) => s.type === type);

  const promo = find('promo_app');
  const codes = find('promo_codes');
  const featured = find('featured_menu');
  const plans = find('plans');
  const cta = find('cta');

  return {
    sections:
      data.layoutVersion >= APP_LAYOUT_VERSION
        ? data.sections
        : legacyAppSections(data.sections),
    promoBanners: promo?.banners ?? [],
    promoHeading: (promo?.content as { heading?: string | null } | null)?.heading ?? null,
    promoCodes: codes?.codes ?? [],
    promoCodesContent: (codes?.content as HeadingContent | null) ?? null,
    featuredMenu: {
      enabled: Boolean(featured),
      content: (featured?.content as CatalogSectionContent | null) ?? null,
    },
    plans: {
      enabled: Boolean(plans),
      content: (plans?.content as CatalogSectionContent | null) ?? null,
    },
    cta: cta ? ((cta.content as CtaContent | null) ?? {}) : null,
  };
}

export function useHomeLayout() {
  return useQuery({
    queryKey: queryKeys.home.content(),
    queryFn: homeApi.getHomeContent,
    staleTime: HOME_STALE_MS,
    select: selectHomeLayout,
  });
}

/**
 * The layout to use while the CMS read is in flight or has failed.
 *
 * Every section that needs no uploaded image, in the shipped order, with the
 * shipped copy — an API problem costs the admin's banners, not the shop.
 */
export const FALLBACK_HOME_LAYOUT: HomeLayout = {
  sections: legacyAppSections([
    blankSection('featured_menu'),
    blankSection('plans'),
    blankSection('cta'),
  ]),
  promoBanners: [],
  promoHeading: null,
  promoCodes: [],
  promoCodesContent: null,
  featuredMenu: { enabled: true, content: null },
  plans: { enabled: true, content: null },
  cta: null,
};
