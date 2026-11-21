/**
 * Shipped marketing copy for the Home screen.
 *
 * Static on purpose. Everything here answers a question a first-time visitor
 * has before they will subscribe — how it works, why us, what other people
 * think, is my city covered — and none of it is per-customer, so it must render
 * on a cold start, offline, and while the API is unreachable. The CMS
 * (`GET /home?platform=app`) still owns the promo banners, the two catalogue
 * rails and the closing call-to-action; this is the connective tissue between
 * them.
 *
 * Copy is kept word-for-word in step with the website's `lib/dummy-data.ts` and
 * its marketing sections, so a customer who read the site and then opened the
 * app is told the same things in the same voice.
 *
 * Every user-facing string here is an i18n KEY (`locales/<lng>/home.json`),
 * resolved with `t()` at render time so it follows a language change.
 */

export interface HomeStep {
  n: string;
  /** i18n key */
  title: string;
  /** i18n key */
  body: string;
}

export const HOW_IT_WORKS: HomeStep[] = [1, 2, 3, 4].map((i) => ({
  n: `0${i}`,
  title: `home.howItWorks.steps.${i}.title`,
  body: `home.howItWorks.steps.${i}.body`,
}));

export interface HomeFeature {
  /** i18n key */
  title: string;
  /** i18n key */
  body: string;
  /** A single emoji — no icon font is bundled, and this reads at any size. */
  glyph: string;
}

export const WHY_AHAAR: HomeFeature[] = (
  [
    ['chef', '👨‍🍳'],
    ['balanced', '🥗'],
    ['swap', '🔄'],
    ['delivery', '🚚'],
  ] as const
).map(([key, glyph]) => ({
  glyph,
  title: `home.whyAhaar.features.${key}.title`,
  body: `home.whyAhaar.features.${key}.body`,
}));

export interface HomeStat {
  value: string;
  /** i18n key */
  label: string;
}

export const AHAAR_STATS: HomeStat[] = [
  { value: '120k+', label: 'home.stats.mealsDelivered' },
  { value: '4.9★', label: 'home.stats.averageRating' },
  { value: '98%', label: 'home.stats.onTime' },
];

export interface HomeTestimonial {
  id: number;
  /** i18n key */
  name: string;
  /** i18n key */
  city: string;
  rating: number;
  /** i18n key */
  quote: string;
}

export const TESTIMONIALS: HomeTestimonial[] = (
  [
    [1, 'riyadh'],
    [2, 'jeddah'],
    [3, 'dammam'],
  ] as const
).map(([id, city]) => ({
  id,
  name: `home.testimonials.items.${id}.name`,
  city: `home.cities.${city}`,
  rating: 5,
  quote: `home.testimonials.items.${id}.quote`,
}));

export interface HomeFaq {
  /** i18n key */
  q: string;
  /** i18n key */
  a: string;
}

export const FAQS: HomeFaq[] = ['cities', 'pause', 'change', 'fresh', 'payment'].map((key) => ({
  q: `home.faq.items.${key}.q`,
  a: `home.faq.items.${key}.a`,
}));

/** Cities the delivery network covers, for the coverage strip (i18n keys). */
export const DELIVERY_CITIES = ['riyadh', 'jeddah', 'dammam', 'khobar', 'mecca', 'medina'].map(
  (city) => `home.cities.${city}`,
);
