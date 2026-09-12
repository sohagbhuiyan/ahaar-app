import { memo } from 'react';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { Card } from '@/components/ui';
import type { MediaVideo } from '@/lib/api/types/media';
import { FOOD_BLURHASH } from '@/lib/constants/images';
import { cn } from '@/lib/utils';

import { PlayBadge, formatDuration } from './VideoPlayer';

/** "No comments yet" / "1 comment" / "12 comments". */
export function commentCountLabel(count: number): string {
  if (count <= 0) return 'No comments yet';
  return count === 1 ? '1 comment' : `${count} comments`;
}

interface Props {
  video: MediaVideo;
  onPress: (video: MediaVideo) => void;
  className?: string;
}

/**
 * One kitchen video in a feed: its poster with a play badge, the title and how
 * much conversation it has. Pressing opens the video; nothing plays in a list.
 */
function MediaVideoCardComponent({ video, onPress, className }: Props) {
  const duration = formatDuration(video.duration_seconds);

  return (
    <Card onPress={() => onPress(video)} className={cn(className)}>
      <View className="aspect-video w-full items-center justify-center bg-brand-50">
        {video.poster_url ? (
          <Image
            source={{ uri: video.poster_url }}
            placeholder={{ blurhash: FOOD_BLURHASH }}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            style={{ position: 'absolute', width: '100%', height: '100%' }}
            accessibilityLabel={video.title}
          />
        ) : null}

        <PlayBadge />

        {duration ? (
          <View className="absolute bottom-3 right-3 rounded-lg bg-black/60 px-2 py-0.5">
            <Text className="text-xs font-semibold text-white">{duration}</Text>
          </View>
        ) : null}
      </View>

      <View className="p-4">
        <Text numberOfLines={2} className="text-base font-bold text-text-primary">
          {video.title}
        </Text>
        {video.description ? (
          <Text numberOfLines={2} className="mt-1 text-sm text-text-secondary">
            {video.description}
          </Text>
        ) : null}
        <Text className="mt-2 text-xs font-semibold text-text-muted">
          {commentCountLabel(video.comments_count)}
        </Text>
      </View>
    </Card>
  );
}

export const MediaVideoCard = memo(MediaVideoCardComponent);
