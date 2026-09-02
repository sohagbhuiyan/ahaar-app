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
 */

export interface HomeStep {
  n: string;
  title: string;
  body: string;
}

export const HOW_IT_WORKS: HomeStep[] = [
  {
    n: '01',
    title: 'Choose your plan',
    body: 'Pick a short taster or a full monthly plan. Set the meals you want and your dietary preferences.',
  },
  {
    n: '02',
    title: 'We cook fresh daily',
    body: 'Our chefs prepare your meals every morning using seasonal, locally-sourced ingredients.',
  },
  {
    n: '03',
    title: 'Delivered to your door',
    body: 'Insulated, eco-friendly packaging arrives in your chosen time slot — fresh and ready to eat.',
  },
  {
    n: '04',
    title: 'Eat, swap, adjust',
    body: 'Trade a dish, add an extra or skip a day from your plan — you stay in full control.',
  },
];

export interface HomeFeature {
  title: string;
  body: string;
  /** A single emoji — no icon font is bundled, and this reads at any size. */
  glyph: string;
}

export const WHY_AHAAR: HomeFeature[] = [
  {
    glyph: '👨‍🍳',
    title: 'Chef-prepared, never frozen',
    body: 'Real chefs, real kitchens. Cooked the same day it reaches you.',
  },
  {
    glyph: '🥗',
    title: 'Balanced & macro-counted',
    body: 'Calories and protein on every dish, so hitting your goals is easy.',
  },
  {
    glyph: '🔄',
    title: 'Swap any dish',
    body: 'Trade a meal for another in the same week. No calls, no fees.',
  },
  {
    glyph: '🚚',
    title: 'Reliable daily delivery',
    body: 'Pick a slot and we are there — on schedule, every day of your plan.',
  },
];

export interface HomeStat {
  value: string;
  label: string;
}

export const AHAAR_STATS: HomeStat[] = [
  { value: '120k+', label: 'Meals delivered' },
  { value: '4.9★', label: 'Average rating' },
  { value: '98%', label: 'On-time deliveries' },
];

export interface HomeTestimonial {
  id: number;
  name: string;
  city: string;
  rating: number;
  quote: string;
}

export const TESTIMONIALS: HomeTestimonial[] = [
  {
    id: 1,
    name: 'Layla A.',
    city: 'Riyadh',
    rating: 5,
    quote:
      'AHAAR completely changed my weekdays. The food arrives fresh, on time, and tastes like a restaurant meal every single day.',
  },
  {
    id: 2,
    name: 'Omar K.',
    city: 'Jeddah',
    rating: 5,
    quote:
      'As someone with a packed schedule, the subscription is a lifesaver. Swapping meals is effortless and the variety keeps it exciting.',
  },
  {
    id: 3,
    name: 'Sara M.',
    city: 'Dammam',
    rating: 5,
    quote:
      'Healthy, portioned and genuinely delicious. I have hit my fitness goals without ever thinking about meal prep again.',
  },
];

export interface HomeFaq {
  q: string;
  a: string;
}

export const FAQS: HomeFaq[] = [
  {
    q: 'Which cities do you deliver to?',
    a: 'We deliver daily across Riyadh, Jeddah, Dammam and the surrounding major areas, with new cities added regularly.',
  },
  {
    q: 'Can I pause or skip a day?',
    a: 'Yes. Skipping a day releases that day’s allowance and extends your plan by one day, so you never lose a meal you paid for.',
  },
  {
    q: 'Can I change what arrives?',
    a: 'Open your plan, tap the day, and swap a dish for another meal in the same week. Each dish can be swapped once, up to its cutoff.',
  },
  {
    q: 'How is the food kept fresh?',
    a: 'Every meal is prepared the same morning and delivered in insulated, eco-friendly packaging within hours of cooking.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'All major cards and local payment methods. The full amount is shown before you confirm — no hidden fees.',
  },
];

/** Cities the delivery network covers, for the coverage strip. */
export const DELIVERY_CITIES = [
  'Riyadh',
  'Jeddah',
  'Dammam',
  'Khobar',
  'Mecca',
  'Medina',
];
