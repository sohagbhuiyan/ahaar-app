import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { setUnauthorizedHandler } from '@/lib/api/client';
import { QueryProvider } from '@/lib/query/QueryProvider';
import { useAuthStore, useCartStore, useInstantOrderStore } from '@/lib/store';

jest.mock('@/lib/api/client', () => ({
  ...jest.requireActual('@/lib/api/client'),
  setUnauthorizedHandler: jest.fn(),
}));

const mockSetHandler = setUnauthorizedHandler as jest.MockedFunction<typeof setUnauthorizedHandler>;

describe('401 / revoked session', () => {
  it('drops the session and both drafts, then tells the app', async () => {
    useAuthStore.setState({ token: 'revoked', user: { id: 1, name: 'A', email: 'a@x.y', roles: [] } });
    useCartStore.setState({ addressId: 10 });
    useInstantOrderStore.setState({ addressId: 20 });
    const onUnauthorized = jest.fn();

    await render(
      <QueryProvider onUnauthorized={onUnauthorized}>
        <Text>app</Text>
      </QueryProvider>,
    );

    await waitFor(() => expect(mockSetHandler).toHaveBeenCalledWith(expect.any(Function)));
    const handler = mockSetHandler.mock.calls.find(([h]) => h !== null)![0]!;
    await handler();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useCartStore.getState().addressId).toBeNull();
    expect(useInstantOrderStore.getState().addressId).toBeNull();
    expect(onUnauthorized).toHaveBeenCalled();
  });
});
