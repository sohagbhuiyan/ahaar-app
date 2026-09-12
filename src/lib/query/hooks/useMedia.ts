/**
 * Media — kitchen videos and the conversation under each one.
 *
 * Videos behave like catalogue data: public, and cached for a while. Comments
 * are a live conversation, so they go stale quickly, and they are keyed by
 * viewer because `is_mine` differs per session (see `queryKeys.media`).
 *
 * Posting is not optimistic. A comment can be refused for its length, for
 * arriving too fast, or because the session lapsed — showing it and then
 * taking it back is worse than the moment it takes the API to answer.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';

import * as mediaApi from '../../api/endpoints/media';
import type { Paginated } from '../../api/types/common';
import type { MediaComment, MediaVideo } from '../../api/types/media';
import { useAuthStore } from '../../store/useAuthStore';
import { queryKeys } from '../keys';

const VIDEOS_STALE_MS = 5 * 60 * 1000;
const COMMENTS_STALE_MS = 30 * 1000;

type Pages<T> = InfiniteData<Paginated<T>, number>;

function nextPage<T>(last: Paginated<T>): number | undefined {
  const { current_page, last_page } = last.meta;
  return current_page < last_page ? current_page + 1 : undefined;
}

/** Published videos, newest first, flattened for FlashList. */
export function useMediaVideos() {
  return useInfiniteQuery({
    queryKey: queryKeys.media.list(),
    queryFn: ({ pageParam }) => mediaApi.getMediaVideos(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last: Paginated<MediaVideo>) => nextPage(last),
    staleTime: VIDEOS_STALE_MS,
    select: (data) => data.pages.flatMap((page) => page.data),
  });
}

export function useMediaVideo(id: string | number | undefined) {
  return useQuery({
    queryKey: queryKeys.media.detail(id ?? ''),
    queryFn: () => mediaApi.getMediaVideo(id!),
    enabled: id !== undefined && id !== '',
    staleTime: VIDEOS_STALE_MS,
  });
}

/** Whose `is_mine` flags a comments page carries — `null` for a guest. */
function useViewerId(): number | null {
  return useAuthStore((s) => (s.token ? (s.user?.id ?? null) : null));
}

export function useMediaComments(videoId: string | number | undefined) {
  const viewerId = useViewerId();

  return useInfiniteQuery({
    queryKey: queryKeys.media.commentsFor(videoId ?? '', viewerId),
    queryFn: ({ pageParam }) => mediaApi.getMediaComments(videoId!, pageParam),
    enabled: videoId !== undefined && videoId !== '',
    initialPageParam: 1,
    getNextPageParam: (last: Paginated<MediaComment>) => nextPage(last),
    staleTime: COMMENTS_STALE_MS,
    select: (data) => ({
      comments: data.pages.flatMap((page) => page.data),
      total: data.pages[0]?.meta.total ?? 0,
    }),
  });
}

export function useCreateMediaComment(videoId: string | number) {
  const queryClient = useQueryClient();
  const viewerId = useViewerId();

  return useMutation({
    mutationFn: (body: string) => mediaApi.createMediaComment(videoId, body.trim()),

    onSuccess: (comment) => {
      const key = queryKeys.media.commentsFor(videoId, viewerId);
      const loaded = queryClient.getQueryData<Pages<MediaComment>>(key);

      // Straight onto the top of the page the customer is reading. Every other
      // copy is only marked stale — refetching this one now would race the
      // insert for no gain.
      if (loaded) {
        queryClient.setQueryData<Pages<MediaComment>>(key, prependComment(loaded, comment));
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.media.comments(videoId),
        refetchType: loaded ? 'none' : 'active',
      });
      adjustCommentCount(queryClient, videoId, 1);
    },
  });
}

export function useDeleteMediaComment(videoId: string | number) {
  const queryClient = useQueryClient();
  const viewerId = useViewerId();

  return useMutation({
    mutationFn: (commentId: number) => mediaApi.deleteMediaComment(commentId),

    onSuccess: (_result, commentId) => {
      queryClient.setQueryData<Pages<MediaComment>>(
        queryKeys.media.commentsFor(videoId, viewerId),
        (current) => current && removeComment(current, commentId),
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.media.comments(videoId),
        refetchType: 'none',
      });
      adjustCommentCount(queryClient, videoId, -1);
    },
  });
}

function prependComment(
  current: Pages<MediaComment>,
  comment: MediaComment,
): Pages<MediaComment> {
  const [first, ...rest] = current.pages;
  if (!first) return current;

  return {
    ...current,
    pages: [
      {
        ...first,
        data: [comment, ...first.data],
        meta: { ...first.meta, total: first.meta.total + 1 },
      },
      ...rest,
    ],
  };
}

function removeComment(current: Pages<MediaComment>, commentId: number): Pages<MediaComment> {
  return {
    ...current,
    pages: current.pages.map((page, index) => ({
      ...page,
      data: page.data.filter((c) => c.id !== commentId),
      meta:
        index === 0
          ? { ...page.meta, total: Math.max(0, page.meta.total - 1) }
          : page.meta,
    })),
  };
}

/** Keeps the "N comments" on the card and the header in step with the list. */
function adjustCommentCount(
  queryClient: QueryClient,
  videoId: string | number,
  delta: number,
) {
  const apply = (video: MediaVideo): MediaVideo =>
    String(video.id) === String(videoId)
      ? { ...video, comments_count: Math.max(0, video.comments_count + delta) }
      : video;

  queryClient.setQueryData<MediaVideo>(queryKeys.media.detail(videoId), (video) =>
    video ? apply(video) : video,
  );
  queryClient.setQueryData<Pages<MediaVideo>>(queryKeys.media.list(), (list) =>
    list
      ? { ...list, pages: list.pages.map((page) => ({ ...page, data: page.data.map(apply) })) }
      : list,
  );
}
