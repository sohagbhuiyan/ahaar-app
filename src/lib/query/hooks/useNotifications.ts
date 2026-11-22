/**
 * The notification inbox and the bell's unread count.
 *
 * The count polls once a minute, but only while someone can see the bell: the
 * caller passes `focused` (from expo-router's `useIsFocused`; these hooks stay
 * router-free) and the app must be in the foreground. A push refreshes both
 * at once between polls (`invalidateInbox` in `lib/notifications/routing`).
 *
 * Reads and writes are optimistic: tapping a row or "Mark all read" changes
 * the list and the badge immediately, then settles against the server.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import * as notificationsApi from '../../api/endpoints/notifications';
import type { AppNotification, NotificationPage } from '../../api/types/notification';
import { queryKeys } from '../keys';
import { useIsSignedIn } from './useIsSignedIn';
import { useAppActive } from './useTracking';

export const UNREAD_POLL_MS = 60 * 1000;

export interface UnreadCountOptions {
  /** Poll while true (the bell is on a focused screen). Default false. */
  poll?: boolean;
}

/** `GET /notifications/unread-count`. 0 while signed out or loading. */
export function useUnreadNotificationCount({ poll = false }: UnreadCountOptions = {}) {
  const signedIn = useIsSignedIn();
  const appActive = useAppActive();
  const polling = poll && appActive && signedIn;

  const query = useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: notificationsApi.getUnreadNotificationCount,
    enabled: signedIn,
    staleTime: 30 * 1000,
    refetchInterval: polling ? UNREAD_POLL_MS : false,
    refetchIntervalInBackground: false,
  });

  return { ...query, count: signedIn ? (query.data ?? 0) : 0 };
}

function nextPage(last: NotificationPage): number | undefined {
  const { current_page, last_page } = last.meta;
  return current_page < last_page ? current_page + 1 : undefined;
}

type Inbox = InfiniteData<NotificationPage, number>;

/** `GET /notifications`, page by page, newest first. */
export function useNotifications() {
  const signedIn = useIsSignedIn();

  return useInfiniteQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: ({ pageParam }) => notificationsApi.getNotifications({ page: pageParam }),
    enabled: signedIn,
    initialPageParam: 1,
    getNextPageParam: nextPage,
    staleTime: 15 * 1000,
    refetchOnMount: 'always',
    select: (data) => ({
      items: data.pages.flatMap((page) => page.data),
      // The first page is the freshest read of the account-wide count.
      unreadCount: data.pages[0]?.unread_count ?? 0,
    }),
  });
}

/** Apply `change` to every cached row, and keep each page's count in step. */
function patchInbox(
  inbox: Inbox | undefined,
  change: (row: AppNotification) => AppNotification,
  unreadCount: (previous: number) => number,
): Inbox | undefined {
  if (!inbox) return inbox;
  return {
    ...inbox,
    pages: inbox.pages.map((page) => ({
      ...page,
      data: page.data.map(change),
      unread_count: unreadCount(page.unread_count),
    })),
  };
}

function useOptimisticInbox() {
  const queryClient = useQueryClient();

  const snapshot = async () => {
    await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all() });
    return {
      list: queryClient.getQueryData<Inbox>(queryKeys.notifications.list()),
      count: queryClient.getQueryData<number>(queryKeys.notifications.unreadCount()),
    };
  };

  const restore = (previous?: { list?: Inbox; count?: number }) => {
    if (!previous) return;
    queryClient.setQueryData(queryKeys.notifications.list(), previous.list);
    queryClient.setQueryData(queryKeys.notifications.unreadCount(), previous.count);
  };

  const settle = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });

  return { queryClient, snapshot, restore, settle };
}

/** `POST /notifications/{id}/read` */
export function useMarkNotificationRead() {
  const { queryClient, snapshot, restore, settle } = useOptimisticInbox();

  return useMutation({
    mutationFn: (notification: AppNotification) =>
      notificationsApi.markNotificationRead(notification.id),
    onMutate: async (notification) => {
      const previous = await snapshot();
      if (notification.read_at) return previous;
      const now = new Date().toISOString();
      queryClient.setQueryData<Inbox>(queryKeys.notifications.list(), (inbox) =>
        patchInbox(
          inbox,
          (row) => (row.id === notification.id ? { ...row, read_at: now } : row),
          (n) => Math.max(0, n - 1),
        ),
      );
      queryClient.setQueryData<number>(queryKeys.notifications.unreadCount(), (n) =>
        Math.max(0, (n ?? 0) - 1),
      );
      return previous;
    },
    onError: (_error, _notification, previous) => restore(previous),
    onSettled: settle,
  });
}

/** `POST /notifications/read-all` */
export function useMarkAllNotificationsRead() {
  const { queryClient, snapshot, restore, settle } = useOptimisticInbox();

  return useMutation({
    mutationFn: notificationsApi.markAllNotificationsRead,
    onMutate: async () => {
      const previous = await snapshot();
      const now = new Date().toISOString();
      queryClient.setQueryData<Inbox>(queryKeys.notifications.list(), (inbox) =>
        patchInbox(inbox, (row) => (row.read_at ? row : { ...row, read_at: now }), () => 0),
      );
      queryClient.setQueryData<number>(queryKeys.notifications.unreadCount(), 0);
      return previous;
    },
    onError: (_error, _vars, previous) => restore(previous),
    onSettled: settle,
  });
}
