/**
 * The customer's delivery location: read it, change it, carry it across sign-in.
 *
 * ── One source of truth ─────────────────────────────────────────────────────
 * Signed in, the current location **is the default address** on the server.
 * Changing it is `POST /addresses/{id}/set-default` (or creating an address
 * with `is_default: true`), so checkout, the website and the customer's other
 * devices all agree without a second, app-only copy drifting from them.
 * Signed out, a visitor's choice is kept on the device (`useLocationStore`)
 * and saved to the account by `useGuestLocationSync` once they sign in.
 *
 * Location is where food is delivered — nothing more. It never filters the
 * menu, plans or packages, and never changes a price.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import * as profileApi from '../../api/endpoints/profile';
import type { AddressInput } from '../../api/endpoints/profile';
import type { User } from '../../api/types/auth';
import type { Address } from '../../api/types/catalog';
import { isApiError } from '../../api/types/common';
import {
  composeAddress,
  findSamePlace,
  isCompleteDraft,
  locationTitle,
  type AddressDraft,
} from '../../location/address';
import { DEFAULT_COUNTRY } from '../../location/countries';
import { useAuthStore } from '../../store/useAuthStore';
import { useCartStore } from '../../store/useCartStore';
import { useInstantOrderStore } from '../../store/useInstantOrderStore';
import { useLocationStore } from '../../store/useLocationStore';
import { queryKeys } from '../keys';
import { useIsSignedIn } from './useIsSignedIn';
import { useAddresses, useProfile } from './useProfile';

// ── Reading ──────────────────────────────────────────────────────────────────

export type LocationSource = 'address' | 'guest';

export interface CurrentLocation {
  /** `null` when no location has been set yet. */
  source: LocationSource | null;
  /** "Home · Al Olaya, Riyadh" — for a header. Empty when unset. */
  title: string;
  /** The full one-line address. Empty when unset. */
  formatted: string;
  /** The saved address, when the location is one. */
  address: Address | null;
  /** The on-device draft, when the location is one. */
  draft: AddressDraft | null;
  /** ISO alpha-2 of the location — for the flag beside it. */
  country: string | null;
  isLoading: boolean;
}

const NO_LOCATION: Omit<CurrentLocation, 'isLoading'> = {
  source: null,
  title: '',
  formatted: '',
  address: null,
  draft: null,
  country: null,
};

export function useCurrentLocation(): CurrentLocation {
  const signedIn = useIsSignedIn();
  const guest = useLocationStore((s) => s.guestLocation);
  const storeHydrated = useLocationStore((s) => s.hasHydrated);
  const authHydrated = useAuthStore((s) => s.hasHydrated);
  const { data: addresses, isLoading: addressesLoading } = useAddresses();
  const { data: profile } = useProfile();

  // A device draft wins while it exists: signed out it is the only answer, and
  // signed in it is the place the customer just picked, about to be saved.
  if (guest) {
    return {
      source: 'guest',
      title: locationTitle(guest),
      formatted: composeAddress(guest),
      address: null,
      draft: guest,
      country: guest.country ?? null,
      isLoading: false,
    };
  }

  if (signedIn) {
    // Same precedence as checkout's `effectiveAddressId`, so the header and
    // the order summary can never name two different places.
    const address =
      addresses?.find((a) => a.is_default) ??
      addresses?.[0] ??
      profile?.default_address ??
      null;

    if (address) {
      return {
        source: 'address',
        title: locationTitle(address),
        formatted: address.formatted,
        address,
        draft: null,
        country: address.country,
        isLoading: false,
      };
    }
    return { ...NO_LOCATION, isLoading: addressesLoading };
  }

  return { ...NO_LOCATION, isLoading: !storeHydrated || !authHydrated };
}

// ── Changing ─────────────────────────────────────────────────────────────────

/**
 * Checkout and the one-off order screen remember an address picked *for that
 * order*. Once the customer changes where they are, those should follow the new
 * location instead of quietly delivering to the old one.
 */
function followCurrentLocation() {
  useCartStore.getState().setAddress(null);
  useInstantOrderStore.getState().setAddress(null);
}

/** Empty strings become `undefined` so Laravel's `nullable` applies. */
export function draftToPayload(draft: AddressDraft): Partial<AddressInput> {
  const text = (value: string | null | undefined) => value?.trim() || undefined;

  return {
    label: text(draft.label),
    line1: draft.line1.trim(),
    line2: text(draft.line2),
    area: text(draft.area),
    postal_code: text(draft.postal_code),
    city: draft.city.trim(),
    // The pin's country, detected when it was chosen; the backend checks the
    // pin really is there.
    country: draft.country ? draft.country.trim().toUpperCase() : DEFAULT_COUNTRY,
    region: text(draft.region),
    building_number: text(draft.building_number),
    additional_number: text(draft.additional_number),
    short_address: text(draft.short_address),
    lat: draft.lat ?? undefined,
    lng: draft.lng ?? undefined,
    location_source: draft.location_source ?? undefined,
    instructions: text(draft.instructions),
  };
}

export type SaveLocationResult =
  | { kind: 'guest' }
  /** An address already saved for this place was made current instead. */
  | { kind: 'existing'; address: Address }
  | { kind: 'created'; address: Address };

export function useChangeLocation() {
  const queryClient = useQueryClient();
  const setGuestLocation = useLocationStore((s) => s.setGuestLocation);

  /** Mark one address current in both caches that carry it. */
  const applyDefault = (address: Address) => {
    queryClient.setQueryData<Address[]>(queryKeys.profile.addresses(), (list) => {
      if (!list) return list;
      const known = list.some((a) => a.id === address.id);
      return (known ? list : [address, ...list]).map((a) =>
        a.id === address.id
          ? { ...a, ...address, is_default: true }
          : { ...a, is_default: false },
      );
    });
    queryClient.setQueryData<User>(queryKeys.profile.me(), (me) =>
      me
        ? {
            ...me,
            default_address_id: address.id,
            default_address: { ...address, is_default: true },
          }
        : me,
    );
  };

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.addresses() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.me() }),
    ]);

  const select = useMutation({
    mutationFn: (addressId: number) => profileApi.setDefaultAddress(addressId),
    // Optimistic: the header should move the instant a saved address is tapped.
    onMutate: async (addressId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.profile.addresses() });
      const previous = {
        addresses: queryClient.getQueryData<Address[]>(queryKeys.profile.addresses()),
        me: queryClient.getQueryData<User>(queryKeys.profile.me()),
      };
      const target = previous.addresses?.find((a) => a.id === addressId);
      if (target) applyDefault(target);
      return previous;
    },
    onSuccess: (address) => {
      applyDefault(address);
      setGuestLocation(null);
      followCurrentLocation();
    },
    onError: (_error, _addressId, previous) => {
      if (!previous) return;
      queryClient.setQueryData(queryKeys.profile.addresses(), previous.addresses);
      queryClient.setQueryData(queryKeys.profile.me(), previous.me);
    },
    onSettled: refresh,
  });

  const save = useMutation({
    mutationFn: async (draft: AddressDraft): Promise<SaveLocationResult> => {
      // Read at call time, not render time: the sign-in sync runs this the
      // moment a session appears.
      if (useAuthStore.getState().token === null) {
        setGuestLocation(draft);
        return { kind: 'guest' };
      }

      // Cached when the sheet has been showing them; fetched when the sign-in
      // sync runs before anything has.
      const addresses = await queryClient.ensureQueryData({
        queryKey: queryKeys.profile.addresses(),
        queryFn: profileApi.getAddresses,
      });

      // "Use my current location" at home, again: reuse the address instead of
      // filling the address book with copies of it.
      const existing = findSamePlace(addresses, draft);
      if (existing) {
        const address = existing.is_default
          ? existing
          : await profileApi.setDefaultAddress(existing.id);
        return { kind: 'existing', address };
      }

      const address = await profileApi.createAddress({
        ...draftToPayload(draft),
        is_default: true,
      });
      return { kind: 'created', address };
    },
    onSuccess: (result) => {
      if (result.kind !== 'guest') {
        applyDefault(result.address);
        setGuestLocation(null);
      }
      followCurrentLocation();
    },
    onSettled: (result) => (result && result.kind !== 'guest' ? refresh() : undefined),
  });

  return {
    /** Make a saved address the current location. */
    selectAddress: select.mutateAsync,
    /** Save a typed or GPS-filled address as the current location. */
    saveLocation: save.mutateAsync,
    isPending: select.isPending || save.isPending,
    /** The saved address being switched to, for a row spinner. */
    pendingAddressId: select.isPending ? (select.variables ?? null) : null,
  };
}

// ── Sign-in and first use ────────────────────────────────────────────────────

const SYNC_RETRY_MS = 30_000;

/**
 * Saves a signed-out visitor's location to their account once they sign in.
 *
 * Waits for `/addresses` so an address already on the account for the same
 * place is reused rather than duplicated. A network failure keeps the draft and
 * tries again later; a draft the API refuses outright is dropped, or it would
 * be retried — and shown in the header — forever. Mounted once, at the root, so
 * it runs however the customer came to sign in.
 */
export function useGuestLocationSync(): void {
  const signedIn = useIsSignedIn();
  const guest = useLocationStore((s) => s.guestLocation);
  const setGuestLocation = useLocationStore((s) => s.setGuestLocation);
  const { isSuccess: addressesLoaded } = useAddresses();
  const { saveLocation } = useChangeLocation();

  const inFlight = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => () => clearTimeout(retryTimer.current), []);

  useEffect(() => {
    if (!signedIn || !guest || !addressesLoaded || inFlight.current) return;

    if (!isCompleteDraft(guest)) {
      setGuestLocation(null);
      return;
    }

    inFlight.current = true;
    saveLocation(guest)
      .catch((error: unknown) => {
        if (isApiError(error) && error.code === 'validation') {
          setGuestLocation(null);
          return;
        }
        clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => setRetryTick((n) => n + 1), SYNC_RETRY_MS);
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [signedIn, guest, addressesLoaded, retryTick, saveLocation, setGuestLocation]);
}

/**
 * Offers the location sheet once, on first use, when there is nowhere to
 * deliver yet. Never repeats, never blocks: dismissing it is a fine answer, and
 * the Home header stays one tap away.
 */
export function useFirstLocationPrompt(open: () => void): void {
  const signedIn = useIsSignedIn();
  const authHydrated = useAuthStore((s) => s.hasHydrated);
  const storeHydrated = useLocationStore((s) => s.hasHydrated);
  const hasPrompted = useLocationStore((s) => s.hasPromptedLocation);
  const guest = useLocationStore((s) => s.guestLocation);
  const markPrompted = useLocationStore((s) => s.markPrompted);
  const { data: addresses, isSuccess: addressesLoaded } = useAddresses();

  useEffect(() => {
    if (!authHydrated || !storeHydrated || hasPrompted || guest) return;
    // Signed in: only once we know the account really has no address.
    if (signedIn && (!addressesLoaded || (addresses?.length ?? 0) > 0)) return;

    markPrompted();
    open();
  }, [
    authHydrated,
    storeHydrated,
    hasPrompted,
    guest,
    signedIn,
    addressesLoaded,
    addresses,
    markPrompted,
    open,
  ]);
}
