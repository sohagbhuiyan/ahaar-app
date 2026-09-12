import { useCallback } from 'react';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
export function PlayBadge({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const glyph = size === 'sm' ? 12 : 22;

  return (
    <View
      className={cn(
        'items-center justify-center rounded-full bg-black/60',
        size === 'sm' ? 'h-7 w-7' : 'h-14 w-14',
      )}
    >
      <Svg width={glyph} height={glyph} viewBox="0 0 24 24">
        <Path d="M8 5v14l11-7z" fill="#ffffff" />
      </Svg>
    </View>
  );
}

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

  return (
    <View className={cn('overflow-hidden bg-black', className)}>
      {playing ? (
        <InlinePlayer url={url} label={label} />
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

function InlinePlayer({ url, label }: { url: string; label: string }) {
  // Mounted by the press, so starting straight away is what was asked for.
  const player = useVideoPlayer(url, (instance) => {
    instance.play();
  });

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
    <VideoView
      player={player}
      nativeControls
      fullscreenOptions={{ enable: true }}
      contentFit="contain"
      style={{ width: '100%', height: '100%' }}
      accessibilityLabel={label}
    />
  );
}
