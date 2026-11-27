import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import BagIcon from '@/components/icons/BagIcon';
import { useInstantOrderCount } from '@/lib/store';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/utils';

import { badgeLabel } from './NotificationBell';

/**
 * The basket icon in Home's top bar — the app's counterpart of the website's
 * header cart (`ahaar/src/components/cart/CartButton.tsx`).
 *
 * Nothing new underneath: the count is the same selector the Foods tab badge
 * and the "View basket" bar read (`useInstantOrderCount`, dishes + meal boxes),
 * and the tap opens the existing basket/checkout screen (`/order`), which is
 * kept in step with the account cart by the sync engine. So the icon, the tab
 * badge and the basket can never disagree.
 *
 * Shown to guests too: a basket can be filled before signing in, and the
 * sign-in is asked for at checkout, exactly as on the website.
 */
export function CartButton({ className }: { className?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const count = useInstantOrderCount();

  return (
    <Pressable
      testID="cart-button"
      accessibilityRole="button"
      accessibilityLabel={
        count > 0
          ? t('catalog.basket.iconA11yCount', { items: t('common.units.item', { count }) })
          : t('catalog.basket.iconA11y')
      }
      onPress={() => router.push('/order')}
      hitSlop={6}
      className={cn(
        'h-10 w-10 items-center justify-center rounded-full bg-surface-muted active:opacity-70',
        className,
      )}
    >
      <BagIcon color={colors.text.primary} size={22} />
      {count > 0 ? (
        <View
          testID="cart-button-badge"
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
