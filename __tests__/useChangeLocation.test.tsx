import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import * as profileApi from '@/lib/api/endpoints/profile';
import type { Address } from '@/lib/api/types/catalog';
import { EMPTY_DRAFT } from '@/lib/location/address';
import { useChangeLocation, type SaveLocationResult } from '@/lib/query/hooks/useLocation';
import { useAuthStore, useCartStore, useInstantOrderStore, useLocationStore } from '@/lib/store';

jest.mock('@/lib/api/endpoints/profile');

const api = profileApi as jest.Mocked<typeof profileApi>;

const address = (overrides: Partial<Address>): Address => ({
  id: 1,
  label: null,
  line1: '',
  line2: null,
  area: null,
  postal_code: null,
  city: 'Riyadh',
  country: 'SA',
  building_number: null,
  additional_number: null,
  short_address: null,
  region: null,
  location_source: null,
  lat: null,
  lng: null,
  instructions: null,
  is_default: false,
  formatted: '',
  ...overrides,
});

const home = address({
  id: 7,
  label: 'Home',
  line1: 'King Fahd Rd 12',
  area: 'Al Olaya',
  lat: 24.69,
  lng: 46.685,
  formatted: 'King Fahd Rd 12, Al Olaya, Riyadh',
});
const office = address({
  id: 8,
  label: 'Office',
  line1: 'Olaya St 1',
  is_default: true,
  formatted: 'Olaya St 1, Riyadh',
});

async function renderChangeLocation() {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false }, mutations: { gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(() => useChangeLocation(), { wrapper });
  return { hook, client };
}

async function save(
  hook: Awaited<ReturnType<typeof renderChangeLocation>>['hook'],
  draft: Parameters<ReturnType<typeof useChangeLocation>['saveLocation']>[0],
) {
  let result: SaveLocationResult | undefined;
  await act(async () => {
    result = await hook.result.current.saveLocation(draft);
  });
  return result;
}

describe('useChangeLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ token: 'test-token', hasHydrated: true });
    useLocationStore.setState({ guestLocation: null });
    useCartStore.setState({ addressId: office.id });
    useInstantOrderStore.setState({ addressId: office.id });
    api.getAddresses.mockResolvedValue([office, home]);
  });

  it('reuses a saved address for the same place instead of saving a copy', async () => {
    api.setDefaultAddress.mockResolvedValue({ ...home, is_default: true });
    const { hook } = await renderChangeLocation();

    // ~15 m from "Home", with the street spelt the way the lookup returned it.
    const result = await save(hook, {
      ...EMPTY_DRAFT,
      line1: '12 King Fahd Road',
      city: 'Riyadh',
      lat: 24.69012,
      lng: 46.68505,
    });

    expect(result).toMatchObject({ kind: 'existing', address: { id: home.id } });
    expect(api.setDefaultAddress).toHaveBeenCalledWith(home.id);
    expect(api.createAddress).not.toHaveBeenCalled();

    // Checkout follows the new location rather than an address picked earlier.
    expect(useCartStore.getState().addressId).toBeNull();
    expect(useInstantOrderStore.getState().addressId).toBeNull();
  });

  it('saves somewhere new as the current location, pin included', async () => {
    const created = address({ id: 9, line1: 'Tahlia St 4', city: 'Jeddah', is_default: true });
    api.createAddress.mockResolvedValue(created);
    const { hook } = await renderChangeLocation();

    const result = await save(hook, {
      ...EMPTY_DRAFT,
      line1: 'Tahlia St 4',
      city: 'Jeddah',
      area: '',
      lat: 21.5433,
      lng: 39.1728,
    });

    expect(result).toMatchObject({ kind: 'created', address: { id: 9 } });
    expect(api.createAddress).toHaveBeenCalledWith(
      expect.objectContaining({
        line1: 'Tahlia St 4',
        city: 'Jeddah',
        area: undefined,
        lat: 21.5433,
        lng: 39.1728,
        is_default: true,
      }),
    );
  });

  it('keeps a signed-out visitor’s location on the device', async () => {
    useAuthStore.setState({ token: null });
    const { hook } = await renderChangeLocation();

    const draft = { ...EMPTY_DRAFT, line1: 'Tahlia St 4', city: 'Jeddah' };
    const result = await save(hook, draft);

    expect(result).toEqual({ kind: 'guest' });
    expect(useLocationStore.getState().guestLocation).toEqual(draft);
    expect(api.getAddresses).not.toHaveBeenCalled();
    expect(api.createAddress).not.toHaveBeenCalled();
  });
});
