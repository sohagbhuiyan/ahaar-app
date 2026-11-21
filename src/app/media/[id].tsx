import { useState } from 'react';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import {
  MediaCommentComposer,
  MediaCommentItem,
  OfflineBanner,
  ScreenHeader,
  TapToPlayVideo,
} from '@/components/shared';
import {
  AlertDialog,
  EmptyState,
  ErrorState,
  LoadMore,
  Separator,
  Skeleton,
  SkeletonText,
} from '@/components/ui';
import { isApiError } from '@/lib/api/types/common';
import type { MediaComment } from '@/lib/api/types/media';
import {
  useDeleteMediaComment,
  useMediaComments,
  useMediaVideo,
} from '@/lib/query/hooks';
import { useFormatters } from '@/lib/i18n/format';

/**
 * One kitchen video and the conversation under it.
 *
 * The player is pinned under the header, outside the list, the way a video app
 * does it: scrolling through the comments never scrolls a playing video out of
 * sight. The comment box is pinned to the bottom and rides up with the keyboard
 * (`behavior="padding"` on iOS; Android resizes the window itself). Signed out,
 * the box is a prompt that opens the login sheet — see `MediaCommentComposer`.
 */
export default function MediaVideoScreen() {
  const { id, autoplay } = useLocalSearchParams<{ id: string; autoplay?: string }>();

  const { t } = useTranslation();
  const { formatDate } = useFormatters();
  const { data: video, isLoading, isError, error, refetch } = useMediaVideo(id);
  const comments = useMediaComments(id);
  const removeComment = useDeleteMediaComment(id ?? '');

  // Opened by tapping a video's poster, the customer already asked for it to
  // play — making them press play a second time is friction. Opened from the
  // comments, or a deep link without the flag, it waits behind the poster.
  const [playing, setPlaying] = useState(autoplay === '1');
  const [pendingDelete, setPendingDelete] = useState<MediaComment | null>(null);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title={t('catalog.media.kitchenVideo')} />
        <Skeleton className="aspect-video w-full rounded-none" />
        <View className="gap-4 p-5">
          <SkeletonText lines={4} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !video) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title={t('catalog.media.kitchenVideo')} />
        <ErrorState error={error} onRetry={refetch} className="flex-1 justify-center" />
      </SafeAreaView>
    );
  }

  const confirmDelete = () => {
    if (!pendingDelete) return;
    removeComment.mutate(pendingDelete.id, {
      onSuccess: () => {
        setPendingDelete(null);
        toast.success(t('catalog.comments.deleted'));
      },
      onError: (e) => {
        setPendingDelete(null);
        toast.error(isApiError(e) ? e.message : t('catalog.comments.deleteFailed'));
      },
    });
  };

  const total = comments.data?.total ?? video.comments_count;

  const details = (
    <View className="px-5 pb-2 pt-4">
      <Text className="text-xl font-bold text-text-primary">{video.title}</Text>
      {video.published_at ? (
        <Text className="mt-0.5 text-xs text-text-muted">
          {formatDate(video.published_at.slice(0, 10), {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </Text>
      ) : null}
      {video.description ? (
        <Text className="mt-3 text-sm leading-5 text-text-secondary">{video.description}</Text>
      ) : null}

      <Text className="mt-6 text-base font-bold text-text-primary">
        {total > 0
          ? t('catalog.comments.headingWithCount', { count: total })
          : t('catalog.comments.heading')}
      </Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'left', 'right']}>
      <ScreenHeader title={video.title} subtitle={t('catalog.media.kitchenVideo')} />
      <OfflineBanner />

      <TapToPlayVideo
        url={video.video_url}
        posterUrl={video.poster_url}
        durationSeconds={video.duration_seconds}
        label={video.title}
        playing={playing}
        onPlayingChange={setPlaying}
        className="aspect-video w-full"
      />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlashList
          data={comments.data?.comments ?? []}
          keyExtractor={(comment) => String(comment.id)}
          ListHeaderComponent={details}
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <Separator className="mx-5" />}
          ListEmptyComponent={
            comments.isLoading ? (
              <View className="px-5 pt-2">
                <SkeletonText lines={3} />
              </View>
            ) : comments.isError ? (
              <ErrorState error={comments.error} onRetry={comments.refetch} />
            ) : (
              <EmptyState
                title={t('catalog.media.noComments')}
                description={t('catalog.comments.emptyDescription')}
              />
            )
          }
          ListFooterComponent={
            <LoadMore
              hasMore={comments.hasNextPage}
              loading={comments.isFetchingNextPage}
              onPress={() => comments.fetchNextPage()}
              label={t('catalog.comments.loadOlder')}
            />
          }
          renderItem={({ item }) => (
            <View className="px-5">
              <MediaCommentItem comment={item} onDelete={setPendingDelete} />
            </View>
          )}
        />

        <MediaCommentComposer videoId={video.id} />
      </KeyboardAvoidingView>

      <AlertDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title={t('catalog.comments.deleteTitle')}
        description={t('catalog.comments.deleteDescription')}
        confirmLabel={t('common.actions.delete')}
        destructive
        loading={removeComment.isPending}
      />
    </SafeAreaView>
  );
}
