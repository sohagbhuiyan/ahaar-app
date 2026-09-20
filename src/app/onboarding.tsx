/**
 * The welcome tour — shown once per install, before anything else.
 *
 * Three cards, swipeable either way, with a "Skip" escape on every one but the
 * last. `OnboardingGate` decides *whether* this screen is shown; this file only
 * decides what happens when it is finished, which is the same for "Skip" and
 * "Get Started": mark it seen, then replace (not push) with the tabs, so the
 * back gesture can't walk a customer back into a tour they just dismissed.
 *
 * The whole tour sits on the brand field, with the food on white cards floating
 * over it. That split is doing real work, not just decoration: two of the three
 * source images are 360 × 360 transparent cut-outs, so they have no background
 * of their own and would be visibly soft stretched full-bleed. A white card
 * keeps them at a size they're sharp at, gives the cut-outs the light surface
 * they were drawn for, and gives the one full-frame photo somewhere consistent
 * to live.
 */
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AhaarLogo } from '@/components/shared/AhaarLogo';
import { Button } from '@/components/ui';
import { useOnboardingStore } from '@/lib/store';
import { colors } from '@/lib/theme';

/**
 * Accents on the brand field.
 *
 * All white at low alpha rather than lighter steps of the brand ramp: tinting
 * #ff2b85 towards white only ever gives a paler pink, which reads as a printing
 * fault next to the real thing. White at 12–35% reads as light falling on the
 * colour, which is what these shapes are for.
 */
const GLOW = 'rgba(255,255,255,0.13)';
const RING = 'rgba(255,255,255,0.32)';
const BODY_TEXT = 'rgba(255,255,255,0.9)';
const SKIP_TEXT = 'rgba(255,255,255,0.82)';

/**
 * The card's lift. `shadows.cardRaised` is a pink shadow, which was right on
 * white and is invisible here — on a pink field only a dark shadow reads.
 */
const CARD_SHADOW = {
  shadowColor: '#4a0020',
  shadowOpacity: 0.28,
  shadowRadius: 28,
  shadowOffset: { width: 0, height: 12 },
  elevation: 10,
} as const;

interface Slide {
  key: string;
  image: number;
  title: string;
  body: string;
  /** Read instead of the picture — the title never describes the food itself. */
  alt: string;
}

/**
 * Three, not four or five: long enough to say what Ahaar is, short enough that
 * nobody reaches for "Skip" out of impatience.
 *
 * The line breaks in `title` are hand-placed. These are display-size headings,
 * and letting them wrap on their own splits them badly on narrow screens.
 */
const SLIDES: Slide[] = [
  {
    key: 'menu',
    image: require('@/assets/images/onboard/dishes.png'),
    title: 'Fresh Food,\nEvery Single Day',
    body: 'A menu that changes daily — homestyle plates, grills and rice dishes, cooked this morning and ready when you are.',
    alt: 'A plate of rice, roast chicken and fresh salad',
  },
  {
    key: 'kitchen',
    image: require('@/assets/images/onboard/kacci.png'),
    title: 'Chef-Made,\nNever Rushed',
    body: 'Our signature kacchi and slow-cooked classics are layered by hand. Real recipes, real kitchens, no shortcuts.',
    alt: 'A clay bowl of kacchi biryani with tender mutton',
  },
  {
    key: 'delivery',
    image: require('@/assets/images/onboard/dessert.avif'),
    title: 'Sweet Endings,\nDelivered Daily',
    body: 'Pick a plan, choose your meals, and we bring them to your door — right down to dessert. Swap or pause any time.',
    alt: 'A plated dessert',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const completeOnboarding = useOnboardingStore((state) => state.completeOnboarding);

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  // The artwork is sized off the height of a card as well as its width, so the
  // decorative rings can't grow past the stage and collide with the heading on
  // a short screen. Seeded with a close estimate — window minus the bars and
  // the footer — so the first frame is already about right and the correction
  // on layout isn't a visible jump.
  const [pageHeight, setPageHeight] = useState(
    () => windowHeight - insets.top - insets.bottom - 220,
  );
  // Mirrored in React state as well as on the UI thread: the worklets above
  // animate off `scrollX`, but the button's label and the Skip button's
  // visibility are ordinary renders and need a plain number.
  const [index, setIndex] = useState(0);

  const isLast = index === SLIDES.length - 1;

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(next, SLIDES.length - 1));
      scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
      // Set eagerly rather than waiting for the scroll to settle, so the last
      // tap of "Continue" turns it into "Get Started" at once. A swipe has no
      // such tell and is picked up by `onMomentumScrollEnd` instead.
      setIndex(clamped);
    },
    [scrollRef, width],
  );

  /** Skip and Get Started land in the same place — see the file header. */
  const finish = useCallback(() => {
    completeOnboarding();
    router.replace('/(tabs)');
  }, [completeOnboarding, router]);

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
    },
    [width],
  );

  // Android's back button steps back through the cards rather than leaving the
  // app mid-tour. On the first card it falls through to the default (exit),
  // which is what someone pressing back on the very first screen expects.
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (index === 0) return false;
      goTo(index - 1);
      return true;
    });

    return () => subscription.remove();
  }, [index, goTo]);

  return (
    <View
      className="flex-1"
      // The colour is set here as well as painted by the gradient, so a frame
      // drawn before the SVG has laid out is still brand pink rather than black.
      style={{ backgroundColor: colors.brand[500], paddingTop: insets.top }}
    >
      <BrandBackdrop />

      {/* The field is brand pink on both platforms regardless of system theme,
          so the bar contents are pinned light rather than left to `auto`. */}
      <StatusBar style="light" />

      {/* Brand mark and the escape hatch. The placeholder keeps the logo from
          drifting sideways when Skip disappears on the last card. */}
      <View className="h-16 flex-row items-center justify-between px-6">
        {/* The logo is orange-and-green artwork drawn for a light surface, so
            it keeps one — straight on the pink its wordmark all but vanishes. */}
        {/* 32, not the header's usual 26: this mark carries a "FOOD CATERING"
            line under the wordmark, which turns to mush much below this. */}
        <View className="rounded-2xl bg-surface px-3 py-1.5" style={CARD_SHADOW}>
          <AhaarLogo height={32} />
        </View>

        {isLast ? (
          <View className="h-10 w-16" />
        ) : (
          <Pressable
            onPress={finish}
            accessibilityRole="button"
            accessibilityLabel="Skip the introduction"
            hitSlop={12}
            className="h-10 w-16 items-end justify-center active:opacity-60"
          >
            <Text className="text-sm font-semibold" style={{ color: SKIP_TEXT }}>
              Skip
            </Text>
          </Pressable>
        )}
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        // Android's default overscroll glow fights the paging and flashes at
        // both ends of a three-card set.
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onLayout={(event) => setPageHeight(event.nativeEvent.layout.height)}
        className="flex-1"
      >
        {SLIDES.map((slide, slideIndex) => (
          <SlideView
            key={slide.key}
            slide={slide}
            index={slideIndex}
            scrollX={scrollX}
            width={width}
            pageHeight={pageHeight}
            reduceMotion={reduceMotion}
          />
        ))}
      </Animated.ScrollView>

      <View
        className="gap-6 px-6 pt-2"
        style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
      >
        <View
          className="flex-row items-center justify-center gap-2"
          accessibilityRole="progressbar"
          accessibilityLabel={`Step ${index + 1} of ${SLIDES.length}`}
        >
          {SLIDES.map((slide, dotIndex) => (
            <Dot key={slide.key} index={dotIndex} scrollX={scrollX} width={width} />
          ))}
        </View>

        {/* White on the brand field rather than the usual brand-on-white: a
            pink button here would sink into its own background. `secondary`
            already carries the brand label colour and a light pressed state;
            only the resting fill needs lifting to pure white. */}
        {/* The wrapper carries the shadow because `Button` doesn't take a
            `style`, and it needs its own background: Android draws `elevation`
            from the view's own shape, and a transparent one casts nothing. */}
        <View className="rounded-2xl bg-surface" style={CARD_SHADOW}>
          <Button
            variant="secondary"
            size="lg"
            className="bg-surface"
            label={isLast ? 'Get Started' : 'Continue'}
            onPress={isLast ? finish : () => goTo(index + 1)}
          />
        </View>
      </View>
    </View>
  );
}

/** Hero takes this share of a card; the copy gets the rest. */
const HERO_FLEX = 1.2;
const COPY_FLEX = 1;

function SlideView({
  slide,
  index,
  scrollX,
  width,
  pageHeight,
  reduceMotion,
}: {
  slide: Slide;
  index: number;
  scrollX: SharedValue<number>;
  width: number;
  pageHeight: number;
  reduceMotion: boolean;
}) {
  const heroHeight = (pageHeight * HERO_FLEX) / (HERO_FLEX + COPY_FLEX);

  // Bounded three ways: by the card's width, by the height of the hero band —
  // so the outer ring below stays inside it on a short screen — and by an
  // absolute cap, past which the 360 px sources would start to look soft.
  const tile = Math.min(width * 0.52, heroHeight * 0.56, 240);
  const disc = tile * 1.38;
  const ring = tile * 1.62;

  // Where this card sits relative to the viewport: one width to the left,
  // centred, one width to the right. Everything below reads off that.
  const range = [(index - 1) * width, index * width, (index + 1) * width];

  const artStyle = useAnimatedStyle(() => {
    if (reduceMotion) return {};
    return {
      opacity: interpolate(scrollX.value, range, [0, 1, 0], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(scrollX.value, range, [0.8, 1, 0.8], Extrapolation.CLAMP) },
        // Drags behind the page as it slides — the parallax that makes the
        // card read as a layer rather than a flat panel.
        {
          translateX: interpolate(
            scrollX.value,
            range,
            [width * 0.2, 0, -width * 0.2],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  const copyStyle = useAnimatedStyle(() => {
    if (reduceMotion) return {};
    return {
      opacity: interpolate(scrollX.value, range, [0, 1, 0], Extrapolation.CLAMP),
      transform: [
        {
          translateY: interpolate(
            scrollX.value,
            range,
            [28, 0, 28],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  return (
    <View style={{ width }} className="flex-1">
      <View style={{ flex: HERO_FLEX }} className="items-center justify-center">
        <Animated.View style={artStyle} className="items-center justify-center">
          {/* Two soft brand shapes behind the card, echoing the splash screen's
              rings so the tour reads as the same app the splash just showed. */}
          <View
            className="absolute rounded-full"
            style={{ width: disc, height: disc, backgroundColor: GLOW }}
          />
          <View
            className="absolute rounded-full border"
            style={{ width: ring, height: ring, borderColor: RING }}
          />

          <View
            className="items-center justify-center overflow-hidden bg-surface"
            // Radius scales with the card so a small screen gets a squircle
            // rather than something close to a circle.
            style={[
              { width: tile, height: tile, borderRadius: tile * 0.22 },
              CARD_SHADOW,
            ]}
          >
            <Image
              source={slide.image}
              // Inset rather than filling the card. Two of the three sources are
              // cut-outs whose food reaches the edge of its frame, and at full
              // bleed the plate runs into the card's rounded corners and gets
              // clipped. Every source is square and so is this box, so `contain`
              // fills it exactly — nothing is cropped or stretched.
              contentFit="contain"
              transition={reduceMotion ? 0 : 260}
              // Bundled assets, so there's nothing to fetch or re-decode later;
              // memory alone avoids writing three copies to disk on first run.
              cachePolicy="memory"
              accessibilityRole="image"
              accessibilityLabel={slide.alt}
              // Softens the corners of the one source that is a full-frame
              // photo; invisible on the cut-outs, which have none to round.
              style={{ width: '88%', height: '88%', borderRadius: tile * 0.1 }}
            />
          </View>
        </Animated.View>
      </View>

      <Animated.View style={[{ flex: COPY_FLEX }, copyStyle]} className="px-7">
        <Text
          accessibilityRole="header"
          className="text-[30px] font-extrabold leading-[38px] tracking-tight text-text-inverse"
        >
          {slide.title}
        </Text>
        <Text className="mt-3 text-base leading-6" style={{ color: BODY_TEXT }}>
          {slide.body}
        </Text>
      </Animated.View>
    </View>
  );
}

/** Widens into a pill on the card you're looking at. */
function Dot({
  index,
  scrollX,
  width,
}: {
  index: number;
  scrollX: SharedValue<number>;
  width: number;
}) {
  const range = [(index - 1) * width, index * width, (index + 1) * width];

  const style = useAnimatedStyle(() => ({
    width: interpolate(scrollX.value, range, [8, 26, 8], Extrapolation.CLAMP),
    opacity: interpolate(scrollX.value, range, [0.4, 1, 0.4], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View
      style={[
        { height: 8, borderRadius: 4, backgroundColor: colors.text.inverse },
        style,
      ]}
    />
  );
}

/**
 * The brand field the whole tour sits on.
 *
 * A gradient rather than a flat fill: a single saturated pink over a full
 * screen goes flat and cheap, while a fall from #ff2b85 to the darker #d4006b
 * gives the page a light source and lets the white cards lift off it. Drawn
 * with `react-native-svg`, which is already in the build — `expo-linear-gradient`
 * would be a new native dependency and so a new binary for everyone.
 */
function BrandBackdrop() {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      // Purely decorative, and it covers the screen — without this it would
      // swallow every touch meant for the cards above it.
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        {/* Ends at 800, not 700. That isn't only taste: the body copy sits
            around 70% down, where a fall to 700 leaves white text at 3.96:1 —
            under AA — while 800 puts it at 5.01:1. */}
        <LinearGradient id="brandField" x1="0" y1="0" x2="0.25" y2="1">
          <Stop offset="0" stopColor={colors.brand[500]} />
          <Stop offset="1" stopColor={colors.brand[800]} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#brandField)" />
    </Svg>
  );
}
