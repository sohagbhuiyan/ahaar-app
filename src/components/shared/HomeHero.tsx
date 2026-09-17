import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

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
import { shadows } from '@/lib/theme';
import { cn } from '@/lib/utils';

/**
 * The copy the website's hero ships with, kept word for word so a customer who
 * read the site sees the same pitch here. Only used for a field the CMS leaves
 * empty — see `cmsText`.
 */
const DEFAULTS = {
  badge: 'Now delivering across Saudi Arabia',
  title: 'Fresh Food,',
  titleHighlight: 'Delivered Daily',
  subtitle:
    'Healthy, chef-prepared meals delivered straight to your door every day across Saudi Arabia. Pick a plan and start eating better today.',
  image:
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=75',
  primaryCtaLabel: 'Browse Menu',
  primaryCtaUrl: '/menu',
  secondaryCtaLabel: 'View Plans',
  secondaryCtaUrl: '/plans',
  phone: '+966500000000',
  whatsapp: '966500000000',
  ratingValue: '4.9 / 5',
  ratingCaption: '2,000+ reviews',
  stats: [
    { value: '120K+', label: 'Meals delivered' },
    { value: '4.9', label: 'Average rating' },
    { value: '98%', label: 'On-time delivery' },
  ],
};

interface Props {
  /** `GET /home` hero content. `null` renders the shipped copy throughout. */
  content: HeroContent | null;
  className?: string;
}

/**
 * The website hero, laid out for a phone.
 *
 * Same content and the same admin controls as the site — badge, headline with
 * its highlighted half, intro, image with the rating card, two buttons, phone
 * and WhatsApp, and the stat band — stacked into one card instead of two
 * columns. The site's "Next delivery" bubble is left out on purpose: it is
 * decorative copy there, and here the real delivery sits a few pixels above.
 */
export function HomeHero({ content, className }: Props) {
  const router = useRouter();

  const badge = cmsText(content?.badge, DEFAULTS.badge);
  const title = cmsText(content?.title, DEFAULTS.title);
  const highlight = cmsText(content?.title_highlight, DEFAULTS.titleHighlight);
  const subtitle = cmsText(content?.subtitle, DEFAULTS.subtitle);
  const image = resolveCmsImage(content?.image_url, content?.image_path) ?? DEFAULTS.image;

  const primaryUrl = cmsText(content?.primary_cta_url, DEFAULTS.primaryCtaUrl);
  const secondaryUrl = cmsText(content?.secondary_cta_url, DEFAULTS.secondaryCtaUrl);
  const primaryLabel = cmsText(content?.primary_cta_label, DEFAULTS.primaryCtaLabel);
  const secondaryLabel = cmsText(content?.secondary_cta_label, DEFAULTS.secondaryCtaLabel);
  // A link this app has no screen for hides its button rather than dead-ending.
  const showPrimary = Boolean(primaryLabel && resolveCmsLink(primaryUrl));
  const showSecondary = Boolean(secondaryLabel && resolveCmsLink(secondaryUrl));

  const phone = cmsText(content?.phone, DEFAULTS.phone);
  const phoneLink = telHref(phone);
  const whatsapp = whatsappHref(cmsText(content?.whatsapp, DEFAULTS.whatsapp));

  const ratingValue = cmsText(content?.rating_value, DEFAULTS.ratingValue);
  const ratingCaption = cmsText(content?.rating_caption, DEFAULTS.ratingCaption);

  // An admin can clear the stat band on purpose: an empty array hides it, which
  // is why this is `??` on the array and not a length check.
  const stats = (content?.stats ?? DEFAULTS.stats).filter((s) => s.value && s.label).slice(0, 4);

  return (
    <View className={cn('px-5', className)}>
      <View className="overflow-hidden rounded-3xl bg-brand-50" style={shadows.card}>
        <View className="w-full" style={{ aspectRatio: 16 / 10 }}>
          <Image
            source={{ uri: image }}
            placeholder={{ blurhash: FOOD_BLURHASH }}
            contentFit="cover"
            transition={250}
            cachePolicy="memory-disk"
            style={{ width: '100%', height: '100%' }}
            accessibilityLabel="Freshly prepared Ahaar meal"
          />

          {ratingValue ? (
            <View
              className="absolute bottom-3 left-3 flex-row items-center gap-2.5 rounded-2xl bg-surface px-3 py-2"
              style={shadows.card}
            >
              <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-500">
                <Text className="text-sm font-bold text-text-inverse">★</Text>
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

        <View className="p-5">
          {badge ? (
            <View className="flex-row items-center gap-2 self-start rounded-full border border-brand-500 bg-white/70 px-3 py-1">
              <View className="h-2 w-2 rounded-full bg-brand-500" />
              <Text className="text-xs font-semibold text-brand-500">{badge}</Text>
            </View>
          ) : null}

          <Text
            accessibilityRole="header"
            className="mt-3 text-[28px] font-black leading-[34px] text-text-primary"
          >
            {title}
            {highlight ? <Text className="text-brand-500"> {highlight}</Text> : null}
          </Text>

          {subtitle ? (
            <Text className="mt-2 text-sm leading-5 text-text-secondary">{subtitle}</Text>
          ) : null}

          {showPrimary || showSecondary ? (
            <View className="mt-4 flex-row gap-2">
              {showPrimary ? (
                <Button
                  label={primaryLabel}
                  fullWidth={false}
                  className="flex-1"
                  onPress={() => openCmsLink(primaryUrl, router)}
                />
              ) : null}
              {showSecondary ? (
                <Button
                  label={secondaryLabel}
                  variant="outline"
                  fullWidth={false}
                  className="flex-1 border-2 border-brand-500 bg-surface"
                  textClassName="text-brand-500"
                  onPress={() => openCmsLink(secondaryUrl, router)}
                />
              ) : null}
            </View>
          ) : null}

          {phoneLink || whatsapp ? (
            <View className="mt-3 flex-row flex-wrap gap-2">
              {phoneLink ? (
                <ContactChip
                  label={phone}
                  accessibilityLabel={`Call ${phone}`}
                  onPress={() => openCmsLink(phoneLink, router)}
                  icon={<PhoneGlyph />}
                />
              ) : null}
              {whatsapp ? (
                <ContactChip
                  label="Chat on WhatsApp"
                  onPress={() => openCmsLink(whatsapp, router)}
                  icon={<WhatsAppGlyph />}
                  tone="whatsapp"
                />
              ) : null}
            </View>
          ) : null}

          {stats.length > 0 ? (
            <View className="mt-5 flex-row border-t border-brand-100 pt-4">
              {stats.map((stat, index) => (
                <View
                  key={`${stat.label}-${index}`}
                  className={cn('flex-1 items-center px-1', index > 0 && 'border-l border-brand-100')}
                >
                  <Text className="text-xl font-black text-brand-500">{stat.value}</Text>
                  <Text className="mt-0.5 text-center text-[11px] text-text-secondary">
                    {stat.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </View>
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
        stroke="#1a1a2e"
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
