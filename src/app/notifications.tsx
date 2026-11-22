import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { toast } from 'sonner-native';

import BellIcon from '@/components/icons/BellIcon';
import { OfflineBanner } from '@/components/shared/OfflineBanner';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { EmptyState, ErrorState, SkeletonCard } from '@/components/ui';
import type { AppNotification } from '@/lib/api/types/notification';
import {
  invalidateForPush,
  pushDataForNotification,
  routeForPush,
} from '@/lib/notifications/routing';
import { useIsSignedIn } from '@/lib/query/hooks/useIsSignedIn';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/lib/query/hooks/useNotifications';
import { useAuthPromptStore } from '@/lib/store';
import { colors } from '@/lib/theme';
import { cn, formatRelativeTime } from '@/lib/utils';

/** Shopping bag: an instant order. */
function OrderGlyph({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 8h14l-1 12H6L5 8Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M9 8V6a3 3 0 0 1 6 0v2" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

/** Covered dish: a subscription meal. */
function MealGlyph({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 16a8 8 0 0 1 16 0H4Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path
        d="M3 19h18M12 8V6.5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function NotificationTypeIcon({ type }: { type: string | null }) {
  const color = colors.brand[500];
  return (
    <View
      testID={`notification-icon-${type ?? 'other'}`}
      className="h-10 w-10 items-center justify-center rounded-full bg-brand-50"
    >
      {type === 'order.status' ? (
        <OrderGlyph color={color} />
      ) : type === 'delivery.status' ? (
        <MealGlyph color={color} />
      ) : (
        <BellIcon color={color} size={20} />
      )}
    </View>
  );
}

interface RowProps {
  notification: AppNotification;
  onPress: (notification: AppNotification) => void;
}

export function NotificationRow({ notification, onPress }: RowProps) {
  const { t } = useTranslation();
  const unread = notification.read_at === null;
  const title = notification.title ?? t('tracking.notifications.fallbackTitle');
  const when = notification.created_at ? formatRelativeTime(notification.created_at) : '';

  return (
    <Pressable
      testID={`notification-${notification.id}`}
      accessibilityRole="button"
      accessibilityLabel={[unread ? t('tracking.notifications.unread') : null, title, notification.body, when]
        .filter(Boolean)
        .join(', ')}
      onPress={() => onPress(notification)}
      className={cn(
        'flex-row items-start gap-3 border-b border-border px-5 py-4 active:bg-surface-muted',
        unread ? 'bg-surface-secondary' : 'bg-surface',
      )}
    >
      <NotificationTypeIcon type={notification.type} />

      <View className="flex-1">
        <View className="flex-row items-start gap-2">
          <Text
            numberOfLines={2}
            className={cn(
              'flex-1 text-sm',
              unread ? 'font-bold text-text-primary' : 'font-semibold text-text-secondary',
            )}
          >
            {title}
          </Text>
          {when ? <Text className="text-xs text-text-muted">{when}</Text> : null}
        </View>
        {notification.body ? (
          <Text numberOfLines={3} className="mt-0.5 text-sm text-text-secondary">
            {notification.body}
          </Text>
        ) : null}
      </View>

      {unread ? (
        <View testID="notification-unread-dot" className="mt-1.5 h-2.5 w-2.5 rounded-full bg-brand-500" />
      ) : null}
    </Pressable>
  );
}

/**
 * The notification inbox — every order and meal update that went out as a
 * push (`GET /notifications`), newest first, so nothing is lost when a push is
 * swiped away or never arrives.
 *
 * Tapping a row marks it read and opens what it's about, exactly like tapping
 * the push did. Rows for something this build can't open (a type it doesn't
 * know, with no order or meal) are still marked read.
 */
export default function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const signedIn = useIsSignedIn();
  const promptLogin = useAuthPromptStore((s) => s.prompt);

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  if (!signedIn) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title={t('tracking.notifications.title')} />
        <EmptyState
          icon={<NotificationTypeIcon type={null} />}
          title={t('tracking.notifications.signInTitle')}
          description={t('tracking.notifications.signInBody')}
          actionLabel={t('common.actions.signIn')}
          onAction={() => promptLogin(t('tracking.notifications.authReason'))}
          className="flex-1 justify-center"
        />
      </SafeAreaView>
    );
  }

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const open = (notification: AppNotification) => {
    if (notification.read_at === null) markRead.mutate(notification);
    const push = pushDataForNotification(notification);
    if (!push) return;
    invalidateForPush(queryClient, push);
    router.push(routeForPush(push));
  };

  const readAll = () =>
    markAllRead.mutate(undefined, {
      onError: () => toast.error(t('tracking.notifications.markAllFailed')),
    });

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader
        title={t('tracking.notifications.title')}
        right={
          unreadCount > 0 ? (
            <Pressable
              testID="mark-all-read"
              accessibilityRole="button"
              onPress={readAll}
              disabled={markAllRead.isPending}
              hitSlop={8}
              className="rounded-full px-2 py-1 active:opacity-70"
            >
              <Text className="text-sm font-bold text-brand-500">
                {t('tracking.notifications.markAllRead')}
              </Text>
            </Pressable>
          ) : null
        }
      />
      <OfflineBanner />

      {isLoading ? (
        <View className="gap-3 p-5">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : isError && items.length === 0 ? (
        <ErrorState error={error} onRetry={refetch} retrying={isFetching} className="flex-1 justify-center" />
      ) : (
        <FlatList
          testID="notifications-list"
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NotificationRow notification={item} onPress={open} />}
          contentContainerStyle={items.length === 0 ? { flexGrow: 1 } : { paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading && !isFetchingNextPage}
              onRefresh={refetch}
              tintColor={colors.brand[500]}
              colors={[colors.brand[500]]}
            />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          ListEmptyComponent={
            <EmptyState
              icon={<NotificationTypeIcon type={null} />}
              title={t('tracking.notifications.emptyTitle')}
              description={t('tracking.notifications.emptyBody')}
              className="flex-1 justify-center"
            />
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator className="py-5" color={colors.brand[500]} />
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}
