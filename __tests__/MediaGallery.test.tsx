import { fireEvent, render, screen } from '@testing-library/react-native';
import { useVideoPlayer } from 'expo-video';
import { Text } from 'react-native';

import { MediaGallery } from '@/components/shared/MediaGallery';
import type { CatalogVideo, MediaImage } from '@/lib/api/types/catalog';

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));

const image = (n: number): MediaImage => ({
  url: `https://cdn.test/biryani-${n}.jpg`,
  alt: 'Chicken Biryani',
});

const video: CatalogVideo = {
  url: 'https://cdn.test/biryani.mp4',
  mime_type: 'video/mp4',
  poster_url: 'https://cdn.test/biryani-poster.jpg',
  duration_seconds: 42,
};

describe('MediaGallery', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders only the fallback when there are no images and no video', async () => {
    await render(
      <MediaGallery label="Chicken Biryani" fallback={<Text>existing hero</Text>} />,
    );

    expect(screen.getByText('existing hero')).toBeTruthy();
    expect(screen.queryByTestId('gallery-dots')).toBeNull();
    expect(screen.queryAllByLabelText(/^Show picture/)).toHaveLength(0);
    expect(screen.queryByLabelText(/^Play video/)).toBeNull();
  });

  it('shows a single image without dots or thumbnails', async () => {
    await render(<MediaGallery images={[image(1)]} label="Chicken Biryani" />);

    expect(screen.getByLabelText(/picture 1\. Opens full screen/)).toBeTruthy();
    expect(screen.queryByTestId('gallery-dots')).toBeNull();
    expect(screen.queryAllByLabelText(/^Show picture/)).toHaveLength(0);
  });

  it('shows a thumbnail per image and moves to the one pressed', async () => {
    await render(
      <MediaGallery images={[image(1), image(2), image(3), image(4)]} label="Chicken Biryani" />,
    );

    const thumbnails = screen.getAllByLabelText(/^Show picture/);
    expect(thumbnails).toHaveLength(4);
    expect(screen.getByTestId('gallery-dots')).toBeTruthy();
    expect(thumbnails[0].props.accessibilityState).toMatchObject({ selected: true });

    await fireEvent.press(thumbnails[2]);

    const after = screen.getAllByLabelText(/^Show picture/);
    expect(after[2].props.accessibilityState).toMatchObject({ selected: true });
    expect(after[0].props.accessibilityState).toMatchObject({ selected: false });
  });

  it('offers the video behind a play button and only loads it when pressed', async () => {
    await render(<MediaGallery images={[image(1)]} video={video} label="Chicken Biryani" />);

    expect(screen.getByLabelText('Show video')).toBeTruthy();
    expect(useVideoPlayer).not.toHaveBeenCalled();
    expect(screen.queryByTestId('video-view')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Play video: Chicken Biryani'));

    expect(useVideoPlayer).toHaveBeenCalledWith(video.url, expect.any(Function));
    expect(screen.getByTestId('video-view')).toBeTruthy();
  });

  it('renders a video on its own when there are no images', async () => {
    await render(<MediaGallery video={video} label="Chicken Biryani" />);

    expect(screen.getByLabelText('Play video: Chicken Biryani')).toBeTruthy();
    expect(screen.queryByTestId('gallery-dots')).toBeNull();
  });

  it('has no play control when there is no video', async () => {
    await render(<MediaGallery images={[image(1), image(2)]} label="Chicken Biryani" />);

    expect(screen.queryByLabelText(/^Play video/)).toBeNull();
    expect(screen.queryByLabelText('Show video')).toBeNull();
    expect(useVideoPlayer).not.toHaveBeenCalled();
  });
});
