import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import MediaVideoScreen from '@/app/media/[id]';
import * as mediaApi from '@/lib/api/endpoints/media';
import type { MediaComment, MediaVideo } from '@/lib/api/types/media';
import { useAuthPromptStore, useAuthStore } from '@/lib/store';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '7' }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useFocusEffect: jest.fn(),
}));

jest.mock('@/lib/api/endpoints/media');

const api = jest.mocked(mediaApi);

const video: MediaVideo = {
  id: 7,
  title: 'How we make our dal',
  description: 'Slow-cooked every morning.',
  video_url: 'https://cdn.test/dal.mp4',
  mime_type: 'video/mp4',
  poster_url: null,
  duration_seconds: 95,
  comments_count: 1,
  published_at: '2026-09-10T10:00:00+00:00',
};

const existing: MediaComment = {
  id: 1,
  body: 'Smells amazing',
  created_at: '2026-09-10T09:00:00+00:00',
  author: { id: 3, name: 'Sara M.' },
  is_mine: false,
};

function renderScreen() {
  const client = new QueryClient({
    // No garbage-collection timers, so Jest can exit as soon as the tests end.
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <MediaVideoScreen />
    </QueryClientProvider>,
  );
}

describe('Media video comments', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Let persisted-session rehydration finish first, so it cannot overwrite
    // the session a test sets up.
    await waitFor(() => expect(useAuthStore.getState().hasHydrated).toBe(true));
    useAuthStore.setState({ token: null, user: null });
    useAuthPromptStore.setState({ open: false, reason: null, pendingAction: null });

    api.getMediaVideo.mockResolvedValue(video);
    api.getMediaComments.mockResolvedValue({
      data: [existing],
      meta: { current_page: 1, per_page: 20, total: 1, last_page: 1 },
    });
  });

  it('asks a signed-out visitor to sign in instead of posting', async () => {
    await renderScreen();

    expect(await screen.findByText('Smells amazing')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Sign in to comment'));

    expect(useAuthPromptStore.getState().open).toBe(true);
    expect(useAuthPromptStore.getState().reason).toBe('to join the conversation');
    expect(api.createMediaComment).not.toHaveBeenCalled();
  });

  it('posts a signed-in comment and shows it in the list', async () => {
    useAuthStore.setState({
      token: 'token',
      user: { id: 9, name: 'Aziz Khan', email: 'aziz@gmail.com', roles: ['customer'] },
    });
    api.createMediaComment.mockResolvedValue({
      id: 99,
      body: 'Looks delicious!',
      created_at: new Date().toISOString(),
      author: { id: 9, name: 'Aziz K.' },
      is_mine: true,
    });

    await renderScreen();

    expect(await screen.findByText('Smells amazing')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Comment'), '  Looks delicious!  ');
    await fireEvent.press(screen.getByLabelText('Post comment'));

    await waitFor(() =>
      expect(api.createMediaComment).toHaveBeenCalledWith(7, 'Looks delicious!'),
    );
    expect(await screen.findByText('Looks delicious!')).toBeTruthy();
    // Their own comment carries the delete action; someone else's does not.
    expect(screen.getAllByLabelText('Delete your comment')).toHaveLength(1);
  });
});
