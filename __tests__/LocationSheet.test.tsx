import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { LocationSheet } from '@/components/shared/LocationSheet';
import { useAuthStore, useLocationStore } from '@/lib/store';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

// `fireEvent` already runs inside `act` and resolves once it settles; wrapping
// it again overlaps two act scopes.
const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

function renderSheet() {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false }, mutations: { gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <LocationSheet open onClose={jest.fn()} />
    </QueryClientProvider>,
  );
}

describe('LocationSheet, signed out', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ token: null, user: null, hasHydrated: true });
    useLocationStore.setState({ guestLocation: null, hasPromptedLocation: true, hasHydrated: true });
  });

  it('opens the map to search or choose, with no account needed', async () => {
    await renderSheet();

    expect(screen.getByText(/No account needed/)).toBeTruthy();

    await press('Search for an address');
    expect(mockPush).toHaveBeenLastCalledWith(
      expect.objectContaining({ pathname: '/location-picker', params: { start: 'search' } }),
    );

    await press('Choose on the map');
    expect(mockPush).toHaveBeenLastCalledWith(
      expect.objectContaining({ pathname: '/location-picker', params: {} }),
    );
  });

  it('explains a refused permission and keeps the other ways in', async () => {
    await renderSheet();

    // The mocked device says no when asked.
    await press('Use my current location');

    expect(screen.getByTestId('location-problem')).toBeTruthy();
    expect(screen.getByText('Location access wasn’t allowed.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Search for an address' })).toBeTruthy();
  });

  it('keeps a typed Saudi address on the device, cleaned up', async () => {
    await renderSheet();

    await press('Type the address instead');
    expect(await screen.findByText('Your delivery address')).toBeTruthy();
    expect(screen.getByTestId('national-address')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('City'), 'ar riyad');
    await fireEvent.changeText(screen.getByLabelText('District'), 'حي العليا');
    await fireEvent.changeText(screen.getByLabelText('Street name'), 'King Fahd Rd');
    // An Arabic keyboard's digits.
    await fireEvent.changeText(screen.getByLabelText('Building no.'), '٨٢٢٨');
    await fireEvent.changeText(screen.getByLabelText('Postal code'), '12211');
    await press('Deliver here');

    expect(useLocationStore.getState().guestLocation).toMatchObject({
      line1: '8228 King Fahd Rd',
      building_number: '8228',
      area: 'العليا',
      city: 'Riyadh',
      postal_code: '12211',
      country: 'SA',
      location_source: 'manual',
      lat: null,
    });
  });

  it('switches the form to a Bangladeshi address for testing', async () => {
    await renderSheet();

    await press('Type the address instead');
    await fireEvent.press(await screen.findByRole('radio', { name: 'Bangladesh' }));

    expect(screen.queryByTestId('national-address')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('City'), 'Dhaka');
    await fireEvent.changeText(screen.getByLabelText('Area / Thana'), 'Dhanmondi');
    await fireEvent.changeText(screen.getByLabelText('Road / street'), 'Road 5');
    await fireEvent.changeText(screen.getByLabelText('House / holding no.'), '12/A');
    await fireEvent.changeText(screen.getByLabelText('Postcode'), '১২০৯');
    await press('Deliver here');

    expect(useLocationStore.getState().guestLocation).toMatchObject({
      country: 'BD',
      line1: 'House 12/A, Road 5',
      area: 'Dhanmondi',
      postal_code: '1209',
      additional_number: null,
    });
  });

  it('asks for the district and refuses a malformed code', async () => {
    await renderSheet();

    await press('Type the address instead');
    await fireEvent.changeText(await screen.findByLabelText('City'), 'Riyadh');
    await fireEvent.changeText(screen.getByLabelText('Street name'), 'King Fahd Rd');
    await fireEvent.changeText(screen.getByLabelText('Building no.'), '12');
    await press('Deliver here');

    expect(await screen.findByText('District is required')).toBeTruthy();
    expect(screen.getByText('Building number is 4 digits')).toBeTruthy();
    expect(useLocationStore.getState().guestLocation).toBeNull();
  });

  it('resets a location kept on the device', async () => {
    useLocationStore.setState({
      guestLocation: {
        label: null, line1: '8228 King Fahd Rd', line2: null, area: 'Al Olaya', city: 'Riyadh', region: null,
        postal_code: null, country: 'SA', building_number: '8228', additional_number: null, short_address: null,
        lat: 24.69, lng: 46.68, location_source: 'map', instructions: null,
      },
    });
    await renderSheet();

    expect(screen.getByTestId('current-location')).toBeTruthy();
    await press('Reset location');

    expect(useLocationStore.getState().guestLocation).toBeNull();
  });
});
