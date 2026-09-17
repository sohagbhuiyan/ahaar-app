import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import MediaScreen from '@/app/(tabs)/media';
import * as mediaApi from '@/lib/api/endpoints/media';
import type { MediaComment, MediaVideo } from '@/lib/api/types/media';
import { useAuthStore } from '@/lib/store';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), navigate: jest.fn(), replace: jest.fn() }),
  useFocusEffect: jest.fn(),
}));

jest.mock('@/lib/api/endpoints/media');

const api = jest.mocked(mediaApi);

const video: MediaVideo = {
  id: 2,
  title: 'Morning prep in the kitchen',
  description: 'Chopping, searing and packing lunch.',
  video_url: 'https://cdn.test/prep.mp4',
  mime_type: 'video/mp4',
  poster_url: null,
  duration_seconds: 20,
  comments_count: 3,
  published_at: '2026-09-10T15:42:27+02:00',
};

const comment = (id: number, body: string): MediaComment => ({
  id,
  body,
  created_at: '2026-09-11T09:00:00+00:00',
  author: { id: id + 10, name: `Customer ${id}` },
  is_mine: false,
});

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MediaScreen />
    </QueryClientProvider>,
  );
}

describe('Media tab', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await waitFor(() => expect(useAuthStore.getState().hasHydrated).toBe(true));
    useAuthStore.setState({ token: null, user: null });

    api.getMediaVideos.mockResolvedValue({
      data: [video],
      meta: { current_page: 1, per_page: 12, total: 1, last_page: 1 },
    });
    api.getMediaComments.mockResolvedValue({
      data: [comment(3, 'Newest one'), comment(2, 'Looks fresh'), comment(1, 'Oldest one')],
      meta: { current_page: 1, per_page: 20, total: 3, last_page: 1 },
    });
  });

  it('lists each video with a preview of its newest comments', async () => {
    await renderScreen();

    expect(await screen.findByText('Morning prep in the kitchen')).toBeTruthy();
    expect(await screen.findByText('Newest one')).toBeTruthy();
    expect(screen.getByText('Looks fresh')).toBeTruthy();
    // Two in the preview; the rest are one tap away.
    expect(screen.queryByText('Oldest one')).toBeNull();
    expect(screen.getByText('View all 3 comments')).toBeTruthy();
  });

  it('starts the video from its poster and opens the comments without playing', async () => {
    await renderScreen();

    await fireEvent.press(await screen.findByLabelText('Play video: Morning prep in the kitchen'));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/media/[id]',
      params: { id: '2', autoplay: '1' },
    });

    await screen.findByText('Newest one');
    await fireEvent.press(screen.getByLabelText('Read 3 comments on Morning prep in the kitchen'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/media/[id]', params: { id: '2' } });
  });
});
