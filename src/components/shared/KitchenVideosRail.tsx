import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/ui';
import type { MediaVideo } from '@/lib/api/types/media';
import { FOOD_BLURHASH } from '@/lib/constants/images';
import { useMediaVideos } from '@/lib/query/hooks';
import { shadows } from '@/lib/theme';
import { formatRelativeTime } from '@/lib/utils';

import { commentCountLabel, MediaVideoCard } from './MediaVideoCard';
import { formatDuration, PlayBadge } from './VideoPlayer';

interface Props {
  /** Small brand-coloured label above the title. */
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  /** How many videos to show in total, the featured one included. */
  limit?: number;
  /**
   * `rail`: horizontal cards, optionally led by a large poster (`featureFirst`).
   * `stack`: the newest as a large poster and the rest as compact rows — a
   * short, predictable block for Home, where a sideways rail would be one more
   * carousel among several.
   */
  layout?: 'rail' | 'stack';
  /** `rail` only: lead with the newest video as a large poster. */
  featureFirst?: boolean;
  className?: string;
}

/**
 * The kitchen's videos, wherever a screen wants them.
 *
 * Renders nothing until the kitchen has posted something, so there is never an
 * empty block or a dead "See all". Opening a video starts it straight away —
 * tapping a poster already said "play this". "See all" switches to the Media
 * tab rather than stacking a second copy of the list on top of this screen.
 */
export function KitchenVideosRail({
  eyebrow,
  title = 'From our kitchen',
  subtitle = 'See how your meals are made',
  limit = 6,
  layout = 'rail',
  featureFirst = false,
  className,
}: Props) {
  const router = useRouter();
  const { data: videos } = useMediaVideos();

  if (!videos || videos.length === 0) return null;

  const open = (video: MediaVideo) =>
    router.push({
      pathname: '/media/[id]',
      params: { id: String(video.id), autoplay: '1' },
    });

  const shown = videos.slice(0, Math.max(1, limit));
  const featured = layout === 'stack' || featureFirst ? shown[0] : null;
  const rest = featured ? shown.slice(1) : shown;

  return (
    <View className={className}>
      <View className="mb-3 flex-row items-end justify-between gap-3 px-5">
        <View className="flex-1">
          {eyebrow ? (
            <Text className="text-xs font-bold uppercase tracking-wider text-brand-500">
              {eyebrow}
            </Text>
          ) : null}
          <Text className="text-lg font-bold text-text-primary">{title}</Text>
          {subtitle ? (
            <Text className="mt-0.5 text-sm text-text-secondary">{subtitle}</Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="See all kitchen videos"
          onPress={() => router.navigate('/media')}
          hitSlop={8}
        >
          <Text className="text-sm font-bold text-brand-500">See all</Text>
        </Pressable>
      </View>

      {featured ? <FeaturedVideo video={featured} onPress={() => open(featured)} /> : null}

      {rest.length === 0 ? null : layout === 'stack' ? (
        <View className="mt-3 gap-3 px-5">
          {rest.map((video) => (
            <MediaVideoRow key={video.id} video={video} onPress={() => open(video)} />
          ))}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}
          style={{ flexGrow: 0, marginTop: featured ? 12 : 0 }}
        >
          {rest.map((video) => (
            <MediaVideoCard key={video.id} video={video} className="w-64" onPress={open} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function FeaturedVideo({ video, onPress }: { video: MediaVideo; onPress: () => void }) {
  const duration = formatDuration(video.duration_seconds);

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Play video: ${video.title}`}
      onPress={onPress}
      className="mx-5 overflow-hidden rounded-3xl bg-brand-900"
      style={shadows.card}
    >
      <View className="aspect-video w-full items-center justify-center">
        {video.poster_url ? (
          <Image
            source={{ uri: video.poster_url }}
            placeholder={{ blurhash: FOOD_BLURHASH }}
            contentFit="cover"
            transition={250}
            cachePolicy="memory-disk"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={StyleSheet.absoluteFill} className="bg-black/35" />

        <PlayBadge size="lg" />

        {duration ? (
          <View className="absolute right-3 top-3 rounded-lg bg-black/60 px-2 py-0.5">
            <Text className="text-xs font-semibold text-white">{duration}</Text>
          </View>
        ) : null}

        <View className="absolute bottom-0 left-0 right-0 p-4">
          <Text className="text-[11px] font-bold uppercase tracking-widest text-white/80">
            New from the kitchen
          </Text>
          <Text numberOfLines={2} className="mt-0.5 text-base font-bold text-white">
            {video.title}
          </Text>
          <Text className="mt-0.5 text-xs text-white/75">
            {commentCountLabel(video.comments_count)}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

/** A compact "up next" row: thumbnail on the left, title and meta beside it. */
function MediaVideoRow({ video, onPress }: { video: MediaVideo; onPress: () => void }) {
  const duration = formatDuration(video.duration_seconds);
  const meta = [
    video.published_at ? formatRelativeTime(video.published_at) : null,
    commentCountLabel(video.comments_count),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Play video: ${video.title}`}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-2.5"
      style={shadows.card}
    >
      <View
        className="w-32 items-center justify-center overflow-hidden rounded-xl bg-brand-900"
        style={{ aspectRatio: 16 / 9 }}
      >
        {video.poster_url ? (
          <Image
            source={{ uri: video.poster_url }}
            placeholder={{ blurhash: FOOD_BLURHASH }}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <PlayBadge size="sm" />
        {duration ? (
          <View className="absolute bottom-1 right-1 rounded bg-black/70 px-1">
            <Text className="text-[10px] font-semibold text-white">{duration}</Text>
          </View>
        ) : null}
      </View>

      <View className="flex-1 pr-1">
        <Text numberOfLines={2} className="text-sm font-bold text-text-primary">
          {video.title}
        </Text>
        <Text numberOfLines={1} className="mt-1 text-xs text-text-muted">
          {meta}
        </Text>
      </View>
    </PressableScale>
  );
}
