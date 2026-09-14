import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import ArrowLeftIcon from '@/components/icons/ArrowLeftIcon';
import CloseIcon from '@/components/icons/CloseIcon';
import LocateIcon from '@/components/icons/LocateIcon';
import PinIcon from '@/components/icons/PinIcon';
import SearchIcon from '@/components/icons/SearchIcon';
import { AddressFormSheet } from '@/components/shared/AddressFormSheet';
import {
  PickerMap,
  STREET_ZOOM,
  USES_NATIVE_MAP,
  type MapCenter,
  type PickerMapHandle,
} from '@/components/shared/PickerMap';
import { Button, Skeleton } from '@/components/ui';
import { getPlace, searchPlaces } from '@/lib/api/endpoints/geo';
import type { LocationSource, PlaceSuggestion } from '@/lib/api/types/geo';
import { distanceMeters, locationTitle, shortLocation, type AddressDraft } from '@/lib/location/address';
import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  countryRules,
  guessCountryFromTimeZone,
  isSupportedCountry,
} from '@/lib/location/countries';
import {
  lookupFromPlace,
  lookupPlace,
  newSearchSession,
  type PlaceLookup,
} from '@/lib/location/lookup';
import { useDeviceLocation } from '@/lib/location/useDeviceLocation';
import {
  useChangeLocation,
  useCreateAddress,
  useCurrentLocation,
  useIsSignedIn,
} from '@/lib/query/hooks';
import { draftToPayload } from '@/lib/query/hooks/useLocation';
import { colors, shadows } from '@/lib/theme';

/** A city's worth of map, when there is no better place to start. */
const CITY_ZOOM = 12;
/** Street level. Further out, a pin can't honestly be on one building. */
const MIN_CONFIRM_ZOOM = 15;
/** A place already resolved within this distance of where the map settled needs no second lookup. */
const SAME_SPOT_METERS = 15;
/** Wait for the map to stop before asking what is under the pin. */
const LOOKUP_DEBOUNCE_MS = 350;
const SEARCH_DEBOUNCE_MS = 300;

type SearchResults = { query: string; items: PlaceSuggestion[]; failed: boolean };

/**
 * Where food goes, chosen on a map.
 *
 * The pin stays fixed in the middle of the screen and the map moves under it —
 * drag, pinch, or tap where the door is. When the map settles, the Ahaar API
 * (or OpenStreetMap, when the API can't answer) says what is under the pin: the
 * address written its country's way, and whether Ahaar delivers there. Saudi
 * Arabia is served (and Bangladesh while testing); anywhere else can't be
 * confirmed.
 *
 * Nothing here needs GPS or a map key: the map is Google/Apple when the build
 * can draw it and OpenStreetMap otherwise (`PickerMap`), and search works
 * without permission. "Locate me" is a shortcut, not the way in.
 *
 * `mode=current` (default) sets the delivery location, signed in or not.
 * `mode=add` saves one more address to the account.
 */
export default function LocationPickerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string; start?: string; lat?: string; lng?: string }>();

  const signedIn = useIsSignedIn();
  const addMode = params.mode === 'add' && signedIn;

  const current = useCurrentLocation();
  const device = useDeviceLocation();
  const { saveLocation } = useChangeLocation();
  const createAddress = useCreateAddress();

  const mapRef = useRef<PickerMapHandle>(null);

  // Start on the fix handed over, else the current location, else the capital
  // of the country the phone's clock is in. Read once: later changes must not
  // yank the map.
  const [initial] = useState<{ center: MapCenter; zoom: number }>(() => {
    const lat = Number(params.lat);
    const lng = Number(params.lng);
    if (params.lat && params.lng && Number.isFinite(lat) && Number.isFinite(lng)) {
      return { center: { latitude: lat, longitude: lng }, zoom: STREET_ZOOM };
    }
    const saved = current.address ?? current.draft;
    if (saved?.lat != null && saved.lng != null) {
      return { center: { latitude: saved.lat, longitude: saved.lng }, zoom: STREET_ZOOM };
    }
    return { center: COUNTRIES[guessCountryFromTimeZone() ?? DEFAULT_COUNTRY].center, zoom: CITY_ZOOM };
  });

  const center = useRef<MapCenter>(initial.center);
  const [zoom, setZoom] = useState(initial.zoom);

  const [lookup, setLookup] = useState<PlaceLookup | null>(null);
  const [looking, setLooking] = useState(true);
  const [moving, setMoving] = useState(false);
  const movingRef = useRef(false);

  // How the next settle was caused: a GPS fix handed in counts as GPS.
  const nextSource = useRef<LocationSource>(params.lat ? 'gps' : 'map');
  const resolvedPick = useRef<PlaceLookup | null>(null);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lookupAbort = useRef<AbortController | null>(null);

  const [hasPermission, setHasPermission] = useState(false);
  const [searchOpen, setSearchOpen] = useState(params.start === 'search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({ query: '', items: [], failed: false });
  const [searching, setSearching] = useState(false);
  const session = useRef<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    // Only draw the blue dot once location is allowed — asking is "locate me"'s job.
    Location.getForegroundPermissionsAsync()
      .then((permission) => setHasPermission(permission.granted))
      .catch(() => undefined);
    return () => {
      clearTimeout(lookupTimer.current);
      lookupAbort.current?.abort();
    };
  }, []);

  /** The map came to rest: find out what is under the pin. */
  const settle = (coords: MapCenter) => {
    center.current = coords;
    clearTimeout(lookupTimer.current);
    lookupAbort.current?.abort();

    const source = nextSource.current;
    nextSource.current = 'map';

    // A search result already resolved for this spot — don't ask twice.
    const pick = resolvedPick.current;
    resolvedPick.current = null;
    if (
      pick?.draft.lat != null &&
      pick.draft.lng != null &&
      distanceMeters(coords, { latitude: pick.draft.lat, longitude: pick.draft.lng }) <= SAME_SPOT_METERS
    ) {
      setLookup(pick);
      setLooking(false);
      return;
    }

    setLooking(true);
    const controller = new AbortController();
    lookupAbort.current = controller;
    lookupTimer.current = setTimeout(() => {
      lookupPlace(coords, source, { signal: controller.signal })
        .then((result) => {
          if (!controller.signal.aborted) setLookup(result);
        })
        .catch(() => undefined)
        .finally(() => {
          if (!controller.signal.aborted) setLooking(false);
        });
    }, LOOKUP_DEBOUNCE_MS);
  };

  const onMoveStart = () => {
    if (movingRef.current) return;
    movingRef.current = true;
    setMoving(true);
  };

  const onMoveEnd = (coords: MapCenter, level: number) => {
    movingRef.current = false;
    setMoving(false);
    setZoom(level);
    settle(coords);
  };

  const moveTo = (latitude: number, longitude: number, source: LocationSource) => {
    nextSource.current = source;
    mapRef.current?.moveTo(latitude, longitude);
  };

  const locateHere = async () => {
    const result = await device.locate();
    if (!result) return;

    const fix = result.draft;
    if (fix?.lat != null && fix.lng != null) {
      setHasPermission(true);
      moveTo(fix.lat, fix.lng, 'gps');
      return;
    }

    if (result.status === 'denied' && !result.canAskAgain) {
      Alert.alert(
        'Location is off for Ahaar',
        'Allow location in Settings to find where you are — or just drag the map to your door.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open settings', onPress: device.openSettings },
        ],
      );
    } else if (result.status === 'services_off') {
      Alert.alert('Location is switched off', 'Turn on location to find where you are — or drag the map to your door.', [
        { text: 'Not now', style: 'cancel' },
        {
          text: Platform.OS === 'android' ? 'Turn on' : 'Open settings',
          onPress: () => {
            device.enableServices().then((on) => {
              if (on) locateHere();
            });
          },
        },
      ]);
    } else if (result.message) {
      toast.error(`${result.message} Drag the map to your door instead.`);
    }
  };

  // Search-as-you-type, biased towards wherever the map is looking.
  useEffect(() => {
    const trimmed = query.trim();
    if (!searchOpen || trimmed.length < 2) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      session.current ??= newSearchSession();
      searchPlaces(trimmed, {
        lat: center.current.latitude,
        lng: center.current.longitude,
        session: session.current,
        signal: controller.signal,
      })
        .then((items) => {
          if (!controller.signal.aborted) setResults({ query: trimmed, items, failed: false });
        })
        .catch(() => {
          if (!controller.signal.aborted) setResults({ query: trimmed, items: [], failed: true });
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, searchOpen]);

  const pickSuggestion = async (suggestion: PlaceSuggestion) => {
    Keyboard.dismiss();
    setSearchOpen(false);
    setLooking(true);
    try {
      const place = await getPlace(suggestion.place_id, { session: session.current ?? undefined });
      const result = lookupFromPlace(place, 'search');
      resolvedPick.current = result;
      setLookup(result);
      setLooking(false);
      moveTo(place.lat, place.lng, 'search');
    } catch {
      setLooking(false);
      if (suggestion.lat != null && suggestion.lng != null) {
        moveTo(suggestion.lat, suggestion.lng, 'search');
      } else {
        toast.error('We couldn’t open that place. Try another result.');
      }
    } finally {
      // A session ends with its pick.
      session.current = null;
    }
  };

  const save = async (draft: AddressDraft) => {
    if (addMode) {
      await createAddress.mutateAsync(draftToPayload(draft));
      toast.success('Address saved');
    } else {
      const result = await saveLocation(draft);
      toast.success(
        result.kind === 'existing'
          ? `Using your saved address — ${locationTitle(result.address)}`
          : 'Delivery location updated',
      );
    }
    setConfirmOpen(false);
    router.back();
  };

  const draft = lookup?.draft ?? null;
  const busy = looking || moving;
  const deviceBusy = device.status === 'requesting' || device.status === 'locating';
  const served = lookup?.supported ?? false;
  const tooFar = zoom < MIN_CONFIRM_ZOOM;
  const rules = isSupportedCountry(lookup?.country) ? countryRules(lookup?.country) : null;
  const title = draft ? draft.line1 || shortLocation(draft) || 'Pinned location' : '';
  const subtitle = draft && draft.line1 ? shortLocation(draft) : '';

  const trimmed = query.trim();
  const shown = trimmed.length >= 2 && results.query === trimmed ? results : null;

  return (
    <View className="flex-1 bg-surface-muted">
      <PickerMap
        ref={mapRef}
        initialCenter={initial.center}
        initialZoom={initial.zoom}
        showsUserLocation={USES_NATIVE_MAP && hasPermission}
        onMoveStart={onMoveStart}
        onMoveEnd={onMoveEnd}
      />

      {/* The pin — fixed at the centre; its tip marks the spot. It lifts while
          the map moves, so it is obvious the address is being re-read. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill} className="items-center justify-center">
        <View style={{ transform: [{ translateY: moving ? -34 : -24 }] }} className="items-center">
          <View className="rounded-full bg-brand-500 p-2" style={shadows.brand}>
            <PinIcon color="#ffffff" size={24} filled />
          </View>
          <View className="h-3 w-0.5 bg-brand-500" />
        </View>
        <View className="absolute h-2 w-2 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.25)' }} />
      </View>

      {/* Top: close, and the search field */}
      <View
        style={{ paddingTop: insets.top + 8 }}
        className="absolute left-0 right-0 top-0 flex-row items-center gap-2 px-3"
      >
        <RoundButton label="Close" onPress={() => router.back()}>
          <CloseIcon color={colors.text.primary} />
        </RoundButton>
        <Pressable
          testID="open-search"
          accessibilityRole="search"
          accessibilityLabel="Search for an address"
          onPress={() => setSearchOpen(true)}
          className="h-12 flex-1 flex-row items-center gap-2 rounded-2xl bg-surface px-4 active:opacity-90"
          style={shadows.card}
        >
          <SearchIcon color={colors.text.muted} size={18} />
          <Text numberOfLines={1} className="flex-1 text-sm text-text-muted">
            Search street, building or place
          </Text>
        </Pressable>
      </View>

      {/* Bottom: locate me, and what is under the pin */}
      <View className="absolute bottom-0 left-0 right-0" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <View className="mb-3 flex-row justify-end px-4">
          <RoundButton label="Use my current location" onPress={locateHere} busy={deviceBusy}>
            <LocateIcon color={colors.brand[500]} size={22} />
          </RoundButton>
        </View>

        <View testID="picked-place" className="mx-3 rounded-3xl bg-surface p-4" style={shadows.cardRaised}>
          <View className="flex-row items-center justify-between gap-2">
            <Text className="text-xs font-bold uppercase text-text-muted">
              {addMode ? 'New address' : 'Deliver to'}
            </Text>
            {lookup && !busy ? (
              <View className="rounded-full bg-surface-muted px-2.5 py-1">
                <Text className="text-[11px] font-bold text-text-secondary">
                  {rules ? `${rules.flag} ${rules.name}` : (lookup.countryName ?? lookup.country ?? 'Unknown country')}
                </Text>
              </View>
            ) : null}
          </View>

          {busy || !lookup ? (
            <View className="mt-2 gap-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </View>
          ) : (
            <View className="mt-1">
              <Text numberOfLines={1} className="text-base font-bold text-text-primary">
                {title}
              </Text>
              {subtitle ? (
                <Text numberOfLines={1} className="mt-0.5 text-sm text-text-secondary">
                  {subtitle}
                </Text>
              ) : null}
              {draft?.lat != null && draft.lng != null ? (
                <Text className="mt-0.5 text-[11px] text-text-muted">
                  {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
                </Text>
              ) : null}
              {!served ? (
                <View testID="not-served" className="mt-3 rounded-2xl bg-warning-soft px-3 py-2.5">
                  <Text className="text-xs text-text-primary">
                    Ahaar doesn’t deliver here yet. Move the pin to your address in Saudi Arabia.
                  </Text>
                </View>
              ) : tooFar ? (
                <View testID="zoom-in" className="mt-3 rounded-2xl bg-surface-muted px-3 py-2.5">
                  <Text className="text-xs text-text-primary">
                    Zoom in to put the pin exactly on your building.
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          <Button
            label={lookup && !busy && !served ? 'Not available here' : 'Confirm location'}
            size="lg"
            className="mt-4"
            disabled={!lookup || busy || !served || tooFar}
            onPress={() => setConfirmOpen(true)}
          />
          <Text className="mt-2 text-center text-[11px] text-text-muted">
            Drag the map or tap your building — the pin marks the spot.
          </Text>
        </View>
      </View>

      {searchOpen ? (
        <View testID="search-panel" style={[StyleSheet.absoluteFill, { paddingTop: insets.top }]} className="bg-surface">
          <View className="flex-row items-center gap-2 border-b border-border px-3 py-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to the map"
              onPress={() => {
                Keyboard.dismiss();
                setSearchOpen(false);
              }}
              hitSlop={8}
              className="h-10 w-10 items-center justify-center"
            >
              <ArrowLeftIcon color={colors.text.primary} />
            </Pressable>
            <TextInput
              testID="search-input"
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="Search street, building or place"
              placeholderTextColor={colors.text.muted}
              returnKeyType="search"
              autoCorrect={false}
              className="h-11 flex-1 rounded-xl bg-surface-muted px-3 text-sm text-text-primary"
            />
            {query ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setQuery('')}
                hitSlop={8}
                className="h-10 w-10 items-center justify-center"
              >
                <CloseIcon color={colors.text.muted} size={18} />
              </Pressable>
            ) : null}
          </View>

          <FlatList
            data={shown?.items ?? []}
            keyExtractor={(item) => item.place_id}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={ResultSeparator}
            ListHeaderComponent={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Use my current location"
                onPress={() => {
                  Keyboard.dismiss();
                  setSearchOpen(false);
                  locateHere();
                }}
                className="flex-row items-center gap-3 border-b border-border px-4 py-3.5 active:bg-surface-muted"
              >
                <View className="h-9 w-9 items-center justify-center rounded-full bg-brand-50">
                  <LocateIcon color={colors.brand[500]} size={18} />
                </View>
                <Text className="text-sm font-bold text-brand-700">Use my current location</Text>
              </Pressable>
            }
            ListEmptyComponent={
              <View className="items-center px-6 py-8">
                {searching ? (
                  <ActivityIndicator color={colors.brand[500]} />
                ) : shown?.failed ? (
                  <Text className="text-center text-sm text-text-muted">
                    Search isn’t available right now. Go back and drag the map to your address instead.
                  </Text>
                ) : shown ? (
                  <Text className="text-center text-sm text-text-muted">No places found for “{shown.query}”.</Text>
                ) : (
                  <Text className="text-center text-sm text-text-muted">
                    Type a street, building, district or landmark.
                  </Text>
                )}
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.subtitle ? `${item.title}, ${item.subtitle}` : item.title}
                onPress={() => pickSuggestion(item)}
                className="flex-row items-center gap-3 px-4 py-3 active:bg-surface-muted"
              >
                <View className="h-9 w-9 items-center justify-center rounded-full bg-surface-muted">
                  <PinIcon color={colors.text.muted} size={16} />
                </View>
                <View className="flex-1">
                  <Text numberOfLines={1} className="text-sm font-semibold text-text-primary">
                    {item.title}
                  </Text>
                  {item.subtitle ? (
                    <Text numberOfLines={1} className="mt-0.5 text-xs text-text-muted">
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            )}
          />
        </View>
      ) : null}

      <AddressFormSheet
        open={confirmOpen && draft !== null}
        onClose={() => setConfirmOpen(false)}
        initialDraft={draft}
        notice={lookup && !lookup.found ? 'We couldn’t read the street at this pin — please add it.' : null}
        onSubmitDraft={save}
        title="Address details"
        description={
          rules
            ? `${rules.flag} ${rules.name} — add your building and flat so the rider finds the door.`
            : 'Add your building and flat so the rider finds the door.'
        }
        submitLabel={addMode ? 'Save address' : 'Deliver here'}
      />
    </View>
  );
}

function ResultSeparator() {
  return <View className="ml-16 h-px bg-border" />;
}

function RoundButton({
  label,
  onPress,
  busy = false,
  children,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      className="h-12 w-12 items-center justify-center rounded-full bg-surface active:opacity-80"
      style={shadows.card}
    >
      {busy ? <ActivityIndicator size="small" color={colors.brand[500]} /> : children}
    </Pressable>
  );
}
