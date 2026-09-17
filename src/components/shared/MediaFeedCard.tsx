import { memo } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, Card, SkeletonText } from '@/components/ui';
import type { MediaVideo } from '@/lib/api/types/media';
import { FOOD_BLURHASH } from '@/lib/constants/images';
import { useMediaComments } from '@/lib/query/hooks';
import { cn, formatLongDate } from '@/lib/utils';

import { commentCountLabel } from './MediaVideoCard';
import { formatDuration, PlayBadge } from './VideoPlayer';

/** How many of the newest comments a feed card previews. */
const PREVIEW_COUNT = 2;

interface Props {
  video: MediaVideo;
  /** The poster was pressed: open the video and start it. */
  onPlay: (video: MediaVideo) => void;
  /** The conversation was pressed: open the video without starting it. */
  onOpenComments: (video: MediaVideo) => void;
}

/**
 * One kitchen video in the Media tab, with its conversation underneath.
 *
 * The comment preview is the same query the video's own screen reads, so a
 * card that has been on screen opens into a comment list that is already there.
 * The list renders only the cards in view, which keeps those reads to what the
 * customer actually scrolls past.
 */
function MediaFeedCardComponent({ video, onPlay, onOpenComments }: Props) {
  const comments = useMediaComments(video.id);
  const preview = comments.data?.comments.slice(0, PREVIEW_COUNT) ?? [];
  // The comments page is fresher than the count the video list was cached with.
  const total = comments.data?.total ?? video.comments_count;
  const duration = formatDuration(video.duration_seconds);

  const meta = [
    video.published_at ? formatLongDate(video.published_at.slice(0, 10)) : null,
    commentCountLabel(total),
  ]
    .filter(Boolean)
    .join(' · ');

  const moreLabel =
    total > preview.length
      ? total === 1
        ? 'View the comment'
        : `View all ${total} comments`
      : total > 0
        ? 'Join the conversation'
        : 'Be the first to comment';

  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Play video: ${video.title}`}
        onPress={() => onPlay(video)}
        className="active:opacity-90"
      >
        <View className="aspect-video w-full items-center justify-center bg-brand-900">
          {video.poster_url ? (
            <Image
              source={{ uri: video.poster_url }}
              placeholder={{ blurhash: FOOD_BLURHASH }}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
              style={StyleSheet.absoluteFill}
              accessibilityLabel={video.title}
            />
          ) : null}
          <View style={StyleSheet.absoluteFill} className="bg-black/20" />

          <PlayBadge />

          {duration ? (
            <View className="absolute bottom-3 right-3 rounded-lg bg-black/60 px-2 py-0.5">
              <Text className="text-xs font-semibold text-white">{duration}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      <View className="px-4 pb-3 pt-4">
        <Text numberOfLines={2} className="text-base font-bold text-text-primary">
          {video.title}
        </Text>
        <Text className="mt-0.5 text-xs text-text-muted">{meta}</Text>
        {video.description ? (
          <Text numberOfLines={3} className="mt-2 text-sm leading-5 text-text-secondary">
            {video.description}
          </Text>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          total > 0
            ? `Read ${commentCountLabel(total)} on ${video.title}`
            : `Comment on ${video.title}`
        }
        onPress={() => onOpenComments(video)}
        className="border-t border-border px-4 py-3 active:bg-surface-muted"
      >
        {comments.isLoading && video.comments_count > 0 ? (
          <SkeletonText lines={2} />
        ) : preview.length > 0 ? (
          <View className="gap-2.5">
            {preview.map((comment) => (
              <View key={comment.id} className="flex-row gap-2.5">
                <Avatar name={comment.author.name} size="sm" />
                <View className="flex-1">
                  <Text className="text-xs font-bold text-text-primary">
                    {comment.author.name}
                  </Text>
                  <Text numberOfLines={2} className="text-sm leading-5 text-text-secondary">
                    {comment.body}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <Text
          className={cn('text-sm font-bold text-brand-500', preview.length > 0 && 'mt-3')}
        >
          {moreLabel}
        </Text>
      </Pressable>
    </Card>
  );
}

export const MediaFeedCard = memo(MediaFeedCardComponent);
