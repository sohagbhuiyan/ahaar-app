import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { deleteAccount } from '@/lib/api/endpoints/profile';
import { useDeleteAccount } from '@/lib/query/hooks';
import { useAuthStore, useCartStore, useInstantOrderStore } from '@/lib/store';

jest.mock('@/lib/api/endpoints/profile', () => ({
  ...jest.requireActual('@/lib/api/endpoints/profile'),
  deleteAccount: jest.fn(),
}));

const mockDeleteAccount = deleteAccount as jest.MockedFunction<typeof deleteAccount>;

function TestConsumer({ onSuccess }: { onSuccess?: () => void }) {
  const deleteMutation = useDeleteAccount({ onSuccess });

  return (
    <Pressable
      testID="delete-account-btn"
      onPress={() => deleteMutation.mutate({ password: 'secret-password' })}
    >
      <Text>Delete Account</Text>
    </Pressable>
  );
}

describe('useDeleteAccount hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    useAuthStore.setState({
      token: 'test-token',
      user: {
        id: 1,
        name: 'Tester',
        email: 'tester@example.com',
        roles: ['customer'],
      },
    });

    useCartStore.setState({
      addressId: 10,
    });

    useInstantOrderStore.setState({
      addressId: 20,
    });
  });

  it('calls deleteAccount API, wipes auth session, clears cart/drafts and triggers onSuccess', async () => {
    mockDeleteAccount.mockResolvedValueOnce(undefined);
    const onSuccess = jest.fn();

    await render(
      <QueryClientProvider client={queryClient}>
        <TestConsumer onSuccess={onSuccess} />
      </QueryClientProvider>,
    );

    expect(useAuthStore.getState().token).toBe('test-token');
    expect(useCartStore.getState().addressId).toBe(10);
    expect(useInstantOrderStore.getState().addressId).toBe(20);

    await act(async () => {
      fireEvent.press(screen.getByTestId('delete-account-btn'));
    });

    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalledWith({ password: 'secret-password' });
      expect(useAuthStore.getState().token).toBeNull();
      expect(useAuthStore.getState().user).toBeNull();
      expect(useCartStore.getState().addressId).toBeNull();
      expect(useInstantOrderStore.getState().addressId).toBeNull();
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});

