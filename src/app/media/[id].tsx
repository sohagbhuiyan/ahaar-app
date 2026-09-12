import { useState } from 'react';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
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
import { colors } from '@/lib/theme';
import { formatLongDate } from '@/lib/utils';

/**
 * One kitchen video and the conversation under it.
 *
 * The comment box is pinned to the bottom and rides up with the keyboard
 * (`behavior="padding"` on iOS; Android resizes the window itself), so the
 * newest comments stay readable while typing. Signed out, the box is a prompt
 * that opens the login sheet — see `MediaCommentComposer`.
 */
export default function MediaVideoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: video, isLoading, isError, error, refetch } = useMediaVideo(id);
  const comments = useMediaComments(id);
  const removeComment = useDeleteMediaComment(id ?? '');

  const [playing, setPlaying] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MediaComment | null>(null);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="Kitchen video" />
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
        <ScreenHeader title="Kitchen video" />
        <ErrorState error={error} onRetry={refetch} className="flex-1 justify-center" />
      </SafeAreaView>
    );
  }

  const confirmDelete = () => {
    if (!pendingDelete) return;
    removeComment.mutate(pendingDelete.id, {
      onSuccess: () => {
        setPendingDelete(null);
        toast.success('Comment deleted');
      },
      onError: (e) => {
        setPendingDelete(null);
        toast.error(isApiError(e) ? e.message : 'That comment could not be deleted');
      },
    });
  };

  const header = (
    <View className="pb-2">
      <TapToPlayVideo
        url={video.video_url}
        posterUrl={video.poster_url}
        durationSeconds={video.duration_seconds}
        label={video.title}
        playing={playing}
        onPlayingChange={setPlaying}
        className="aspect-video w-full"
      />

      <View className="px-5 pt-4">
        <Text className="text-xl font-bold text-text-primary">{video.title}</Text>
        {video.published_at ? (
          <Text className="mt-0.5 text-xs text-text-muted">
            {formatLongDate(video.published_at.slice(0, 10))}
          </Text>
        ) : null}
        {video.description ? (
          <Text className="mt-3 text-sm leading-5 text-text-secondary">
            {video.description}
          </Text>
        ) : null}

        <Text className="mt-6 text-base font-bold text-text-primary">
          Comments{video.comments_count > 0 ? ` · ${video.comments_count}` : ''}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'left', 'right']}>
      <ScreenHeader title={video.title} subtitle="Kitchen video" />
      <OfflineBanner />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlashList
          data={comments.data?.comments ?? []}
          keyExtractor={(comment) => String(comment.id)}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <Separator className="mx-5" />}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (comments.hasNextPage && !comments.isFetchingNextPage) comments.fetchNextPage();
          }}
          ListEmptyComponent={
            comments.isLoading ? (
              <View className="px-5 pt-2">
                <SkeletonText lines={3} />
              </View>
            ) : comments.isError ? (
              <ErrorState error={comments.error} onRetry={comments.refetch} />
            ) : (
              <EmptyState
                title="No comments yet"
                description="Be the first to say what you think."
              />
            )
          }
          ListFooterComponent={
            comments.isFetchingNextPage ? (
              <View className="py-6">
                <ActivityIndicator color={colors.brand[500]} />
              </View>
            ) : null
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
        title="Delete your comment?"
        description="It will be removed for everyone. This can't be undone."
        confirmLabel="Delete"
        destructive
        loading={removeComment.isPending}
      />
    </SafeAreaView>
  );
}
