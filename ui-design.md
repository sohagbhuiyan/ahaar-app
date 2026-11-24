# AHAAR Customer App — UI/UX Design Guidelines

## 1. Design Direction

Build a polished, cenematic, premium, food-first mobile ordering experience for AHAAR. The app should feel warm, modern, confident, and rich while remaining fast and practical with animation. Use the AHAAR website as brand inspiration, but design mobile screens for thumb-friendly browsing, plan selection, and ordering—not as a miniature website.

- Support both Android and iOS.
- Keep interactions predictable, quick, accessible, and easy to use one-handed.
- Inspect the existing Expo app, components, navigation, APIs, and dependencies before implementation.
- Preserve existing business logic, API contracts, auth, subscription, checkout, and localization.

## 2. Brand Color Tokens

| Token              | Hex       | Usage                                       |
| ------------------ | --------- | ------------------------------------------- |
| Primary            | `#EA580C` | Main CTA, active tab/icon, important action |
| Secondary          | `#F97316` | Highlights, secondary actions               |
| Accent             | `#FDBA74` | Soft accents and decorative elements        |
| Background         | `#FFF7ED` | Warm app background                         |
| Text               | `#1F1F1F` | Main content text                           |
| Surface            | `#FFFFFF` | Cards, sheets, panels                       |
| Border             | `#FED7AA` | Subtle outlines/dividers                    |
| Online / Success   | `#16A34A` | Positive/success states                     |
| Warning            | `#F59E0B` | Warning states                              |
| Error              | `#DC2626` | Errors/destructive states                   |
| Offline / Disabled | `#94A3B8` | Disabled/unavailable states                 |

### Color usage

- Orange should emphasize actions and selected states, not cover every screen.
- Use warm backgrounds with white surfaces and dark, readable text.
- Use semantic status colors consistently and pair them with labels/icons.
- Check color contrast and focus states. Don't assume white text is readable on every orange shade.
- Avoid overuse of gradients, colored shadows, or large saturated blocks.

## 3. Mobile Visual System

- Modern, clean, food-focused layouts with high-quality food images.
- Clear hierarchy and generous but efficient spacing.
- Consistent rounded cards, subtle borders, and soft elevation only where useful.
- System-friendly typography with strong legibility at small sizes.
- Use consistent icon style and sizes.
- Avoid clutter, redundant information, and unnecessary decoration.

## 4. Meal Plan Cards — Image-First Redesign

Redesign meal-plan cards to feel premium and distinct, with image content managed through the app's existing API/admin workflow where supported. If image upload or plan image fields are missing, inspect the existing backend/admin architecture and recommend or implement a compatible approach without creating an unrelated data system.

Each card should include:

- A prominent meal image with a consistent aspect ratio and sensible crop.
- Duration/type badge (e.g., 7 Days / 30 Days) that remains legible.
- Plan name and short description.
- Price in SAR, clearly formatted.
- Strong, thumb-friendly Choose Plan CTA.
- Optional feature details only if available in the plan data.
- Loading skeleton and fallback image for missing/unavailable image.
- Accessible text labels; do not communicate plan information through imagery alone.

Card layouts should adapt to screen width. Use compact list cards or horizontal carousels only when they improve discoverability and usability; don't make scrolling unnecessarily long.

## 5. Motion, Animations & Native Interaction (Android + iOS)

Animations and transitions must work smoothly on both platforms, using the project's existing compatible libraries and native navigation patterns. Check the Expo SDK and dependency versions before adding packages. Prefer Reanimated/React Native Gesture Handler if already present and appropriately configured.

Recommended:

- Navigation transitions: restrained native-stack transitions, avoiding unnecessary custom effects.
- Button press: subtle scale/opacity or visual feedback, approximately 120–180ms.
- Card selection: smooth border/background/elevation change, approximately 150–220ms.
- Bottom sheets: smooth slide-in/out with appropriate backdrop and keyboard-aware behavior.
- Modal/dialog: restrained fade and scale, approximately 180–300ms.
- Tabs: smooth active indicator/icon/label change without distracting bounce.
- Plan images: subtle entrance or selection feedback, not repeated animation.
- Order progress/status changes: clear animated state transition and haptic feedback where appropriate.
- Loading: lightweight skeleton/shimmer only if performant; avoid excessive animated placeholders.
- Toasts: brief, readable, accessible feedback.
- Pull-to-refresh and list transitions should remain native-feeling.
- Use haptics sparingly and only for meaningful actions (e.g. success/selection), respecting platform conventions.

### Motion rules

- Prioritize responsiveness and perceived speed.
- Avoid heavy animations, looping decorative motion, and excessive parallax.
- Respect reduced-motion/accessibility settings wherever supported.
- Ensure animations don't interfere with scrolling, input, touch, or screen readers.
- Test motion and touch behavior on real Android and iOS devices, not only simulators.

## 6. Mobile Interaction & Layout

- Target comfortable touch areas (around 44–48pt or larger where practical).
- Use safe-area handling for notch/status-bar/home-indicator areas.
- Keyboard-aware forms and bottom sheets; ensure fields/actions remain visible.
- Avoid unnecessary nested scroll views and layout jumps.
- Clear empty, loading, offline, success, and error states.
- Provide confirmation for destructive actions.
- Keep primary actions visible and easy to reach.
- Handle network failures and retries gracefully without duplicate orders.

## 7. Localization

- Fully support English, Bangla, and Arabic.
- Arabic screens must use appropriate RTL layout, alignment, and navigation behavior.
- Use static translation files for UI strings and API-provided translations for dynamic content as established by the project.
- Avoid hardcoded strings and mixed translation systems.
- Test text wrapping, card dimensions, numbers, and currency in all three languages.

## 8. Implementation Guardrails

- Inspect current Expo SDK, router, UI components, styling, animation, and state-management setup first.
- Reuse existing shared components and established app patterns.
- Do not add dependencies or upgrade SDK/packages without validating compatibility.
- Preserve authentication, checkout, plans, ordering, notifications, and backend integrations.
- Keep UI state predictable and avoid unnecessary rerenders.
- Optimize images and lists for mobile performance.
- Make changes incrementally and test Android and iOS.

## 9. Quality Checklist

- [ ] Rich, modern, warm, mobile-first AHAAR visual identity
- [ ] Palette consistent, with readable contrast
- [ ] Image-led plan cards with robust image fallback/loading states
- [ ] Touch-friendly controls and thumb-accessible primary actions
- [ ] Android and iOS transitions/animations tested
- [ ] Safe areas, keyboard, scrolling, and modal behavior correct
- [ ] Loading, empty, offline, error, and success states covered
- [ ] English, Bangla, Arabic and RTL behavior checked
- [ ] Existing business logic/API/order flow preserved
- [ ] Performance and reduced-motion behavior considered
