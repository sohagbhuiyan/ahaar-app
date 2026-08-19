/**
 * Homepage CMS — `GET /home?platform=app`.
 *
 * The same endpoint feeds the website; `platform=app` asks the API for the
 * sections an admin has enabled for this app, already ordered and already
 * filtered to what is live right now. Mirrors `config/homepage.php` in
 * ahaar-backend and `ahaar/src/types/home.types.ts` on the web.
 *
 * ── The content contract ────────────────────────────────────────────────────
 * Every `content` field is optional and a section may have `content: null`
 * entirely. Absent means "use the screen's built-in copy", never "render an
 * empty heading" — read every field through a `??` fallback.
 *
 * Section types this build cannot render are dropped in `normalizeHomeContent`,
 * so a backend that gains a section before the app ships support for it cannot
 * leave a blank gap on Home.
 */

/** Section types this app renders. A web-only type never reaches here. */
export const APP_SECTION_TYPES = [
  /** Admin-uploaded promo carousel, from the `app_home` banner placement. */
  'promo_app',
  /** "Popular dishes" — cards come from the catalogue. */
  'featured_menu',
  /** "Popular plans" — cards come from the catalogue. */
  'plans',
  /** Closing call-to-action card. */
  'cta',
] as const;

export type AppSectionType = (typeof APP_SECTION_TYPES)[number];

export interface HomeBanner {
  id: number;
  /** Storage path; prefer `image_url`, which the API resolves for you. */
  image_path: string;
  image_url: string | null;
  alt_text: string | null;
  title: string | null;
  subtitle: string | null;
  cta_label: string | null;
  /**
   * A route in this app (`/plans`, `/food/12`) or an absolute `https://…` URL.
   * `openCmsLink` in `lib/cms.ts` decides which and acts accordingly.
   */
  cta_url: string | null;
}

export interface HeadingContent {
  eyebrow?: string | null;
  heading?: string | null;
  subheading?: string | null;
}

/** featured_menu / plans — the cards come from the catalogue, not the CMS. */
export interface CatalogSectionContent extends HeadingContent {
  /** How many cards to show. Falls back to the screen's own default. */
  limit?: number | null;
}

export interface CtaContent {
  heading?: string | null;
  subheading?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  image_path?: string | null;
}

export interface PromoContent {
  heading?: string | null;
}

export type HomeSectionContent =
  | HeadingContent
  | CatalogSectionContent
  | CtaContent
  | PromoContent;

export interface HomeSection {
  type: AppSectionType;
  sort_order: number;
  content: HomeSectionContent | null;
  /** Non-empty only for `promo_app`. */
  banners: HomeBanner[];
}

export interface HomeContent {
  sections: HomeSection[];
}
