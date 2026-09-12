import { useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import type { CatalogVideo, MediaImage } from '@/lib/api/types/catalog';
import { FOOD_BLURHASH } from '@/lib/constants/images';
import { cn } from '@/lib/utils';

import { PlayBadge, TapToPlayVideo } from './VideoPlayer';

type Tile =
  | { kind: 'image'; key: string; image: MediaImage; imageIndex: number }
  | { kind: 'video'; key: string; video: CatalogVideo };

/** Pictures in the order the API sent them (cover first), then the video. */
function buildTiles(images: MediaImage[] | undefined, video: CatalogVideo | undefined): Tile[] {
  const tiles: Tile[] = (images ?? []).map((image, imageIndex) => ({
    kind: 'image',
    key: `image-${imageIndex}-${image.url}`,
    image,
    imageIndex,
  }));
  if (video) tiles.push({ kind: 'video', key: `video-${video.url}`, video });
  return tiles;
}

interface Props {
  images?: MediaImage[];
  video?: CatalogVideo;
  /** The item's name — the label for any picture without alt text. */
  label: string;
  /** Rendered instead when there is nothing to show: the screen's own hero. */
  fallback?: React.ReactNode;
  /** Size and shape of the slide area. The width always follows the container. */
  className?: string;
  /** Side padding for the thumbnail strip, for galleries drawn edge to edge. */
  thumbnailsInset?: number;
}

/**
 * A menu item's or package's pictures and video, product-page style.
 *
 * Swipe between slides or tap a thumbnail to jump to one; tap a picture to see
 * it full screen. The video comes last, behind its poster, and only loads when
 * play is pressed (see `TapToPlayVideo`).
 *
 * It draws nothing of its own when there is nothing to show — no empty frame,
 * no placeholder slot for a video that was never uploaded. `fallback` renders
 * instead, which is how a detail screen looks exactly as it always did for an
 * item without a gallery. One picture and no video is a plain picture: no
 * dots, no thumbnails.
 */
export function MediaGallery({
  images,
  video,
  label,
  fallback = null,
  className,
  thumbnailsInset = 0,
}: Props) {
  const tiles = buildTiles(images, video);

  const { width: windowWidth } = useWindowDimensions();
  // Starts at the window width so the first frame already pages sensibly, then
  // corrects on layout for screens that inset the gallery.
  const [width, setWidth] = useState(windowWidth);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const listRef = useRef<FlatList<Tile>>(null);

  if (tiles.length === 0) return <>{fallback}</>;

  const multiple = tiles.length > 1;
  const cover = images?.[0]?.url ?? null;

  const select = (index: number) => {
    setActive(index);
    // Leaving the video unmounts its player: nothing should keep playing on a
    // slide the customer can no longer see.
    if (tiles[index]?.kind !== 'video') setPlaying(false);
  };

  const jumpTo = (index: number) => {
    select(index);
    listRef.current?.scrollToOffset({ offset: index * width, animated: true });
  };

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1));
    if (index !== active) select(index);
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== width) setWidth(next);
  };

  const renderSlide = (tile: Tile) => {
    const slideStyle = { width: multiple ? width : ('100%' as const), height: '100%' as const };

    return tile.kind === 'image' ? (
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={`${tile.image.alt ?? label}, picture ${tile.imageIndex + 1}. Opens full screen`}
        onPress={() => setViewerIndex(tile.imageIndex)}
        style={slideStyle}
      >
        <Image
          source={{ uri: tile.image.url }}
          placeholder={{ blurhash: FOOD_BLURHASH }}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          style={{ width: '100%', height: '100%' }}
        />
      </Pressable>
    ) : (
      <View style={slideStyle}>
        <TapToPlayVideo
          url={tile.video.url}
          posterUrl={tile.video.poster_url ?? cover}
          durationSeconds={tile.video.duration_seconds}
          label={label}
          playing={playing}
          onPlayingChange={setPlaying}
          className="h-full w-full"
        />
      </View>
    );
  };

  return (
    <View>
      <View
        onLayout={onLayout}
        className={cn('w-full overflow-hidden bg-surface-muted', className)}
      >
        {multiple ? (
          <FlatList
            ref={listRef}
            data={tiles}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(tile) => tile.key}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            onMomentumScrollEnd={onMomentumScrollEnd}
            extraData={`${width}-${playing}`}
            renderItem={({ item }) => renderSlide(item)}
          />
        ) : (
          renderSlide(tiles[0])
        )}

        {/* Hidden while a video plays, where they would sit on its controls. */}
        {multiple && !playing ? (
          <View
            testID="gallery-dots"
            style={{ pointerEvents: 'none' }}
            className="absolute bottom-3 left-0 right-0 flex-row justify-center gap-1.5"
          >
            {tiles.map((tile, index) => (
              <View
                key={tile.key}
                className={cn(
                  'h-1.5 rounded-full',
                  index === active ? 'w-4 bg-white' : 'w-1.5 bg-white/60',
                )}
              />
            ))}
          </View>
        ) : null}
      </View>

      {multiple ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ gap: 8, paddingHorizontal: thumbnailsInset, paddingTop: 12 }}
        >
          {tiles.map((tile, index) => (
            <Thumbnail
              key={tile.key}
              tile={tile}
              cover={cover}
              selected={index === active}
              onPress={() => jumpTo(index)}
            />
          ))}
        </ScrollView>
      ) : null}

      {viewerIndex !== null && images ? (
        <ImageViewer
          key={viewerIndex}
          images={images}
          startIndex={viewerIndex}
          label={label}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}
    </View>
  );
}

function Thumbnail({
  tile,
  cover,
  selected,
  onPress,
}: {
  tile: Tile;
  cover: string | null;
  selected: boolean;
  onPress: () => void;
}) {
  const source = tile.kind === 'image' ? tile.image.url : (tile.video.poster_url ?? cover);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tile.kind === 'image' ? `Show picture ${tile.imageIndex + 1}` : 'Show video'}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={cn(
        'h-14 w-14 overflow-hidden rounded-xl border-2 bg-surface-muted active:opacity-80',
        selected ? 'border-brand-500' : 'border-transparent',
      )}
    >
      {source ? (
        <Image
          source={{ uri: source }}
          contentFit="cover"
          cachePolicy="memory-disk"
          style={{ width: '100%', height: '100%' }}
        />
      ) : null}

      {tile.kind === 'video' ? (
        <View className="absolute inset-0 items-center justify-center">
          <PlayBadge size="sm" />
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Pictures full screen, swipeable, opened on the one that was tapped.
 *
 * Mounted only while open and keyed by the starting picture, so every opening
 * lands on the right one without an effect to keep an index in sync.
 */
function ImageViewer({
  images,
  startIndex,
  label,
  onClose,
}: {
  images: MediaImage[];
  startIndex: number;
  label: string;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(startIndex);

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 bg-black">
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          initialScrollIndex={startIndex}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          keyExtractor={(image, index) => `${index}-${image.url}`}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) =>
            setCurrent(Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1)))
          }
          renderItem={({ item }) => (
            <Image
              source={{ uri: item.url }}
              contentFit="contain"
              cachePolicy="memory-disk"
              style={{ width, height }}
              accessibilityLabel={item.alt ?? label}
            />
          )}
        />

        <View
          className="absolute left-0 right-0 flex-row items-center justify-between px-5"
          style={{ top: insets.top + 8 }}
        >
          <Text className="text-sm font-semibold text-white">
            {images.length > 1 ? `${current + 1} / ${images.length}` : ''}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close pictures"
            onPress={onClose}
            hitSlop={12}
            className="h-10 w-10 items-center justify-center rounded-full bg-white/20 active:opacity-70"
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M18 6 6 18M6 6l12 12"
                stroke="#ffffff"
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
