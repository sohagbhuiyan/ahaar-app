import { useIsRestoring } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { AhaarLogo } from '@/components/shared/AhaarLogo';
import { useAuthHydrated, useOnboardingHydrated } from '@/lib/store';
import { colors, shadows } from '@/lib/theme';

/**
 * Must equal `imageWidth` of the `expo-splash-screen` plugin in app.json: the
 * first frame of this screen draws the disc exactly where the native splash
 * had it, so the hand-over is invisible and the animation simply begins.
 */
const PLATE_SIZE = 200;
/**
 * The artwork's share of the disc's width, matching the plate PNG — see
 * `scripts/build-splash-plate.js`, which explains why the logo sits on a white
 * disc on the pink field rather than straight on it.
 */
const ART_FRACTION = 0.73;
/**
 * `AhaarLogo` is sized by height and draws the whole 378 × 245 file, of which
 * 366 × 234 is artwork. Working back from the artwork width keeps the JS disc
 * and the baked PNG in agreement to the pixel.
 */
const LOGO_HEIGHT = Math.round(
  ((PLATE_SIZE * ART_FRACTION * 378) / 366) * (245 / 378),
);
const LIFT = 36;
const RING_SIZE = 280;
const BAR_WIDTH = 132;

const MIN_VISIBLE_MS = 1800;
const REDUCED_MIN_VISIBLE_MS = 400;
/** However slow start-up is, the app is never held behind the splash longer. */
const MAX_VISIBLE_MS = 5000;
const EXIT_MS = 450;

const TAGLINE = ['Fresh', 'Chef-made', 'Delivered daily'] as const;

let nativeSplashHidden = false;

/** Idempotent: the logo's load and the safety timer can both ask. */
function hideNativeSplash() {
  if (nativeSplashHidden) return;
  nativeSplashHidden = true;
  SplashScreen.hideAsync().catch(() => undefined);
}

/**
 * The opening moment of the app.
 *
 * Takes over from the static native splash on its very first frame, then:
 * the logo settles with a small spring and lifts, soft brand ripples pulse
 * out from behind it, the tagline writes itself in word by word over a slim
 * loading bar, and the whole layer fades up and away to reveal Home.
 *
 * It waits for what the first screen actually needs — the persisted session,
 * the on-disk query cache, and the "have they seen the welcome tour?" flag —
 * so Home appears already filled in rather than flashing skeletons, but shows
 * for at least `MIN_VISIBLE_MS` so a warm start doesn't strobe, and never more
 * than `MAX_VISIBLE_MS`.
 *
 * With "reduce motion" on, the ripples and spring are skipped and the splash
 * is brief. Taps pass straight through while it fades out.
 */
export function AnimatedSplash() {
  const reduceMotion = useReducedMotion();
  const authHydrated = useAuthHydrated();
  const restoring = useIsRestoring();
  // Also waited on, so a first-time visitor never sees Home flick past before
  // `OnboardingGate` redirects them to the welcome tour.
  const onboardingHydrated = useOnboardingHydrated();

  const [minElapsed, setMinElapsed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [finished, setFinished] = useState(false);

  const pop = useSharedValue(1);
  const lift = useSharedValue(0);
  const ripple = useSharedValue(0);
  const intro = useSharedValue(0);
  const progress = useSharedValue(0);
  const exit = useSharedValue(0);

  const leaving =
    (authHydrated && onboardingHydrated && !restoring && minElapsed) || timedOut;

  useEffect(() => {
    const visibleFor = reduceMotion ? REDUCED_MIN_VISIBLE_MS : MIN_VISIBLE_MS;
    const easeOut = Easing.out(Easing.cubic);

    if (!reduceMotion) {
      pop.value = withDelay(
        120,
        withSequence(
          withTiming(0.92, { duration: 160, easing: Easing.out(Easing.quad) }),
          withSpring(1, { damping: 8, stiffness: 150 }),
        ),
      );
      lift.value = withDelay(320, withSpring(-LIFT, { damping: 15, stiffness: 110 }));
      ripple.value = withDelay(
        250,
        withRepeat(withTiming(1, { duration: 1800, easing: easeOut }), -1, false),
      );
    }
    intro.value = withDelay(reduceMotion ? 0 : 420, withTiming(1, { duration: 700, easing: easeOut }));
    progress.value = withTiming(1, { duration: visibleFor, easing: Easing.inOut(Easing.cubic) });

    const minTimer = setTimeout(() => setMinElapsed(true), visibleFor);
    const maxTimer = setTimeout(() => setTimedOut(true), MAX_VISIBLE_MS);
    // Never leave the native splash up because the logo never reported a load.
    const nativeTimer = setTimeout(hideNativeSplash, 1000);

    return () => {
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
      clearTimeout(nativeTimer);
    };
  }, [reduceMotion, pop, lift, ripple, intro, progress]);

  useEffect(() => {
    if (!leaving) return;
    hideNativeSplash();

    const duration = reduceMotion ? 200 : EXIT_MS;
    exit.value = withTiming(1, { duration, easing: Easing.in(Easing.cubic) });
    const timer = setTimeout(() => setFinished(true), duration + 50);
    return () => clearTimeout(timer);
  }, [leaving, reduceMotion, exit]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const liftStyle = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));
  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value * (1 + exit.value * 0.12) }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: intro.value,
    transform: [{ scale: interpolate(intro.value, [0, 1], [0.6, 1]) }],
  }));
  const belowStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
    transform: [{ translateY: interpolate(exit.value, [0, 1], [0, 16]) }],
  }));
  const barFillStyle = useAnimatedStyle(() => ({ width: progress.value * BAR_WIDTH }));
  const barStyle = useAnimatedStyle(() => ({ opacity: intro.value }));

  if (finished) return null;

  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading Ahaar"
      style={[
        StyleSheet.absoluteFill,
        styles.root,
        rootStyle,
        { pointerEvents: leaving ? 'none' : 'auto' },
      ]}
    >
      <Animated.View style={[styles.stage, liftStyle]}>
        <Animated.View style={[styles.glow, glowStyle]} />
        <Ripple progress={ripple} visibility={intro} offset={0} />
        <Ripple progress={ripple} visibility={intro} offset={0.5} />

        {/* The same white disc the native splash just showed, redrawn here so
            the two frames coincide. */}
        <Animated.View style={[styles.plate, logoStyle]}>
          <AhaarLogo height={LOGO_HEIGHT} onLoadEnd={hideNativeSplash} />
        </Animated.View>
      </Animated.View>

      <Animated.View style={[styles.below, belowStyle]}>
        <View style={styles.tagline}>
          {TAGLINE.map((word, index) => (
            <TaglineWord
              key={word}
              word={word}
              index={index}
              progress={intro}
              last={index === TAGLINE.length - 1}
            />
          ))}
        </View>

        <Animated.View style={[styles.bar, barStyle]}>
          <Animated.View style={[styles.barFill, barFillStyle]} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

/** One ring pulsing out from behind the logo; two, half a cycle apart, loop seamlessly. */
function Ripple({
  progress,
  visibility,
  offset,
}: {
  progress: SharedValue<number>;
  visibility: SharedValue<number>;
  offset: number;
}) {
  const style = useAnimatedStyle(() => {
    const t = (progress.value + offset) % 1;
    return {
      opacity: interpolate(t, [0, 0.15, 1], [0, 0.5, 0]) * visibility.value,
      transform: [{ scale: interpolate(t, [0, 1], [0.55, 1.55]) }],
    };
  });

  return <Animated.View style={[styles.ring, style]} />;
}

function TaglineWord({
  word,
  index,
  progress,
  last,
}: {
  word: string;
  index: number;
  progress: SharedValue<number>;
  last: boolean;
}) {
  const style = useAnimatedStyle(() => {
    const start = index * 0.22;
    const value = interpolate(progress.value, [start, start + 0.5], [0, 1], Extrapolation.CLAMP);
    return { opacity: value, transform: [{ translateY: (1 - value) * 10 }] };
  });

  return (
    <Animated.View style={[styles.wordWrap, style]}>
      <Text style={styles.word}>{word}</Text>
      {last ? null : <View style={styles.dot} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 1000,
    elevation: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    // Matches `backgroundColor` of the expo-splash-screen plugin in app.json.
    backgroundColor: colors.brand[500],
  },
  stage: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Every accent on the pink field is white at low alpha rather than a lighter
  // brand step: a tint of the background can only ever be a paler pink, which
  // on #ff2b85 reads as a printing fault rather than light.
  glow: {
    position: 'absolute',
    width: RING_SIZE * 0.92,
    height: RING_SIZE * 0.92,
    borderRadius: RING_SIZE,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  plate: {
    width: PLATE_SIZE,
    height: PLATE_SIZE,
    borderRadius: PLATE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.DEFAULT,
    ...shadows.card,
  },
  below: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    // Clear of the ripple stage, which is lifted along with the plate.
    marginTop: RING_SIZE / 2 - LIFT + 12,
  },
  tagline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  word: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.text.inverse,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  bar: {
    marginTop: 20,
    width: BAR_WIDTH,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  barFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text.inverse,
  },
});
