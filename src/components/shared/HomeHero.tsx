import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { I18nManager, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Button } from '@/components/ui';
import type { HeroContent } from '@/lib/api/types/home';
import {
  cmsText,
  openCmsLink,
  resolveCmsImage,
  resolveCmsLink,
  telHref,
  whatsappHref,
} from '@/lib/cms';
import { FOOD_BLURHASH } from '@/lib/constants/images';
import { colors, shadows } from '@/lib/theme';
import { cn } from '@/lib/utils';

/**
 * The copy the website's hero ships with, kept word for word so a customer who
 * read the site sees the same pitch here. Only used for a field the CMS leaves
 * empty — see `cmsText`. Copy lives in `home.json → hero.*`; the values
 * below are the non-translatable defaults.
 */
const DEFAULTS = {
  image:
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=75',
  primaryCtaUrl: '/menu',
  secondaryCtaUrl: '/plans',
  phone: '+966500000000',
  whatsapp: '966500000000',
  ratingValue: '4.9 / 5',
  stats: [
    { value: '120K+', label: 'home.hero.stats.mealsDelivered' },
    { value: '4.9', label: 'home.hero.stats.averageRating' },
    { value: '98%', label: 'home.hero.stats.onTime' },
  ],
};

/** Left-to-right mark: keeps a leading "+" on the left of a phone number in RTL. */
const LRM = '\u200E';

interface Props {
  /** `GET /home` hero content. `null` renders the shipped copy throughout. */
  content: HeroContent | null;
  className?: string;
}

/** Height of the banner photo at the top of the hero. */
const PHOTO_HEIGHT = 300;
/** How far the copy rides up over the photo's faded lower edge. */
const COPY_OVERLAP = 84;

/**
 * The website hero, laid out for a phone — the same banner look as the site's
 * mobile hero.
 *
 * Full-bleed, no card: the admin's hero photo fills the top and melts into the
 * warm canvas (#FFF7ED, the Home background) through a gradient, with the copy
 * riding up over its faded edge — badge, two-tone headline, intro, CTAs, phone
 * and WhatsApp, stats. An orange glow warms the start side behind the copy and
 * a few green and orange leaves sit along the edges. A transparent PNG from the
 * admin shows the same warm canvas through it, so cut-out plates blend in too.
 * The site's "Next delivery" bubble is left out on purpose: it is decorative
 * copy there, and here the real delivery sits a few pixels above.
 */
export function HomeHero({ content, className }: Props) {
  const router = useRouter();
  const { t } = useTranslation();

  const badge = cmsText(content?.badge, t('home.hero.badge'));
  const title = cmsText(content?.title, t('home.hero.title'));
  const highlight = cmsText(content?.title_highlight, t('home.hero.titleHighlight'));
  const subtitle = cmsText(content?.subtitle, t('home.hero.subtitle'));
  const image = resolveCmsImage(content?.image_url, content?.image_path) ?? DEFAULTS.image;

  const primaryUrl = cmsText(content?.primary_cta_url, DEFAULTS.primaryCtaUrl);
  const secondaryUrl = cmsText(content?.secondary_cta_url, DEFAULTS.secondaryCtaUrl);
  const primaryLabel = cmsText(content?.primary_cta_label, t('home.hero.primaryCta'));
  const secondaryLabel = cmsText(content?.secondary_cta_label, t('home.hero.secondaryCta'));
  // A link this app has no screen for hides its button rather than dead-ending.
  const showPrimary = Boolean(primaryLabel && resolveCmsLink(primaryUrl));
  const showSecondary = Boolean(secondaryLabel && resolveCmsLink(secondaryUrl));

  const phone = cmsText(content?.phone, DEFAULTS.phone);
  const phoneLink = telHref(phone);
  const whatsapp = whatsappHref(cmsText(content?.whatsapp, DEFAULTS.whatsapp));

  const ratingValue = cmsText(content?.rating_value, DEFAULTS.ratingValue);
  const ratingCaption = cmsText(content?.rating_caption, t('home.hero.ratingCaption'));

  // An admin can clear the stat band on purpose: an empty array hides it, which
  // is why this is `??` on the array and not a length check.
  const stats = (
    content?.stats ?? DEFAULTS.stats.map((s) => ({ value: s.value, label: t(s.label) }))
  )
    .filter((s) => s.value && s.label)
    .slice(0, 4);

  return (
    <View className={cn('overflow-hidden bg-surface-muted', className)}>
      {/* ── Banner photo, fading down into the warm canvas ─────────────── */}
      <View style={{ height: PHOTO_HEIGHT }}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="heroPhotoWarm" cx="70%" cy="40%" rx="70%" ry="60%">
                <Stop offset="0" stopColor={colors.brand[200]} stopOpacity={1} />
                <Stop offset="1" stopColor={colors.brand[200]} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#heroPhotoWarm)" />
          </Svg>
        </View>
        <Image
          source={{ uri: image }}
          placeholder={{ blurhash: FOOD_BLURHASH }}
          contentFit="cover"
          transition={250}
          cachePolicy="memory-disk"
          style={StyleSheet.absoluteFill}
          accessibilityLabel={t('home.hero.imageAlt')}
        />
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="heroPhotoFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={CANVAS} stopOpacity={0.95} />
                <Stop offset="0.2" stopColor={CANVAS} stopOpacity={0} />
                <Stop offset="0.42" stopColor={CANVAS} stopOpacity={0} />
                <Stop offset="0.72" stopColor={CANVAS} stopOpacity={0.72} />
                <Stop offset="1" stopColor={CANVAS} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#heroPhotoFade)" />
          </Svg>
        </View>

        {ratingValue ? (
          <View
            className="absolute end-4 top-4 flex-row items-center gap-2.5 rounded-2xl border border-white/60 bg-white/85 px-3 py-2"
            style={shadows.card}
          >
            <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-100">
              <Text className="text-sm font-bold text-brand-500">★</Text>
            </View>
            <View>
              <Text className="text-sm font-bold text-text-primary">{ratingValue}</Text>
              {ratingCaption ? (
                <Text className="text-[11px] text-text-secondary">{ratingCaption}</Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>

      {/* Orange glow on the start side, behind the copy. */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', start: -150, top: PHOTO_HEIGHT - 40, width: 420, height: 420 }}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="heroGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={colors.brand[500]} stopOpacity={0.34} />
              <Stop offset="0.45" stopColor={colors.brand[400]} stopOpacity={0.14} />
              <Stop offset="1" stopColor={colors.brand[300]} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#heroGlow)" />
        </Svg>
      </View>

      <HeroLeaves />

      {/* ── Copy, riding up over the photo's faded edge ────────────────── */}
      <View className="items-center px-5 pb-2" style={{ marginTop: -COPY_OVERLAP }}>
        {badge ? (
          <View
            className="flex-row items-center gap-2 rounded-full border border-brand-200 bg-white/90 px-3.5 py-1.5"
            style={shadows.card}
          >
            <View className="h-5 w-5 items-center justify-center rounded-full bg-brand-100">
              <View className="h-2 w-2 rounded-full bg-brand-500" />
            </View>
            <Text className="text-xs font-semibold text-brand-700">{badge}</Text>
          </View>
        ) : null}

        <Text
          accessibilityRole="header"
          className="mt-4 text-center text-[34px] font-black leading-[40px] text-text-primary"
        >
          {title}
          {highlight ? (
            <Text className="text-brand-500">
              {'\n'}
              {highlight}
            </Text>
          ) : null}
        </Text>

        {subtitle ? (
          <Text className="mt-3 text-center text-[15px] leading-6 text-text-secondary">
            {subtitle}
          </Text>
        ) : null}

        {showPrimary ? (
          <View className="mt-6 w-full rounded-full" style={shadows.brand}>
            <Button
              label={primaryLabel}
              className="h-14 rounded-full"
              textClassName="text-base"
              right={<ArrowGlyph />}
              onPress={() => openCmsLink(primaryUrl, router)}
            />
          </View>
        ) : null}

        {showSecondary ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => openCmsLink(secondaryUrl, router)}
            className="mt-3 flex-row items-center gap-3 rounded-full px-2 py-1.5 active:opacity-70"
          >
            <View className="h-11 w-11 items-center justify-center rounded-full border-4 border-white bg-brand-100">
              <CalendarGlyph />
            </View>
            <Text className="text-base font-semibold text-text-primary">{secondaryLabel}</Text>
          </Pressable>
        ) : null}

        {phoneLink || whatsapp ? (
          <View className="mt-4 flex-row flex-wrap justify-center gap-2">
            {phoneLink ? (
              <ContactChip
                label={`${LRM}${phone}`}
                accessibilityLabel={t('home.hero.call', { phone })}
                onPress={() => openCmsLink(phoneLink, router)}
                icon={<PhoneGlyph />}
              />
            ) : null}
            {whatsapp ? (
              <ContactChip
                label={t('home.hero.whatsapp')}
                onPress={() => openCmsLink(whatsapp, router)}
                icon={<WhatsAppGlyph />}
                tone="whatsapp"
              />
            ) : null}
          </View>
        ) : null}

        {stats.length > 0 ? (
          <View className="mt-6 w-full flex-row">
            {stats.map((stat, index) => (
              <View
                key={`${stat.label}-${index}`}
                className={cn('flex-1 items-center px-1', index > 0 && 'border-s border-brand-200')}
              >
                <Text className="text-2xl font-extrabold text-text-primary">{stat.value}</Text>
                <Text className="mt-0.5 text-center text-xs text-text-secondary">{stat.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** The Home background the photo fades into (brand-50 / ui-design.md Background). */
const CANVAS = colors.surface.muted;

/**
 * Leaves along the hero's edges — never behind the copy. Same placement idea
 * as the website: green over the photo's top corners, orange low on the sides.
 */
const LEAVES = [
  { tone: 'green', size: 58, style: { top: 120, start: -14 }, rotate: -25, delay: 0 },
  { tone: 'green', size: 44, style: { top: 70, end: 10 }, rotate: 150, delay: 400 },
  { tone: 'orange', size: 30, style: { top: PHOTO_HEIGHT + 150, end: -6 }, rotate: 200, delay: 800 },
  { tone: 'orange', size: 26, style: { top: PHOTO_HEIGHT + 330, start: 2 }, rotate: 35, delay: 1200 },
] as const;

function HeroLeaves() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {LEAVES.map((leaf, i) => (
        <FloatingLeaf key={i} index={i} {...leaf} />
      ))}
    </View>
  );
}

function FloatingLeaf({
  index,
  tone,
  size,
  style,
  rotate,
  delay,
}: {
  index: number;
  tone: 'green' | 'orange';
  size: number;
  style: { top: number; start?: number; end?: number };
  rotate: number;
  delay: number;
}) {
  const reduceMotion = useReducedMotion();
  const drift = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    drift.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
  }, [reduceMotion, delay, drift]);

  const animated = useAnimatedStyle(() => ({
    transform: [
      { translateY: -6 * drift.value },
      { rotate: `${rotate + 5 * drift.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[{ position: 'absolute', width: size, height: size }, style, animated]}
    >
      <LeafGlyph tone={tone} id={`heroLeaf${index}`} />
    </Animated.View>
  );
}

/** A single leaf with a midrib, in a green or brand-orange gradient. Decorative. */
function LeafGlyph({ tone, id }: { tone: 'green' | 'orange'; id: string }) {
  const [from, to] = tone === 'green' ? ['#86EFAC', '#15803D'] : [colors.brand[300], colors.brand[500]];
  return (
    <Svg width="100%" height="100%" viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id={id} x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor={to} />
          <Stop offset="1" stopColor={from} />
        </LinearGradient>
      </Defs>
      <Path d="M8 58C6 34 20 12 58 6c-2 30-20 50-50 52z" fill={`url(#${id})`} />
      <Path
        d="M8 58C22 42 34 28 50 14"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M22 44l-2-10M30 36l-1-10M38 28l0-9M22 44l10 1M30 36l10 0M38 28l9-1"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth={1.4}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/** "→", pointing the reading direction's way. */
function ArrowGlyph() {
  return (
    <View style={{ transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] }}>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path
          d="M5 12h14M13 6l6 6-6 6"
          stroke={colors.text.inverse}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

function CalendarGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5} width={18} height={16} rx={3} stroke={colors.brand[500]} strokeWidth={2} />
      <Path d="M3 10h18M8 3v4M16 3v4" stroke={colors.brand[500]} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function ContactChip({
  label,
  accessibilityLabel,
  icon,
  onPress,
  tone = 'plain',
}: {
  label: string;
  accessibilityLabel?: string;
  icon: React.ReactNode;
  onPress: () => void;
  tone?: 'plain' | 'whatsapp';
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      className={cn(
        'flex-row items-center gap-2 rounded-full px-4 py-2 active:opacity-80',
        tone === 'whatsapp' ? 'bg-[#25D366]' : 'border border-border bg-white/70',
      )}
    >
      {icon}
      <Text
        className={cn(
          'text-xs font-semibold',
          tone === 'whatsapp' ? 'text-text-inverse' : 'text-text-primary',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PhoneGlyph() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"
        stroke="#1f1f1f"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function WhatsAppGlyph() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      <Path
        fill="#ffffff"
        d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.85.5 3.59 1.45 5.1L2 22l5.2-1.55a9.85 9.85 0 0 0 4.84 1.25h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.06a8.13 8.13 0 0 1-4.15-1.14l-.3-.18-3.09.92.92-3.01-.2-.31a8.11 8.11 0 0 1-1.25-4.43c0-4.49 3.66-8.15 8.15-8.15 4.49 0 8.15 3.66 8.15 8.15-.01 4.5-3.67 8.15-8.23 8.15zm4.47-6.1c-.24-.12-1.43-.7-1.65-.79-.22-.08-.38-.12-.54.12-.16.24-.62.79-.76.95-.14.16-.28.18-.52.06-.24-.12-1-.37-1.9-1.18-.7-.62-1.18-1.39-1.32-1.63-.14-.24-.01-.37.11-.49.12-.12.27-.31.4-.47.13-.16.18-.27.27-.45.09-.18.04-.34-.04-.46-.08-.12-.5-1.2-.68-1.65-.18-.43-.36-.37-.5-.38h-.43c-.14 0-.37.05-.57.27-.2.22-.76.74-.76 1.8 0 1.06.78 2.08.89 2.22.11.14 1.52 2.32 3.69 3.16 1.83.71 2.2.57 2.6.53.4-.04 1.29-.53 1.47-1.04.18-.51.18-.95.13-1.04-.05-.1-.2-.16-.43-.27z"
      />
    </Svg>
  );
}
