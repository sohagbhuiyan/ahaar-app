import { FlashList } from '@shopify/flash-list';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MediaFeedCard, OfflineBanner } from '@/components/shared';
import { EmptyState, ErrorState, LoadMore, SkeletonCard } from '@/components/ui';
import type { MediaVideo } from '@/lib/api/types/media';
import { useMediaVideos } from '@/lib/query/hooks';
import { queryKeys } from '@/lib/query/keys';

/**
 * The Media tab — every kitchen video, newest first, each with its latest
 * comments.
 *
 * Public like the catalogue: watching needs no account, only commenting does.
 * Nothing plays in the feed; the poster opens the video and starts it, the
 * comments open it paused, with the conversation in view.
 */
export default function MediaScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: videos,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMediaVideos();

  const play = (video: MediaVideo) =>
    router.push({ pathname: '/media/[id]', params: { id: String(video.id), autoplay: '1' } });

  const openComments = (video: MediaVideo) =>
    router.push({ pathname: '/media/[id]', params: { id: String(video.id) } });

  const refresh = () => {
    refetch();
    // Each card's comment preview is its own query.
    queryClient.invalidateQueries({ queryKey: queryKeys.media.allComments() });
  };

  const header = (
    <View className="pb-4 pt-2">
      <Text className="text-2xl font-bold text-text-primary">Media</Text>
      <Text className="mt-1 text-sm text-text-secondary">
        Straight from the Ahaar kitchen — see how your meals are made, and tell us what you
        think.
      </Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'left', 'right']}>
      <OfflineBanner />

      {isLoading ? (
        <View className="gap-4 px-5">
          {header}
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : isError ? (
        <View className="flex-1 px-5">
          {header}
          <ErrorState
            error={error}
            onRetry={refetch}
            retrying={isFetching}
            className="flex-1 justify-center"
          />
        </View>
      ) : (
        <FlashList
          data={videos ?? []}
          keyExtractor={(video) => String(video.id)}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View className="h-5" />}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading && !isFetchingNextPage}
              onRefresh={refresh}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="No videos yet"
              description="The kitchen hasn't posted anything yet. Check back soon."
            />
          }
          ListFooterComponent={
            <LoadMore
              hasMore={hasNextPage}
              loading={isFetchingNextPage}
              onPress={() => fetchNextPage()}
              label="Load more videos"
              className="px-0"
            />
          }
          renderItem={({ item }) => (
            <MediaFeedCard video={item} onPlay={play} onOpenComments={openComments} />
          )}
        />
      )}
    </SafeAreaView>
  );
}
