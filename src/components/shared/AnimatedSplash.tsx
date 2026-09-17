import { useIsRestoring } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
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

import { useAuthHydrated } from '@/lib/store';
import { colors } from '@/lib/theme';

const LOGO = require('@/assets/images/images/ahaar2.png');

/**
 * Must equal `imageWidth` of the `expo-splash-screen` plugin in app.json: the
 * first frame of this screen draws the logo exactly where the native splash
 * had it, so the hand-over is invisible and the animation simply begins.
 */
const LOGO_WIDTH = 220;
/** ahaar2.png is 677 × 369. */
const LOGO_HEIGHT = Math.round((LOGO_WIDTH * 369) / 677);
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
 * It waits for what the first screen actually needs — the persisted session
 * and the on-disk query cache — so Home appears already filled in rather than
 * flashing skeletons, but shows for at least `MIN_VISIBLE_MS` so a warm start
 * doesn't strobe, and never more than `MAX_VISIBLE_MS`.
 *
 * With "reduce motion" on, the ripples and spring are skipped and the splash
 * is brief. Taps pass straight through while it fades out.
 */
export function AnimatedSplash() {
  const reduceMotion = useReducedMotion();
  const authHydrated = useAuthHydrated();
  const restoring = useIsRestoring();

  const [minElapsed, setMinElapsed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [finished, setFinished] = useState(false);

  const pop = useSharedValue(1);
  const lift = useSharedValue(0);
  const ripple = useSharedValue(0);
  const intro = useSharedValue(0);
  const progress = useSharedValue(0);
  const exit = useSharedValue(0);

  const leaving = (authHydrated && !restoring && minElapsed) || timedOut;

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

        <Animated.View style={logoStyle}>
          <Image
            source={LOGO}
            style={{ width: LOGO_WIDTH, height: LOGO_HEIGHT }}
            resizeMode="contain"
            fadeDuration={0}
            onLoadEnd={hideNativeSplash}
          />
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
    backgroundColor: colors.surface.DEFAULT,
  },
  stage: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: RING_SIZE * 0.92,
    height: RING_SIZE * 0.92,
    borderRadius: RING_SIZE,
    backgroundColor: colors.brand[50],
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.brand[300],
  },
  below: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    marginTop: LOGO_HEIGHT / 2 - LIFT + RING_SIZE / 2 - LOGO_HEIGHT / 2 + 12,
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
    color: colors.text.primary,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 10,
    backgroundColor: colors.brand[500],
  },
  bar: {
    marginTop: 20,
    width: BAR_WIDTH,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: colors.brand[100],
  },
  barFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.brand[500],
  },
});
