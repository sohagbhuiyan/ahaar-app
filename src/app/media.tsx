import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { ActivityIndicator, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MediaVideoCard, OfflineBanner, ScreenHeader } from '@/components/shared';
import { EmptyState, ErrorState, SkeletonCard } from '@/components/ui';
import type { MediaVideo } from '@/lib/api/types/media';
import { useMediaVideos } from '@/lib/query/hooks';
import { colors } from '@/lib/theme';

/**
 * Kitchen videos — how the food is prepared, straight from the kitchen.
 *
 * Public like the catalogue: watching needs no account, only commenting does.
 * The list never plays anything; a video starts on its own screen, when asked.
 */
export default function MediaScreen() {
  const router = useRouter();

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

  const openVideo = (video: MediaVideo) =>
    router.push({ pathname: '/media/[id]', params: { id: String(video.id) } });

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'left', 'right']}>
      <ScreenHeader title="Kitchen videos" subtitle="See how your meals are made" />
      <OfflineBanner />

      <View className="flex-1">
        {isLoading ? (
          <View className="gap-4 px-5 pt-4">
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : isError ? (
          <ErrorState
            error={error}
            onRetry={refetch}
            retrying={isFetching}
            className="flex-1 justify-center"
          />
        ) : (
          <FlashList
            data={videos ?? []}
            keyExtractor={(video) => String(video.id)}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
            ItemSeparatorComponent={() => <View className="h-4" />}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isFetching && !isLoading && !isFetchingNextPage}
                onRefresh={refetch}
              />
            }
            onEndReachedThreshold={0.5}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) fetchNextPage();
            }}
            ListEmptyComponent={
              <EmptyState
                title="No videos yet"
                description="The kitchen hasn't posted anything yet. Check back soon."
              />
            }
            ListFooterComponent={
              isFetchingNextPage ? (
                <View className="py-6">
                  <ActivityIndicator color={colors.brand[500]} />
                </View>
              ) : null
            }
            renderItem={({ item }) => <MediaVideoCard video={item} onPress={openVideo} />}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
