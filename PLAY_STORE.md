# AHAAR — Google Play Store Submission Guide

Everything needed to prepare, build and publish the AHAAR Android app.

| | |
|---|---|
| **App name** | Ahaar |
| **Package / Application ID** | `com.sohagexpo.ahaarapp` |
| **Version name** | `1.0.0` |
| **Version code** | Managed remotely by EAS (`appVersionSource: "remote"`, `autoIncrement: true`) |
| **EAS project ID** | `867c988f-3ef3-46b8-be64-f361cc7072d2` |
| **Production API** | `https://api.ahaar.store/api/v1` |
| **Expo SDK** | 57 · React Native 0.86 · Hermes · New Architecture |
| **Primary market** | Saudi Arabia |

---

## ⛔ Blockers — resolve before you upload

These will either fail review, mis-charge customers, or leave you blind in production. Nothing else in this document matters until these are closed.

### 1. Charged currency does not match displayed currency

**The app shows every price as `SAR`. The API charges in `EUR`.** A plate advertised as "SAR 45" is billed as €45 — roughly four times the advertised price.

- Display side: `formatMoney()` in `src/lib/utils.ts` pins the `SAR` prefix and deliberately ignores the `currency` field in every payload.
- Charge side: `config/payments.php` → `'currency' => env('PAYMENT_CURRENCY', 'EUR')`.

This has been made configurable but **deliberately left on `EUR`**, so no live payment behaviour changes without an explicit decision. Before release, set `PAYMENT_CURRENCY` in the backend `.env`:

- **`PAYMENT_CURRENCY=SAR`** — matches the storefront. First confirm the live gateway settles SAR. Stripe does. Mollie is EUR-centric and must be verified for your account.
- Or change both clients to display EUR, which contradicts the Saudi market the catalogue is written for.

Existing rows keep the currency they were written with; this only affects new orders.

### 2. No crash reporting in production

`EXPO_PUBLIC_SENTRY_DSN` is blank in all three `eas.json` profiles, so a release build ships with **zero crash visibility**. Sentry is already wired (`src/lib/monitoring/sentry.ts`) and correctly skips dev builds and blank DSNs.

```bash
eas env:create --name EXPO_PUBLIC_SENTRY_DSN --value "https://…@…ingest.sentry.io/…" --environment production
```

A DSN is a write-only ingest key, not a secret — shipping it in the bundle is expected and safe.

### 3. Google Maps Android key is not set for cloud builds

`GOOGLE_MAPS_ANDROID_API_KEY` exists in the local `.env.local` but **not** in any `eas.json` profile. Without it the Android map renders grey and the address picker silently falls back to its OpenStreetMap map. That fallback is supported, but it is almost certainly not what you want in a release.

```bash
eas env:create --name GOOGLE_MAPS_ANDROID_API_KEY --value "AIza…" --environment production
```

**This key is baked into `AndroidManifest.xml` and is readable by anyone who unzips the AAB.** That is by Google's design for Android Maps keys — the protection is the restriction, not secrecy. It **must** be restricted in Google Cloud Console to:
- **Application restriction:** Android apps
- **Package name:** `com.sohagexpo.ahaarapp`
- **SHA-1:** the Play App Signing certificate fingerprint *and* your EAS upload key (`eas credentials`). Add the debug keystore SHA-1 too if you build locally.
- **API restriction:** Maps SDK for Android only.

An unrestricted key on a public app will be scraped and billed to you.

#### Two Google Maps keys — do not mix them up

This is the most commonly confused part of the setup, and getting it wrong either breaks the map or leaks a billable key.

| | `GOOGLE_MAPS_ANDROID_API_KEY` | `GOOGLE_MAPS_API_KEY` |
|---|---|---|
| Lives in | `ahaar-app` — EAS env / `.env.local` | `ahaar-backend` — `.env` |
| Read by | `app.config.ts` → baked into `AndroidManifest.xml` | `config/location.php` → the Geo provider |
| Used for | Drawing the map in the address picker | Geocoding and Places lookups (`/geo/*`) |
| **Ships inside the app?** | **Yes — visible to anyone who unzips the AAB** | **No — never leaves the server** |
| APIs to enable | Maps SDK for Android **only** | Geocoding API + Places API (New) **only** |
| How to restrict | Android apps → package `com.sohagexpo.ahaarapp` + signing SHA-1s | **IP address** → your server's egress IP |

They must be **two separate keys**. Reusing one for both is the failure mode to avoid: an Android-restricted key rejects server-side geocoding calls, an IP-restricted key renders a grey map, and a single unrestricted key that satisfies both is exactly the key that gets scraped out of the APK and billed to you.

Neither `.env` nor `.env.local` is in version control (both are gitignored in their respective repos) — but treat any key that has been pasted into a chat, a ticket, a screenshot or a support thread as disclosed, and rotate it. Rotating the server key is zero-risk: change it in Google Cloud, update the backend `.env`, restart. Rotating the Android key requires a **new build**, because it is compiled into the manifest.

### 4. Google Sign-In needs the Play App Signing SHA-1

Once Google Play re-signs your AAB, the app's signature changes. Add the **Play App Signing** SHA-1 (Play Console → Setup → App integrity) to the Android OAuth client in Google Cloud Console, alongside the EAS upload key SHA-1. A missing fingerprint surfaces as `DEVELOPER_ERROR` on the Google button, on production only.

### 5. Privacy Policy and Terms must be publicly reachable

Play requires a live Privacy Policy URL for any app that handles personal data. This one handles names, emails, phone numbers, delivery addresses and precise location. See [Privacy Policy](#privacy-policy-requirements) below.

---

## Positioning

**Ahaar is a catering and food service: best-quality food, in less time, at a price that works.**

Everything in the listing leads with those three pillars, in that order:

| Pillar | The promise | What actually backs it in the product |
|---|---|---|
| **Quality** | Chef-cooked, fresh the same day, never frozen | Real kitchens, seasonal ingredients, macro-counted dishes, kitchen videos customers can watch |
| **Speed** | Ordered quickly, delivered on time | Saved addresses, repeat ordering, fixed time slots with live cutoffs, one-tap Google sign-in |
| **Price** | Far less than eating out, no surprises | Flat-price plans, bundled meal boxes cheaper than à la carte, tax-inclusive pricing, no hidden fees, cash accepted |

> **A copywriting note worth one line.** You described the price pillar as "cheap". I have written it as *affordable / great value / less than eating out* rather than "cheap", because "cheap food" undercuts the "best quality" claim in the very same sentence — shoppers read it as low quality, not low cost. The meaning you asked for is intact; only the word changed. If you specifically want the word "cheap" in the listing, it is a one-word edit in each place below.

---

## Store listing

### App title
*(30 characters max)*

```
Ahaar: Quality Food & Catering
```
**30 characters — exactly at the limit.** Valid, but with no headroom: add one character and Play truncates it. Prefer a shorter option below if you expect to tweak it later.

**Alternatives:**

| Title | Chars | Leans towards |
|---|---|---|
| `Ahaar: Fresh Food & Catering` | 28 | Quality + catering |
| `Ahaar: Catering & Meal Plans` | 28 | Catering + subscriptions |
| `Ahaar: Quality Food, Fast` | 25 | Quality + speed |
| `Ahaar — Food & Catering` | 23 | Broadest, most headroom |

### Short description
*(80 characters max — shown under the title in search results, and the single highest-leverage piece of copy in the listing)*

```
Top-quality food and catering, delivered fast, at prices that actually work.
```
76 characters. Carries all three pillars in one line.

**Alternatives:**

| Short description | Chars |
|---|---|
| `Best-quality meals and catering, delivered fast, without the restaurant price.` | 78 |
| `Quality food and catering, delivered fast, at a price that works. Order today.` | 78 |
| `Great food, fast delivery, fair prices. Daily meal plans, catering and one-offs.` | 80 |

### Full description
*(4000 characters max — the text below is **3,853**, verified. ~150 characters of headroom, so edit with care.)*

```
Best-quality food. In less time. At a price that works.

Ahaar is catering and daily food done properly — real chefs, real kitchens,
cooked fresh the morning it reaches you, and delivered in the time slot you
picked. Whether you need feeding every day, a one-off meal tonight, or enough
food for a table of ten, it is the same kitchen and the same standard.

── WHY PEOPLE SWITCH TO AHAAR ────────────────────────────

QUALITY YOU CAN ACTUALLY SEE
No freezers. No reheated batches. No month-old trays. Every meal is prepared
the same day it is delivered, using seasonal ingredients, and arrives in
insulated eco-friendly packaging. Not sure? Watch it being made — we post real
videos from the Ahaar kitchen, right inside the app.

FOOD IN LESS TIME
Save your address once and reorder in seconds. Pick a delivery slot that suits
your day and we hit it — every meal shows a live cutoff so you always know
exactly how long you have left to change it. No queues, no waiting on hold, no
guessing when your food will turn up.

A PRICE THAT ACTUALLY WORKS
Eating well every day should not cost what eating out costs. Meal plans are
one flat price for the whole run. Meal boxes bundle a complete meal for less
than ordering each dish separately. Prices include tax, and there are no
surprise fees at the end.

── CATERING AND DAILY MEALS ──────────────────────────────

DAILY MEAL PLANS
Pick a short taster or a full monthly plan. Your plan covers every meal it
serves — breakfast, lunch and dinner — for its whole duration, at one flat
price. Ideal for families, busy professionals, and anyone tired of deciding
what to eat every single day.

FEEDING MORE THAN ONE
Guests coming? Add guest portions of the same meal to any delivery, for up to
ten people, and everyone eats the same freshly cooked food.

MEAL BOXES
Complete meals at one price — a main, rice and a side, bundled together and
cheaper than buying each dish on its own. The easiest way to feed a group
without building an order dish by dish.

ONE-OFF ORDERS
No plan, no commitment. Browse the full menu, pick a day and a time slot, and
order a single dish or a whole meal box whenever you want one.

── BUILT TO BE CHANGED ───────────────────────────────────

SWAP ANY DISH
Not in the mood for what is scheduled? Trade it for another meal the same week.
No phone calls, no fees, no penalty.

PAUSE AND RESUME
Travelling? Pause your plan and pick it back up when you are home. You never
pay for food you were not there to eat.

ADD EXTRAS
Tack extra dishes onto any delivery right up until its cutoff.

── HOW YOU PAY ───────────────────────────────────────────

CASH ON DELIVERY
Prefer to pay at the door? Tick the Cash on Delivery box at checkout and pay
the rider in cash when your food arrives. No card needed. Available on one-off
orders, extras and guest portions.

CARD
Pay securely by card at checkout. Meal plans are paid for up front.

── EVERYTHING ELSE ───────────────────────────────────────

SEE YOUR WEEK AT A GLANCE
A day-by-day schedule of exactly what is arriving and when.

BALANCED AND MACRO-COUNTED
Calories and protein on every dish, so hitting your goals does not take a
spreadsheet.

DELIVERY WHERE YOU ACTUALLY ARE
Drop a pin on the map or use your current location. Save as many addresses as
you like and switch between them in a tap.

SIGN IN HOW YOU LIKE
Email and password, or one tap with Google.

── THE SHORT VERSION ─────────────────────────────────────

• Chef-prepared, never frozen, cooked the same day
• Delivered in the slot you chose, with a live cutoff on every meal
• Flat-price plans and bundled meal boxes — far less than eating out
• Swap any dish, any week, at no cost
• Pause whenever you travel
• Cash or card, your choice
• Tax included, no hidden fees

Best-quality food, in less time, at a price that works.
Download Ahaar and eat better this week.
```

⚠ **One honesty check before you publish this.** The copy above sells "catering" as *daily meal catering* — plans, meal boxes and guest portions for up to ten people — because that is what the app genuinely does today. It does **not** promise event catering: there is no venue field, no headcount above ten, no custom-quote flow and no event date. If you intend to sell weddings and corporate functions, do not add that language until the feature exists. Advertising a capability the app does not have is both a Play policy violation (misrepresentation) and the fastest route to one-star reviews.

### App category

- **Category:** Food & Drink
- **Application type:** Applications (not Games)
- **Tags:** Food delivery, Meal planning, Catering

### Keywords / search terms

Play has no keyword field — terms must appear naturally in the title, short description and full description. The copy above already places every primary term.

**Pillar terms (highest priority — work these in first):**
catering, catering service, quality food, fresh food, fast food delivery, affordable meals, cheap food delivery, value meals

**Core category:**
food delivery, meal delivery, meal plan, meal subscription, daily meals, tiffin service, food catering app, meal prep, home delivered food

**Intent-led:**
lunch delivery, dinner delivery, breakfast delivery, order food online, bulk food order, party food, group meal order

**Payment (a real differentiator — many competitors are card-only):**
cash on delivery food, COD food delivery, pay on delivery

**Local:**
food delivery Saudi Arabia, catering Riyadh, meal plan Riyadh

> Add Arabic search terms too — but have a native speaker confirm them before publishing. Regional Gulf usage varies, and a wrong or machine-translated term reads as spam to shoppers and does nothing for discovery.

---

## App features (for the listing and for review notes)

The **Pillar** column is the one to check before writing any new marketing copy: if a claim does not map to a real row here, it should not go in the listing.

| Feature | Detail | Pillar |
|---|---|---|
| Meal plan subscriptions | Flat-price plans covering every meal the plan serves, for its full duration | Price |
| One-off ("instant") orders | Any menu item, any open date and slot, no subscription required | Speed |
| Meal boxes / packages | Bundles charged as one line, cheaper than à la carte, exploded into dishes for the kitchen | Price |
| Add-ons & extras | Paid extras attached to an existing delivery before its cutoff | — |
| Guest portions | The delivery's own items ×N (**capped at 10**), for people eating with the customer | Catering |
| Meal swaps | Transpose two plates the customer already owns; quota-neutral | Quality |
| Pause & resume | Suspend a running plan and restart it | Price |
| Delivery schedule | Day-by-day calendar with live per-slot cutoffs | Speed |
| Kitchen media | Video feed with comments — customers watch their food being made | Quality |
| Addresses & location | Map/GPS-first picker, multiple saved addresses, default switching | Speed |
| Payments | Card (Mollie / Stripe) and **Cash on Delivery** | Price |
| Auth | Email + password, one-tap Google Sign-In, password reset | Speed |
| Offline tolerance | Persisted query cache, offline banner, shipped marketing copy | — |

**Not built, and therefore not advertised:** event catering (venue, event date, custom quotes), headcounts above 10, recurring corporate contracts, live courier tracking, in-app chat support, loyalty points or referral rewards. Several of these are obvious next features for a catering business — but every one of them must exist before it appears in the listing.

---

## Cash on Delivery

COD is implemented end to end and is worth describing accurately in your review notes, because it is the one flow where an order is **confirmed but not paid for**.

**How the customer uses it.** At checkout there is a single clearly-labelled tick box: **"Cash on Delivery — Pay SAR 45.00 in cash to the rider when your food arrives."** Leaving it unticked pays by card, and the screen says so explicitly. Ticking it changes the summary row, the submit button and the confirmation message so there is no ambiguity about what was chosen. Once ticked, the customer is reminded to have the exact amount ready.

**Where it is offered.** One-off orders, extras on an existing delivery, and guest portions.

**Where it is not.** Meal plan subscriptions. A plan is billed up front for a whole run of deliveries, so there is no single door at which to collect it; the API rejects `gateway=cash` on `POST /subscriptions` with a plain-language message.

**What happens behind it.**
1. The order is created and **immediately confirmed** — the kitchen must cook it, so placement is the commitment.
2. Its payment row stays `pending` with **no checkout URL**, which is what stops any "Pay now" button appearing.
3. **No invoice is issued and no revenue is booked** at this point. An order refused at the door must not already be in the finance reports.
4. When the rider hands the cash in, an admin calls `POST /admin/finance/payments/{payment}/collect`. *That* fires `PaymentSucceeded`, which issues the invoice and books the revenue. It is idempotent and refuses non-cash payments.

**Operational limits** (backend `.env`):
- `PAYMENT_CASH_ENABLED=true` — kill switch; withdraw cash for a region or a rider shortage with no deploy.
- `PAYMENT_CASH_MAX_AMOUNT=500` — the float a rider is expected to carry. Above it the order must be prepaid. Enforced server-side; the checkbox greys itself out and explains why.

**Play policy note.** COD is a real-world transaction for physical goods delivered outside the app, so Google Play Billing does **not** apply. This is the same exemption every food-delivery app relies on. State it plainly in your review notes.

---

## Data safety

Complete the Play Console **Data safety** form to match this. Getting it wrong is a common rejection.

### Data collected

| Data type | Collected | Shared | Purpose | Optional? |
|---|---|---|---|---|
| Name | Yes | No | Account management, delivery | Required |
| Email address | Yes | No | Account management, sign-in | Required |
| Phone number | Yes | No | Delivery coordination | Required |
| Physical address | Yes | No | Order fulfilment | Required |
| **Precise location** | Yes | No | Setting the delivery address on a map | **Optional** — can be typed instead |
| Purchase history | Yes | No | Order history, app functionality | Required |
| Payment info | **No** | — | Handled entirely by Mollie / Stripe; card data never touches Ahaar | — |
| User-generated content | Yes | No | Comments on kitchen videos | Optional |
| Crash logs | Yes | Yes (Sentry) | Diagnostics | Optional |
| Diagnostics / performance | Yes | Yes (Sentry) | Diagnostics | Optional |
| App interactions | Yes | Yes (Sentry) | Diagnostics | Optional |
| Device or other IDs | No | — | — | — |
| Advertising ID | **No** | — | No ads, no ad SDKs, no tracking | — |

### Declarations

- ✅ **Data is encrypted in transit** — HTTPS only.
- ✅ **Users can request data deletion** — the in-app account screen offers deletion; provide a web URL too.
- ✅ **Committed to the Play Families Policy**: N/A (not directed at children).
- ❌ **No data is sold.**
- ❌ **No data is shared for advertising or marketing.**

### Third parties receiving data

| Party | What | Why |
|---|---|---|
| Sentry | Crash logs, performance traces, account **ID only** | Diagnostics |
| Google (Sign-In) | Email, name, profile ID | Authentication |
| Google (Maps SDK) | Location while the picker is open | Rendering the map |
| Mollie / Stripe | Payment amount, order reference | Card processing |

Sentry is configured to minimise exposure: `sendDefaultPii: false`, `attachScreenshot: false`, and `beforeSend` strips `Authorization` headers from breadcrumbs. Only the account ID is attached — never name, email or address.

---

## Permissions

The release manifest declares exactly five permissions. Everything an autolinked library tried to add is explicitly stripped with `tools:node="remove"` in `app.json` → `android.blockedPermissions`.

| Permission | Why | Prompted? |
|---|---|---|
| `INTERNET` | Every API call | No |
| `ACCESS_NETWORK_STATE` | Offline banner, query retry behaviour | No |
| `ACCESS_COARSE_LOCATION` | Centre the address map near the customer | Yes, at use |
| `ACCESS_FINE_LOCATION` | Accurate pin placement for delivery | Yes, at use |
| `VIBRATE` | Haptic feedback | No |

**Explicitly blocked:** `ACCESS_BACKGROUND_LOCATION`, `CAMERA`, `RECORD_AUDIO`, `READ/WRITE_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES/VIDEO/AUDIO`, `SYSTEM_ALERT_WINDOW`.

**Location declaration.** Foreground only, and only while the address picker is open. There is **no** background location access, so the Play Console location-permission declaration form should say so. The in-app rationale string is: *"Ahaar uses your location to place your delivery address on the map."* Location is genuinely optional — an address can be typed by hand.

No sensitive permissions (SMS, call log, `QUERY_ALL_PACKAGES`, `MANAGE_EXTERNAL_STORAGE`) are requested, so no additional declaration forms are needed.

---

## Content rating

Complete the IARC questionnaire. Expected answers for this app:

| Question | Answer |
|---|---|
| Violence, sexuality, profanity, drugs | None |
| Gambling / simulated gambling | None |
| **Users can interact with each other** | **Yes** — comments on kitchen videos |
| Shares user location with other users | No |
| Allows purchase of digital goods | No |
| **Allows purchase of physical goods** | **Yes** — food |
| Unrestricted internet access | No |

**Expected rating:** Everyone / PEGI 3 / 3+.

⚠ Answering *yes* to user interaction means Play expects moderation. Have a plan for the comment feature: profanity filtering, a report path, and the ability to remove a comment and suspend an account. The API already supports comment deletion.

### Target audience

- **Target age group:** 18+ (a commerce app that takes payment and a delivery address)
- **Appeals to children?** No
- **Ads?** None

---

## Required assets

### App icon
- **1024 × 1024 px**, 32-bit PNG, **no alpha/transparency**, no rounded corners (Play applies its own masking).
- **Upload `assets/store/play-store-icon.png`.** ✅ Generated for this purpose: 1024 × 1024, 24-bit RGB, verified fully opaque.

The original `assets/images/images/ahaar2-adaptive.png` **contains fully transparent pixels** (verified — minimum alpha 0). That is exactly right for the Android adaptive-icon foreground, where the system supplies the background and the transparency is what lets the mask work. It is exactly wrong for the Play Console listing icon, which is **rejected** if it has an alpha channel.

So the two are now split deliberately:

| Use | File | Transparency |
|---|---|---|
| Play Console listing icon | `assets/store/play-store-icon.png` | None — flattened onto white |
| `app.json` → `icon` (legacy launcher fallback) | `assets/store/play-store-icon.png` | None |
| `app.json` → `android.adaptiveIcon.foregroundImage` | `assets/images/images/ahaar2-adaptive.png` | Yes — required |
| `android.adaptiveIcon.monochromeImage` (themed icons) | `assets/images/images/ahaar2-adaptive.png` | Yes — required |

If you rebrand, regenerate the store icon by flattening the new artwork onto an opaque background at 1024 × 1024 — do not just rename the adaptive source.

### Feature graphic
- **1024 × 500 px**, PNG or JPG, no transparency. **Required.**
- Shown at the top of your listing and in promotional placements.
- Keep text minimal and well inside the centre — the edges get cropped on some surfaces.
- Suggested: the Ahaar logo on the brand pink (`#ff2b85`) with a plated meal photo, plus a short line such as *"Fresh meals, delivered daily."*

### Phone screenshots
- **Minimum 2, maximum 8.** Supply **6–8**.
- 16:9 or 9:16, each side between **320 px and 3840 px**. Recommended: **1080 × 1920**.
- PNG or JPG, no transparency.

### Tablet screenshots
Optional. `supportsTablet` is `false` for iOS and the layouts are phone-first, so **skip these** rather than ship stretched phone shots.

### Recommended screenshot list

Capture on a clean device with realistic data — no Lorem Ipsum, no empty states, no debug banners.

Ordered so the first three carry the three pillars — most shoppers never swipe past screenshot three, so quality, price and speed all have to land before they stop.

| # | Screen | Caption | Pillar |
|---|---|---|---|
| 1 | Home with plans and promos | **Chef-cooked food, fresh every day** | Quality |
| 2 | Plan detail with the weekly menu | **A whole week of meals, one flat price** | Price |
| 3 | Foods tab browsing the catalogue | **Order in seconds, delivered on time** | Speed |
| 4 | Meal box / package detail | **Complete meals for less than à la carte** | Price |
| 5 | **Checkout with the Cash on Delivery box ticked** | **Pay by card — or cash at the door** | Price |
| 6 | Kitchen video feed | **Watch your food being made** | Quality |
| 7 | Delivery schedule / day view | **See your whole week at a glance** | Speed |
| 8 | Meal swap sheet | **Swap any dish, any week, no fees** | Quality |

Two of these earn their place for specific reasons:

- **Screenshot 4 (meal boxes)** is the clearest single image of the price pillar — a complete meal at one visible price, next to what the dishes would cost separately. It does more for the "affordable" claim than any caption can.
- **Screenshot 5 (Cash on Delivery)** is worth including deliberately. COD is a genuine differentiator in this market, and a reviewer who sees the tick box up front has far less ambiguity about how payment works.

### Promo video
Optional. A YouTube URL, 30 s – 2 min. Skip for v1.

---

## Policy documents

### Privacy policy requirements

**Mandatory.** Must be a live, publicly reachable URL (no login, no PDF-only), linked both in the Play Console and from inside the app. Suggested: `https://www.ahaar.store/privacy`.

Must cover:
- **Who you are** — legal entity name, registered address, contact email.
- **What is collected** — name, email, phone, delivery addresses, precise location (optional), order and payment history, comments, crash diagnostics. Must match the Data safety form exactly.
- **Why** — fulfilling orders, taking payment, support, diagnostics.
- **Legal basis** — contract performance for orders; consent for optional location and diagnostics.
- **Who it is shared with** — Sentry, Google (Sign-In, Maps), Mollie/Stripe. Name them.
- **Retention** — how long order and account records are kept.
- **User rights** — access, correction, export, deletion, and how to exercise them.
- **Account deletion** — see below.
- **Children** — not directed at under-18s.
- **Cookies/tracking** — state plainly that there is no advertising ID and no ad tracking.
- **Contact** — a real, monitored privacy email.
- **Last updated** date.

### Account deletion (mandatory for apps with sign-in)

Play requires **both**:
1. **In-app** deletion — present on the account screen.
2. **A web URL** reachable without installing the app, e.g. `https://www.ahaar.store/account/delete`. Enter this in Play Console → App content → Data deletion.

State clearly what is deleted immediately versus what is retained for legal/accounting reasons (invoices and order records typically must be kept for a statutory period).

### Terms & conditions

Not strictly required by Play but expected for a commerce app. Suggested: `https://www.ahaar.store/terms`. Should cover: who the contract is with, ordering and acceptance, pricing and tax (**state the currency explicitly** — see Blocker 1), delivery areas and time slots, cutoff times and what they mean, subscription duration, renewal and pause rules, cancellation and refunds, COD obligations, acceptable use of comments, liability, and governing law.

### Refund / cancellation policy

Food is perishable and made to order, so the usual distance-selling cooling-off period generally does not apply — but you must **say so explicitly**. Document:

- **Before cutoff** — orders and individual deliveries can be changed, swapped or cancelled. The app shows a live cutoff on every meal.
- **After cutoff** — the food is being prepared and the order cannot be cancelled.
- **Subscriptions** — how to cancel, whether the remaining run is refunded pro-rata, and how pause interacts with the end date. The backend has a `RefundPolicyService` that computes a refundable amount — your published policy must match what it actually does.
- **Failed or late delivery** — what the customer is entitled to.
- **Quality complaints** — the window and the process.
- **Cash on delivery** — what happens when an order is **refused at the door**. This is the case COD introduces and it needs a written answer: the food is cooked and the payment stays uncollected. Decide whether the order is cancelled and written off, whether repeat refusals disable COD for that account, and say so.
- **Refund timing** — card refunds go back through the gateway; cash refunds are handed back in cash and recorded manually.

---

## Contact & developer information

Fill these in before submitting.

### Store listing contact details
| Field | Value |
|---|---|
| Email | `support@ahaar.store` *(required, publicly shown)* |
| Phone | *(optional, publicly shown)* |
| Website | `https://www.ahaar.store` |
| Privacy Policy | `https://www.ahaar.store/privacy` |

### Developer account
| Field | Value |
|---|---|
| Developer name | *(publicly shown — must match your verified identity)* |
| Legal entity | |
| Registered address | *(publicly shown for organisation accounts)* |
| D-U-N-S number | *(required for organisation accounts)* |
| Contact email | *(verified, not public)* |

⚠ Google requires identity verification for all developer accounts, and **new personal accounts must run a 14-day closed test with at least 12 testers** before they can apply for production access. Organisation accounts are exempt. Check which applies to you early — it is the single most common cause of a delayed first launch.

### App access (for reviewers)

Parts of the app need an account. Provide credentials in **Play Console → App content → App access**, or review will be blocked.

```
Sign-in required: Yes
Email:    reviewer@ahaar.store
Password: <create a real, working test account>

Notes for the reviewer:
- Browsing the menu, plans and kitchen videos needs no account.
- An account is required to place an order or subscribe.
- Cash on Delivery: on the order screen, tick the "Cash on Delivery"
  checkbox before pressing "Place order". The order is confirmed
  immediately and paid in cash to the courier on arrival — a physical
  goods transaction outside the app, so Google Play Billing does not apply.
- Card payments use Mollie/Stripe test mode on this build.
```

Make sure the test account has a saved delivery address inside a covered area, or the reviewer will hit an empty state and may fail the submission.

---

## Release checklist

### Pre-build

- [ ] **Blocker 1** — `PAYMENT_CURRENCY` decided and set on the backend
- [ ] **Blocker 2** — `EXPO_PUBLIC_SENTRY_DSN` set as an EAS production env var
- [ ] **Blocker 3** — `GOOGLE_MAPS_ANDROID_API_KEY` set as an EAS env var **and restricted** by package + SHA-1
- [ ] **Blocker 4** — Play App Signing SHA-1 added to the Android OAuth client
- [ ] **Blocker 5** — Privacy Policy and Terms live and publicly reachable
- [ ] Backend deployed, `api.ahaar.store` reachable over HTTPS with a valid certificate
- [ ] `PAYMENT_CASH_ENABLED` and `PAYMENT_CASH_MAX_AMOUNT` set deliberately
- [ ] Live gateway credentials (`MOLLIE_KEY` / `STRIPE_*`) set; `PAYMENT_DEFAULT_GATEWAY` correct
- [ ] `LOCATION_SUPPORTED_COUNTRIES` — **remove `BD`**, it is there for testing only
- [ ] Reviewer test account created, with a saved address in a covered area
- [ ] Version name in `app.json` is correct for this release

### Verify the code

```bash
pnpm verify      # typecheck + lint + tests + expo-doctor
```

Current state of this branch: TypeScript clean · ESLint 0 errors 0 warnings · **132 tests across 26 suites passing** · expo-doctor 21/21.

Backend: `php artisan test` — **279 tests, 1230 assertions passing** (includes 10 new Cash-on-Delivery tests).

- [ ] `pnpm verify` passes
- [ ] `php artisan test` passes in the backend
- [ ] No `console.log` of customer data left in changed code
- [ ] No secrets in the repo (`.env.local` is gitignored — confirm it is not committed)

### Production build

```bash
eas build --platform android --profile production
```

- [ ] Profile produces an **AAB** (`buildType: "app-bundle"`) — Play rejects APKs for new apps
- [ ] `distribution: "store"`
- [ ] `autoIncrement: true` so the version code rises on every build
- [ ] Build succeeds and the artifact downloads
- [ ] Install the AAB on a real device via internal testing and smoke-test it

Need a sideloadable APK for manual QA? Use the `production-apk` profile — same config, APK output.

### Pre-release testing (on a real device, release build)

Emulators hide signing, Maps and Google Sign-In problems. Test on hardware.

- [ ] Cold start: splash → home, no crash, no hang
- [ ] Offline: airplane mode shows the offline banner; cached content still renders; recovery works
- [ ] Register a new account, verify the welcome flow
- [ ] Sign in with email + password
- [ ] **Sign in with Google** — the #1 thing that works in dev and fails in release
- [ ] Password reset email arrives and the link works
- [ ] Browse plans, dishes, meal boxes and kitchen videos **signed out**
- [ ] Post and delete a comment
- [ ] Address: map picker, GPS, manual entry, saving, switching default
- [ ] **Google map renders** (not grey) — if grey, Blocker 3 is not closed
- [ ] Place a **card** order end to end; the gateway sheet opens and returns correctly
- [ ] Place a **Cash on Delivery** order: tick the box, confirm the button and summary change, place it
- [ ] The COD order shows **"Pay on delivery"**, not "Awaiting payment", and offers no "Pay now" button
- [ ] COD is **absent or rejected** on subscription checkout
- [ ] COD box **greys out** above `PAYMENT_CASH_MAX_AMOUNT` and explains why
- [ ] Admin `POST /admin/finance/payments/{id}/collect` flips it to Paid and issues the invoice
- [ ] Subscribe to a plan, verify the schedule generates for the full duration
- [ ] Swap a meal; add an extra; add guest portions
- [ ] Pause and resume a subscription
- [ ] **"Load more"** works on Foods, Media, comments, Orders and Payments — and disappears on the last page
- [ ] Deep link `ahaarapp://` opens the app
- [ ] Rotate / large font size / dark mode — no broken layouts
- [ ] Back gesture behaves on Android 13+
- [ ] Sign out clears private data; the public catalogue still renders

### Play Console setup

- [ ] App created; package name `com.sohagexpo.ahaarapp` (**permanent — cannot be changed**)
- [ ] Store listing: title, short and full description
- [ ] App icon (1024×1024, no alpha)
- [ ] Feature graphic (1024×500)
- [ ] 6–8 phone screenshots
- [ ] Category: Food & Drink
- [ ] Contact details and website
- [ ] Privacy Policy URL
- [ ] **Data safety** form completed to match the table above
- [ ] **Content rating** questionnaire completed
- [ ] **Target audience** set to 18+
- [ ] **App access** — reviewer credentials and COD notes provided
- [ ] **Ads** — declared as containing no ads
- [ ] **Data deletion** URL provided
- [ ] News app: No · COVID-19 app: No · Government app: No
- [ ] Financial features: **None** — COD and card checkout for physical goods is not a financial feature
- [ ] Countries/regions selected (Saudi Arabia at minimum)
- [ ] Play App Signing enrolled

### Rollout

- [ ] Upload the AAB to **Internal testing** first
- [ ] Verify on at least two physical devices, different Android versions
- [ ] Promote to **Closed testing** (mandatory 14 days × 12 testers for new personal accounts)
- [ ] Promote to **Production** with a **staged rollout** — start at 10–20%
- [ ] Watch Sentry and the Play Console vitals (crash rate, ANR rate) for 24–48 h
- [ ] Ramp to 100% only once the crash-free rate holds above ~99%

**Play's bad-behaviour thresholds:** crash rate ≥ 1.09% or ANR rate ≥ 0.47% of daily sessions will get the app demoted in search. Staged rollout is what protects you.

---

## Build configuration reference

### `eas.json` profiles

| Profile | Output | Distribution | Channel | Use |
|---|---|---|---|---|
| `development` | APK | internal | development | Dev client with the debug menu |
| `preview` | APK | internal | preview | Sideloadable QA build |
| `production` | **AAB** | **store** | production | **Play Store upload** |
| `production-apk` | APK | internal | production | Production config, sideloadable for QA |

### Android configuration
- **Package:** `com.sohagexpo.ahaarapp` (permanent once published)
- **Min SDK / Target SDK / Compile SDK:** Expo SDK 57 defaults (target 36 — comfortably above Play's current floor)
- **Architectures:** `armeabi-v7a`, `arm64-v8a`, `x86`, `x86_64`
- **Hermes:** enabled · **New Architecture:** enabled · **Edge-to-edge:** enabled
- **Orientation:** portrait only
- **Signing:** Play App Signing, with EAS holding the upload key. Run `eas credentials` to inspect. **Never lose the upload key** — losing it means a reset request to Google.

### Over-the-air updates
`expo-updates` is now fully configured: `runtimeVersion` uses the `appVersion` policy and `updates.url` points at the EAS endpoint. An OTA update can ship JS-only fixes to a released build:

```bash
eas update --branch production --message "Fix X"
```

⚠ `runtimeVersion` is tied to `version`, so **bumping `version` in `app.json` breaks OTA compatibility with already-installed builds** — those users need a new store release. Only bump it when you are actually shipping a new binary.

### Deep linking
Scheme-only: `ahaarapp://` and `exp+ahaar-app://`, used chiefly for the OAuth return. There are **no** Android App Links (no verified `https://` domain association and no `assetlinks.json`). If you want `https://ahaar.store/...` links to open the app, that is additional setup — not required for launch.

### Performance notes
- Production JS bundle: **~8 MB** Hermes bytecode, 2,800 modules. Verified building cleanly via `npx expo export --platform android`.
- **~1 MB** of that is the Material Symbols font, pulled in transitively by `expo-router`'s native-tabs feature via `expo-symbols`. This app uses a custom tab bar and never renders those icons. Unavoidable without patching `expo-router`; not worth the risk for 1 MB, but worth knowing if you are chasing size.
- Lists use FlashList with explicit "Load more" paging rather than auto-fetch on scroll, so memory stays bounded and no page is ever fetched that the customer did not ask for.
- Query results are persisted to AsyncStorage, so a cold start renders cached content before the network returns.
- Minification (R8/ProGuard) is **off** by default in Expo's Android template. Enabling it would shrink the APK but risks breaking reflection-based native modules. If you try it, re-run the entire device checklist above — do not enable it on the release you are about to submit.

---

## Post-launch

- [ ] Monitor Sentry for the first 48 h
- [ ] Watch Play Console → Android vitals (crash rate, ANR rate)
- [ ] Respond to reviews — Play weights developer responsiveness
- [ ] Confirm the first real COD orders reconcile correctly through `/collect`
- [ ] Confirm the first real card payments settle in the **expected currency**
- [ ] Keep `targetSdkVersion` current — Play raises the floor annually
