import { useCallback, useState } from 'react';
import { useEvent, useEventListener } from 'expo';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { FOOD_BLURHASH } from '@/lib/constants/images';
import { cn } from '@/lib/utils';

/** "1:05", "12:40" — or `null` when the length is unknown. */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** The round play glyph drawn over posters and video thumbnails. */
export function PlayBadge({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const glyph = size === 'sm' ? 12 : size === 'lg' ? 28 : 22;

  return (
    <View
      className={cn(
        'items-center justify-center rounded-full',
        size === 'sm' ? 'h-7 w-7 bg-black/60' : 'bg-white/95',
        size === 'md' && 'h-14 w-14',
        size === 'lg' && 'h-[72px] w-[72px]',
      )}
      style={size === 'sm' ? undefined : BADGE_SHADOW}
    >
      <Svg width={glyph} height={glyph} viewBox="0 0 24 24" style={{ marginLeft: size === 'sm' ? 0 : 3 }}>
        <Path d="M8 5v14l11-7z" fill={size === 'sm' ? '#ffffff' : '#ff2b85'} />
      </Svg>
    </View>
  );
}

const BADGE_SHADOW = {
  shadowColor: '#000000',
  shadowOpacity: 0.25,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 6,
} as const;

interface Props {
  url: string;
  /** Shown until play is pressed. Without one the panel stays plain. */
  posterUrl?: string | null;
  durationSeconds?: number | null;
  /** What the video is of — the dish or the video's title. */
  label: string;
  /**
   * Controlled, so a pager can stop the video when the customer swipes away:
   * setting this back to false unmounts the player and frees it.
   */
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  className?: string;
}

/**
 * A video that costs nothing until someone wants it.
 *
 * The poster renders first; the player — a network stream and a decoder — is
 * only created on press. A detail screen is opened far more often than its
 * video is watched, and nobody should buffer megabytes they never asked for.
 *
 * Once playing, the poster stays up until the first decoded frame is on screen
 * (no black flash), buffering shows a spinner, the end offers a replay, and a
 * stream that fails says so with a retry instead of leaving a silent black box.
 */
export function TapToPlayVideo({
  url,
  posterUrl,
  durationSeconds,
  label,
  playing,
  onPlayingChange,
  className,
}: Props) {
  const duration = formatDuration(durationSeconds);
  // Retrying remounts the player rather than reusing a player that errored.
  const [attempt, setAttempt] = useState(0);

  return (
    <View className={cn('overflow-hidden bg-black', className)}>
      {playing ? (
        <InlinePlayer
          key={attempt}
          url={url}
          label={label}
          posterUrl={posterUrl}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Play video: ${label}`}
          onPress={() => onPlayingChange(true)}
          className="h-full w-full items-center justify-center active:opacity-90"
        >
          {posterUrl ? (
            <Image
              source={{ uri: posterUrl }}
              placeholder={{ blurhash: FOOD_BLURHASH }}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
              style={StyleSheet.absoluteFill}
            />
          ) : null}

          {/* A soft scrim so the white badge reads on a bright poster. */}
          <View style={StyleSheet.absoluteFill} className="bg-black/20" />

          <PlayBadge />

          {duration ? (
            <View className="absolute bottom-3 right-3 rounded-lg bg-black/60 px-2 py-0.5">
              <Text className="text-xs font-semibold text-white">{duration}</Text>
            </View>
          ) : null}
        </Pressable>
      )}
    </View>
  );
}

function InlinePlayer({
  url,
  label,
  posterUrl,
  onRetry,
}: {
  url: string;
  label: string;
  posterUrl?: string | null;
  onRetry: () => void;
}) {
  // Mounted by the press, so starting straight away is what was asked for.
  const player = useVideoPlayer(url, (instance) => {
    // A cooking video is watched, not glanced at.
    instance.keepScreenOnWhilePlaying = true;
    // Only used below to notice the first frame where the view event is late.
    instance.timeUpdateEventInterval = 0.5;
    instance.play();
  });

  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  const [firstFrame, setFirstFrame] = useState(false);
  const [ended, setEnded] = useState(false);

  // `onFirstFrameRender` is the precise signal; playback time moving is the
  // backstop, so the poster can never get stuck over a playing video.
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (currentTime > 0) setFirstFrame(true);
  });
  useEventListener(player, 'playToEnd', () => setEnded(true));

  // Pressing the native play button after the end is a replay too.
  const showReplay = ended && !isPlaying;
  const showPoster = Boolean(posterUrl) && !firstFrame && status !== 'error';
  const showSpinner =
    status !== 'error' && !showReplay && (status === 'loading' || (!firstFrame && isPlaying));

  const replay = () => {
    setEnded(false);
    player.replay();
    player.play();
  };

  // Leaving the screen pauses rather than letting sound run behind another
  // one. Coming back does not resume — the customer pressed play for a screen
  // they have since left.
  useFocusEffect(
    useCallback(
      () => () => {
        try {
          player.pause();
        } catch {
          // Already released: on unmount the player goes before this runs.
        }
      },
      [player],
    ),
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoView
        player={player}
        nativeControls
        allowsPictureInPicture
        fullscreenOptions={{ enable: true }}
        contentFit="contain"
        onFirstFrameRender={() => setFirstFrame(true)}
        style={{ width: '100%', height: '100%' }}
        accessibilityLabel={label}
      />

      {/* Held over the first moments of playback so the frame never flashes
          black. Touch-transparent: the native controls underneath stay live. */}
      {showPoster ? (
        <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
          <Image
            source={{ uri: posterUrl ?? undefined }}
            contentFit="cover"
            cachePolicy="memory-disk"
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}

      {showSpinner ? (
        <View
          testID="video-buffering"
          style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
          className="items-center justify-center"
        >
          <View className="h-14 w-14 items-center justify-center rounded-full bg-black/45">
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        </View>
      ) : null}

      {showReplay ? (
        <View style={StyleSheet.absoluteFill} className="items-center justify-center bg-black/60">
          {posterUrl ? (
            <Image
              source={{ uri: posterUrl }}
              contentFit="cover"
              cachePolicy="memory-disk"
              style={[StyleSheet.absoluteFill, { opacity: 0.35 }]}
            />
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Watch again"
            onPress={replay}
            className="items-center active:opacity-80"
          >
            <View
              className="h-14 w-14 items-center justify-center rounded-full bg-white/95"
              style={BADGE_SHADOW}
            >
              <Svg width={24} height={24} viewBox="0 0 24 24">
                <Path
                  d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"
                  fill="#ff2b85"
                />
              </Svg>
            </View>
            <Text className="mt-2 text-sm font-bold text-white">Watch again</Text>
          </Pressable>
        </View>
      ) : null}

      {status === 'error' ? (
        <View
          style={StyleSheet.absoluteFill}
          className="items-center justify-center bg-black px-8"
        >
          {posterUrl ? (
            <Image
              source={{ uri: posterUrl }}
              contentFit="cover"
              cachePolicy="memory-disk"
              style={[StyleSheet.absoluteFill, { opacity: 0.25 }]}
            />
          ) : null}
          <Text className="text-center text-sm font-bold text-white">
            This video couldn&apos;t be played
          </Text>
          <Text className="mt-1 text-center text-xs text-white/70">
            Check your connection and try again.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            className="mt-4 rounded-full bg-white px-5 py-2 active:opacity-80"
          >
            <Text className="text-sm font-bold text-brand-500">Try again</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
