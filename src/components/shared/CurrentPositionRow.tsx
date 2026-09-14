import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';

import LocateIcon from '@/components/icons/LocateIcon';
import { Button } from '@/components/ui';
import type { DeviceLocation } from '@/lib/location/useDeviceLocation';
import { colors } from '@/lib/theme';

interface Props {
  device: DeviceLocation;
  onLocate: () => void;
  /** Android switches location on from a system dialog; iOS opens Settings. */
  onTurnOn: () => void;
  /** Offered when GPS can't help — the map always can. */
  onChooseOnMap?: () => void;
  /** Subtitle while idle — what pressing it will do on this screen. */
  hint?: string;
}

/**
 * "Use my current location", with every way it can fail explained in place.
 *
 * Shared by the location sheet and the address form so the permission
 * wording, the Settings/turn-on buttons and the retry rules are the same
 * wherever the customer meets them. A failure never blocks the alternatives.
 */
export function CurrentPositionRow({
  device,
  onLocate,
  onTurnOn,
  onChooseOnMap,
  hint = 'Find me on the map',
}: Props) {
  const busy = device.status === 'requesting' || device.status === 'locating';
  const outside = device.status === 'outside_area';
  const problem =
    device.status === 'denied' ||
    device.status === 'services_off' ||
    device.status === 'unavailable' ||
    outside;

  return (
    <View className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3">
      <Pressable
        testID="use-current-location"
        accessibilityRole="button"
        accessibilityLabel="Use my current location"
        accessibilityState={{ busy, disabled: busy }}
        disabled={busy}
        onPress={onLocate}
        className="flex-row items-center gap-3 active:opacity-70"
      >
        <LocateIcon color={colors.brand[500]} size={22} />
        <View className="flex-1">
          <Text className="text-sm font-bold text-brand-700">Use my current location</Text>
          <Text className="mt-0.5 text-xs text-text-secondary">
            {device.status === 'requesting'
              ? 'Waiting for permission…'
              : device.status === 'locating'
                ? 'Finding where you are…'
                : hint}
          </Text>
        </View>
        {busy ? <ActivityIndicator size="small" color={colors.brand[500]} /> : null}
      </Pressable>

      {problem ? (
        <View testID="location-problem" className="mt-3 border-t border-brand-100 pt-3">
          <Text className="text-xs font-semibold text-text-primary">{device.message}</Text>
          <Text className="mt-0.5 text-xs text-text-muted">
            {outside
              ? 'Search for your address, or place the pin on the map instead.'
              : 'You can still search for your address or choose it on the map.'}
          </Text>

          <View className="mt-2 flex-row flex-wrap gap-2">
            {device.status === 'denied' && !device.canAskAgain ? (
              <Button
                label="Open settings"
                variant="secondary"
                size="sm"
                fullWidth={false}
                onPress={device.openSettings}
              />
            ) : null}
            {device.status === 'services_off' ? (
              <Button
                label={Platform.OS === 'android' ? 'Turn on location' : 'Open settings'}
                variant="secondary"
                size="sm"
                fullWidth={false}
                onPress={onTurnOn}
              />
            ) : null}
            {(device.status === 'denied' && device.canAskAgain) ||
            device.status === 'unavailable' ? (
              <Button
                label="Try again"
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={onLocate}
              />
            ) : null}
            {/* The map never needs permission — whatever went wrong, it's one tap away. */}
            {onChooseOnMap ? (
              <Button
                label="Choose on the map"
                variant="secondary"
                size="sm"
                fullWidth={false}
                onPress={onChooseOnMap}
              />
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}
