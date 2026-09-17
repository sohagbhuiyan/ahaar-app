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
  /** Headline card: badge, title, image, two buttons, contact and stats. */
  'hero',
  /** The website's top carousel (`web_top` banners), when enabled for the app. */
  'promo_top',
  /** Admin-uploaded promo carousel, from the `app_home` banner placement. */
  'promo_app',
  /** The website's mid-page banner (`web_mid`), when enabled for the app. */
  'promo_mid',
  /** "Explore by category" — tiles come from the live catalogue. */
  'category_showcase',
  /** "Popular dishes" — cards come from the catalogue. */
  'featured_menu',
  /** The kitchen's latest videos; "See all" opens the Media tab. */
  'media_videos',
  /** "Popular plans" — cards come from the catalogue. */
  'plans',
  /** Evergreen marketing — steps and features are shipped, the copy is CMS. */
  'how_it_works',
  'why_us',
  'testimonials',
  'faq',
  /** Closing call-to-action card. */
  'cta',
  /**
   * Admin-published promo codes.
   *
   * NOT YET SERVED BY THE API — the backend has no promo-code model today, so
   * `GET /home?platform=app` never returns this section and nothing renders.
   * The contract the app expects once it does:
   *
   *   { type: 'promo_codes', content: { heading?, subheading? },
   *     codes: [{ code, title?, description?, discount_label?, expires_at? }] }
   *
   * (`codes` is also accepted inside `content`.) Expired or blank codes are
   * dropped in `normalizeHomeContent`.
   */
  'promo_codes',
] as const;

export type AppSectionType = (typeof APP_SECTION_TYPES)[number];

/** The section types that render a banner carousel rather than their own copy. */
export type PromoSectionType = 'promo_top' | 'promo_app' | 'promo_mid';

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
  /** `image_path` resolved by the API. Prefer it — see `resolveCmsImage`. */
  image_url?: string | null;
}

export interface PromoContent {
  heading?: string | null;
}

export interface HomeStat {
  value: string;
  label: string;
}

export interface HeroContent {
  badge?: string | null;
  title?: string | null;
  /** Rendered in the brand colour straight after `title`. */
  title_highlight?: string | null;
  subtitle?: string | null;
  image_path?: string | null;
  image_url?: string | null;
  primary_cta_label?: string | null;
  primary_cta_url?: string | null;
  secondary_cta_label?: string | null;
  secondary_cta_url?: string | null;
  phone?: string | null;
  /** A bare number; the wa.me link is built here. */
  whatsapp?: string | null;
  rating_value?: string | null;
  rating_caption?: string | null;
  /** An empty array means "hide the band" — not "use the defaults". */
  stats?: HomeStat[] | null;
}

export interface TestimonialContentItem {
  name: string;
  /** Usually the customer's city. */
  role?: string | null;
  quote: string;
  rating: number;
  avatar_path?: string | null;
  avatar_url?: string | null;
}

export interface TestimonialsContent extends HeadingContent {
  items?: TestimonialContentItem[] | null;
}

export interface FaqContentItem {
  question: string;
  answer: string;
}

export interface FaqContent extends HeadingContent {
  items?: FaqContentItem[] | null;
}

export type HomeSectionContent =
  | HeadingContent
  | CatalogSectionContent
  | CtaContent
  | PromoContent
  | HeroContent
  | TestimonialsContent
  | FaqContent;

/** One promo code an admin published. See `'promo_codes'` above. */
export interface PromoCode {
  code: string;
  title: string | null;
  description: string | null;
  /** "20% off", "SAR 25 off your first week" — free text from the admin. */
  discount_label: string | null;
  /** ISO timestamp; `null` when the code does not expire. */
  expires_at: string | null;
}

export interface HomeSection {
  type: AppSectionType;
  sort_order: number;
  content: HomeSectionContent | null;
  /** Non-empty only for the promo types. */
  banners: HomeBanner[];
  /** Non-empty only for `promo_codes`. */
  codes: PromoCode[];
}

export interface HomeContent {
  /**
   * The API's section contract. `1` (the field is absent) is a server from
   * before the app had its own section list and order; `2` serves both.
   */
  layoutVersion: number;
  sections: HomeSection[];
}
