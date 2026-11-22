import { useIsFocused, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import BellIcon from '@/components/icons/BellIcon';
import { useIsSignedIn } from '@/lib/query/hooks/useIsSignedIn';
import { useUnreadNotificationCount } from '@/lib/query/hooks/useNotifications';
import { useAuthPromptStore } from '@/lib/store';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/utils';

/** "99+" past two digits, so the badge never outgrows the bell. */
export function badgeLabel(count: number): string {
  return count > 99 ? '99+' : String(count);
}

interface Props {
  className?: string;
}

/**
 * The bell at the end of Home's top bar, with the inbox's unread count.
 *
 * Shown to guests too, the same as the account avatar: tapping it asks them to
 * sign in and then opens the inbox, rather than hiding a feature they can't
 * know exists. The count polls only while Home is focused and the app is in
 * the foreground; a push refreshes it in between.
 *
 * The badge sits on the bell's top *end* corner (`end-0`), so it mirrors with
 * the layout in Arabic.
 */
export function NotificationBell({ className }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const signedIn = useIsSignedIn();
  const promptLogin = useAuthPromptStore((s) => s.prompt);
  const focused = useIsFocused();
  const { count } = useUnreadNotificationCount({ poll: focused });

  const open = () => {
    const go = () => router.push('/notifications');
    if (signedIn) go();
    else promptLogin(t('tracking.notifications.authReason'), go);
  };

  return (
    <Pressable
      testID="notification-bell"
      accessibilityRole="button"
      accessibilityLabel={
        count > 0
          ? t('tracking.notifications.bellUnread', { count })
          : t('tracking.notifications.bell')
      }
      onPress={open}
      hitSlop={8}
      className={cn(
        'h-10 w-10 items-center justify-center rounded-full bg-surface-muted active:opacity-70',
        className,
      )}
    >
      <BellIcon color={colors.text.primary} size={22} />
      {count > 0 ? (
        <View
          testID="notification-bell-badge"
          className="absolute -top-0.5 end-0 h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-surface bg-brand-500 px-1"
        >
          <Text className="text-[10px] font-bold leading-[12px] text-white">
            {badgeLabel(count)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
