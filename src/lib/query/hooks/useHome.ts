/**
 * Homepage CMS content — what an admin has configured for the app's Home tab.
 *
 * A shorter `staleTime` than the catalogue hooks: this is the surface an admin
 * edits and then checks on a device, and a promo that stays hidden for ten
 * minutes after being published reads as a broken save. Two minutes still means
 * Home doesn't re-fetch on every tab switch.
 *
 * Public read — no session needed, so it stays out of `PRIVATE_QUERY_ROOTS` and
 * survives sign-out along with the rest of the catalogue.
 */
import { useQuery } from '@tanstack/react-query';

import * as homeApi from '../../api/endpoints/home';
import type {
  AppSectionType,
  CatalogSectionContent,
  CtaContent,
  HomeSection,
} from '../../api/types/home';
import { queryKeys } from '../keys';

const HOME_STALE_MS = 2 * 60 * 1000;

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
 * the screen: which sections are on, what the promo carousel holds, and the copy
 * for the two catalogue rails.
 *
 * `enabled` defaults to **true** for the catalogue sections when the CMS is
 * unavailable. Home has always shown those rails; losing the API should cost the
 * admin's promos, not the shop.
 */
export interface HomeLayout {
  promoBanners: HomeSection['banners'];
  promoHeading: string | null;
  featuredMenu: { enabled: boolean; content: CatalogSectionContent | null };
  plans: { enabled: boolean; content: CatalogSectionContent | null };
  cta: CtaContent | null;
  // Deliberately no `order`: this screen's structure is fixed. The greeting,
  // today's delivery and the subscription summary are the customer's own state
  // and cannot move, so honouring a CMS order here would be a half-truth. The
  // admin's ordering applies to the website; on the app the toggles decide what
  // appears.
}

export function useHomeLayout() {
  return useQuery({
    queryKey: queryKeys.home.content(),
    queryFn: homeApi.getHomeContent,
    staleTime: HOME_STALE_MS,
    select: (data): HomeLayout => {
      const find = (type: AppSectionType) =>
        data.sections.find((s) => s.type === type);

      const promo = find('promo_app');
      const featured = find('featured_menu');
      const plans = find('plans');
      const cta = find('cta');

      return {
        promoBanners: promo?.banners ?? [],
        promoHeading:
          (promo?.content as { heading?: string | null } | null)?.heading ?? null,
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
    },
  });
}

/**
 * The layout to use while the CMS read is in flight or has failed.
 *
 * Both rails on, no promos — i.e. exactly the Home screen this app had before it
 * became CMS-driven.
 */
export const FALLBACK_HOME_LAYOUT: HomeLayout = {
  promoBanners: [],
  promoHeading: null,
  featuredMenu: { enabled: true, content: null },
  plans: { enabled: true, content: null },
  cta: null,
};
