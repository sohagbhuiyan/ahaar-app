import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { toast } from 'sonner-native';

import EditIcon from '@/components/icons/EditIcon';
import PinIcon from '@/components/icons/PinIcon';
import SearchIcon from '@/components/icons/SearchIcon';
import { Badge, Button, Sheet } from '@/components/ui';
import { isApiError } from '@/lib/api/types/common';
import { EMPTY_DRAFT, locationTitle, type AddressDraft } from '@/lib/location/address';
import { countryRules, isSupportedCountry } from '@/lib/location/countries';
import { locationPickerHref, type LocationPickerParams } from '@/lib/location/picker';
import { useDeviceLocation } from '@/lib/location/useDeviceLocation';
import {
  useAddresses,
  useChangeLocation,
  useCurrentLocation,
  useIsSignedIn,
} from '@/lib/query/hooks';
import { useAuthPromptStore, useLocationStore } from '@/lib/store';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/utils';

import { AddressFormSheet } from './AddressFormSheet';
import { CurrentPositionRow } from './CurrentPositionRow';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** A typed address starts empty and says so — stable, so the form doesn't re-seed. */
const MANUAL_DRAFT: AddressDraft = { ...EMPTY_DRAFT, location_source: 'manual' };

/**
 * Change where food is delivered.
 *
 * The map comes first — GPS, search and "choose on the map" all open the
 * full-screen picker, where the pin is placed exactly and the country is read
 * from it rather than assumed. Saved addresses switch in one tap. Typing an
 * address without the map stays available as a fallback, for when maps or
 * location can't be used at all.
 *
 * None of it needs an account: signed out, the choice is kept on the phone and
 * saved to the account at sign-in. Only the delivery address changes — menus,
 * plans, packages and prices are the same everywhere.
 */
export function LocationSheet({ open, onClose }: Props) {
  const router = useRouter();
  const [typing, setTyping] = useState(false);

  const device = useDeviceLocation();
  const current = useCurrentLocation();
  const signedIn = useIsSignedIn();
  const { data: addresses } = useAddresses();
  const { selectAddress, saveLocation, isPending, pendingAddressId } = useChangeLocation();
  const setGuestLocation = useLocationStore((s) => s.setGuestLocation);
  const promptLogin = useAuthPromptStore((s) => s.prompt);

  const finish = () => {
    device.reset();
    setTyping(false);
    onClose();
  };

  const openPicker = (params: LocationPickerParams = {}) => {
    finish();
    router.push(locationPickerHref(params));
  };

  // Permission and "location is off" are explained here, in place; a fix opens
  // the map on it so the pin can be nudged onto the right door.
  const locateMe = async () => {
    const result = await device.locate();
    if (result?.status === 'resolved' && result.draft?.lat != null && result.draft.lng != null) {
      openPicker({ lat: result.draft.lat, lng: result.draft.lng });
    }
  };

  const turnOnLocation = async () => {
    if (await device.enableServices()) await locateMe();
  };

  const pickSaved = async (addressId: number) => {
    if (current.source === 'address' && current.address?.id === addressId) {
      finish();
      return;
    }
    try {
      const address = await selectAddress(addressId);
      toast.success(`Delivering to ${locationTitle(address)}`);
      finish();
    } catch (error) {
      toast.error(isApiError(error) ? error.message : 'Could not change your location');
    }
  };

  // Throwing keeps the form open with its error; the form shows the toast.
  const submitTyped = async (draft: AddressDraft) => {
    const result = await saveLocation(draft);
    toast.success(
      result.kind === 'existing'
        ? `Using your saved address — ${locationTitle(result.address)}`
        : 'Delivery location updated',
    );
    finish();
  };

  const resetGuestLocation = () => {
    setGuestLocation(null);
    toast.success('Delivery location cleared');
    finish();
  };

  const savedAddresses = signedIn ? (addresses ?? []) : [];
  const flag = isSupportedCountry(current.country) ? countryRules(current.country).flag : null;

  return (
    <>
      <Sheet
        open={open && !typing}
        onClose={finish}
        title="Delivery location"
        description="Place the pin on your door. Menus and prices are the same everywhere."
      >
        <View className="gap-5 pb-2">
          {current.source ? (
            <View testID="current-location" className="rounded-2xl bg-surface-muted px-4 py-3">
              <Text className="text-xs font-bold uppercase text-text-muted">Delivering to</Text>
              <Text numberOfLines={1} className="mt-0.5 text-sm font-bold text-text-primary">
                {flag ? `${flag} ` : ''}
                {current.title}
              </Text>
              {current.formatted ? (
                <Text numberOfLines={2} className="mt-0.5 text-xs text-text-muted">
                  {current.formatted}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View className="gap-2">
            <CurrentPositionRow
              device={device}
              onLocate={locateMe}
              onTurnOn={turnOnLocation}
              onChooseOnMap={() => openPicker()}
            />
            <ActionRow
              testID="search-address"
              icon={<SearchIcon color={colors.text.primary} size={20} />}
              label="Search for an address"
              hint="A street, building or place"
              onPress={() => openPicker({ start: 'search' })}
            />
            <ActionRow
              testID="choose-on-map"
              icon={<PinIcon color={colors.text.primary} size={20} />}
              label="Choose on the map"
              hint="Drag the map until the pin is on your door"
              onPress={() => openPicker()}
            />
          </View>

          {savedAddresses.length > 0 ? (
            <View>
              <Text className="mb-2 text-xs font-bold uppercase text-text-muted">
                Saved addresses
              </Text>
              <View className="gap-2">
                {savedAddresses.map((address) => {
                  const selected =
                    current.source === 'address' && current.address?.id === address.id;
                  const busy = pendingAddressId === address.id;
                  const addressFlag = isSupportedCountry(address.country)
                    ? `${countryRules(address.country).flag} `
                    : '';

                  return (
                    <Pressable
                      key={address.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, busy, disabled: isPending }}
                      accessibilityLabel={`${address.label ?? address.line1}, ${address.formatted}`}
                      disabled={isPending}
                      onPress={() => pickSaved(address.id)}
                      className={cn(
                        'flex-row items-center gap-3 rounded-2xl border px-4 py-3',
                        selected ? 'border-brand-500 bg-brand-50' : 'border-border bg-surface',
                      )}
                    >
                      <PinIcon
                        color={selected ? colors.brand[500] : colors.text.muted}
                        size={18}
                        filled={selected}
                      />
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-text-primary">
                          {addressFlag}
                          {address.label ?? address.line1}
                        </Text>
                        <Text numberOfLines={2} className="mt-0.5 text-xs text-text-muted">
                          {address.formatted}
                        </Text>
                      </View>
                      {busy ? (
                        <ActivityIndicator size="small" color={colors.brand[500]} />
                      ) : selected ? (
                        <Badge label="Current" variant="brand" />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {!signedIn ? (
            <View className="rounded-2xl bg-surface-muted px-4 py-3">
              <Text className="text-xs text-text-secondary">
                No account needed. Your location is kept on this phone, and saved to your
                account when you sign in.
              </Text>
              <View className="mt-1 flex-row flex-wrap gap-2">
                <Button
                  label="Sign in"
                  variant="ghost"
                  size="sm"
                  fullWidth={false}
                  onPress={() => {
                    finish();
                    promptLogin('to save your delivery addresses');
                  }}
                />
                {current.source === 'guest' ? (
                  <Button
                    label="Reset location"
                    variant="ghost"
                    size="sm"
                    fullWidth={false}
                    textClassName="text-danger"
                    onPress={resetGuestLocation}
                  />
                ) : null}
              </View>
            </View>
          ) : null}

          <Pressable
            testID="type-address"
            accessibilityRole="button"
            accessibilityLabel="Type the address instead"
            onPress={() => {
              device.reset();
              setTyping(true);
            }}
            className="flex-row items-center justify-center gap-2 py-1 active:opacity-70"
          >
            <EditIcon color={colors.text.muted} size={16} />
            <Text className="text-xs font-semibold text-text-muted">Type the address instead</Text>
          </Pressable>
        </View>
      </Sheet>

      <AddressFormSheet
        open={open && typing}
        // Backing out goes to the choices, not out of the flow.
        onClose={() => setTyping(false)}
        initialDraft={current.draft ?? MANUAL_DRAFT}
        onSubmitDraft={submitTyped}
        title="Your delivery address"
        description="Add your building and flat so the rider finds the door."
        submitLabel="Deliver here"
      />
    </>
  );
}

function ActionRow({
  testID,
  icon,
  label,
  hint,
  onPress,
}: {
  testID: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 active:bg-surface-muted"
    >
      {icon}
      <View className="flex-1">
        <Text className="text-sm font-bold text-text-primary">{label}</Text>
        <Text className="mt-0.5 text-xs text-text-muted">{hint}</Text>
      </View>
    </Pressable>
  );
}
