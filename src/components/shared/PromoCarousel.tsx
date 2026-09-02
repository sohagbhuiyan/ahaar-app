import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { openCmsLink, resolveCmsLink } from '@/lib/cms';
import { shadows } from '@/lib/theme';
import type { HomeBanner } from '@/lib/api/types/home';
import { BANNER_BLURHASH } from '@/lib/constants/images';


interface Props {
  banners: HomeBanner[];
  heading?: string | null;
}

/**
 * Admin-uploaded promo cards.
 *
 * A paging `ScrollView` rather than autoplay: on a phone the carousel is under
 * the customer's thumb, and a slide that moves on its own steals the tap they
 * were about to make. Swipe is the expected gesture here anyway.
 *
 * Card width is measured from the container instead of the window so the
 * horizontal page size stays correct on a tablet or in split view, where the
 * content is narrower than the screen.
 */
export function PromoCarousel({ banners, heading }: Props) {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const [width, setWidth] = useState(windowWidth);
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width <= 0) return;
      setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
    },
    [width],
  );

  if (banners.length === 0) return null;

  return (
    // Own vertical rhythm, so the section below keeps its original spacing when
    // there are no banners and this renders nothing at all.
    <View className="mb-5" onLayout={onLayout}>
      {heading ? (
        <Text className="mb-3 px-5 text-lg font-bold text-text-primary">{heading}</Text>
      ) : null}

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        // Paging snaps to the ScrollView's own width, so each banner is padded
        // to a full page rather than the cards being laid out edge to edge.
        style={{ flexGrow: 0 }}
      >
        {banners.map((banner) => (
          <PromoCard
            key={banner.id}
            banner={banner}
            width={width}
            onPress={() => openCmsLink(banner.cta_url, router)}
          />
        ))}
      </ScrollView>

      {banners.length > 1 ? (
        <View className="mt-3 flex-row justify-center gap-1.5">
          {banners.map((banner, i) => (
            <View
              key={banner.id}
              className={
                i === index ? 'h-1.5 w-5 rounded-full bg-brand-500' : 'h-1.5 w-1.5 rounded-full bg-border'
              }
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PromoCard({
  banner,
  width,
  onPress,
}: {
  banner: HomeBanner;
  width: number;
  onPress: () => void;
}) {
  const hasCopy = Boolean(banner.title || banner.subtitle || banner.cta_label);
  // A banner whose link goes nowhere this app can open is shown as a plain
  // image — a press that silently does nothing is worse than no press target.
  const pressable = resolveCmsLink(banner.cta_url) !== null;

  const card = (
    <View
      className="overflow-hidden rounded-3xl bg-surface-muted"
      style={[{ aspectRatio: 16 / 9 }, shadows.card]}
    >
      {banner.image_url ? (
        <Image
          source={{ uri: banner.image_url }}
          placeholder={{ blurhash: BANNER_BLURHASH }}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          style={{ width: '100%', height: '100%' }}
          accessibilityLabel={banner.alt_text ?? banner.title ?? 'Promotion'}
        />
      ) : null}

      {hasCopy ? (
        <View className="absolute inset-0 justify-end">
          {/* Scrim only where there is text, so a photo-only banner shows
              exactly as the admin uploaded it. */}
          <View className="bg-black/45 p-4">
            {banner.title ? (
              <Text className="text-base font-bold text-text-inverse" numberOfLines={2}>
                {banner.title}
              </Text>
            ) : null}
            {banner.subtitle ? (
              <Text className="mt-0.5 text-xs text-text-inverse/90" numberOfLines={2}>
                {banner.subtitle}
              </Text>
            ) : null}
            {banner.cta_label && pressable ? (
              <View className="mt-2 self-start rounded-full bg-surface px-3 py-1">
                <Text className="text-xs font-bold text-brand-500">{banner.cta_label}</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ width }} className="px-5">
      {pressable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={banner.title ?? banner.alt_text ?? 'Promotion'}
          onPress={onPress}
          className="active:opacity-90"
        >
          {card}
        </Pressable>
      ) : (
        card
      )}
    </View>
  );
}
