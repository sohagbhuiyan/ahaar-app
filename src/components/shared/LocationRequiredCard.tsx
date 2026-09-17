import { Text, View } from 'react-native';

import BrandDecor from '@/components/illustrations/BrandDecor';
import PinIcon from '@/components/icons/PinIcon';
import { PressableScale } from '@/components/ui';
import { colors, shadows } from '@/lib/theme';
import { cn } from '@/lib/utils';

interface Props {
  onPress: () => void;
  className?: string;
}

/**
 * The unmissable ask for a delivery address, shown while none is set.
 *
 * Every plan, order and delivery slot depends on where the food goes, so a
 * missing location is the one gap worth a full-width brand card rather than
 * the quiet "Set delivery location" line in the header. It disappears the
 * moment a location exists.
 */
export function LocationRequiredCard({ onPress, className }: Props) {
  return (
    <PressableScale
      testID="location-required"
      accessibilityRole="button"
      accessibilityLabel="Set your delivery location"
      onPress={onPress}
      className={cn('overflow-hidden rounded-3xl bg-brand-500', className)}
      style={shadows.brand}
    >
      <BrandDecor />

      <View className="flex-row items-center gap-4 p-5 pb-4">
        <View className="h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
          <PinIcon color="#ffffff" size={28} filled />
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-text-inverse">
            Where should we deliver?
          </Text>
          <Text className="mt-0.5 text-xs leading-4 text-white/90">
            Add your address so your plan, orders and delivery times are ready when you are.
          </Text>
        </View>
      </View>

      <View className="mx-5 mb-5 flex-row items-center justify-center gap-2 rounded-2xl bg-surface py-3">
        <PinIcon color={colors.brand[500]} size={18} />
        <Text className="text-sm font-bold text-brand-500">Set delivery location</Text>
      </View>
    </PressableScale>
  );
}
