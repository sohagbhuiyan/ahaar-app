import { memo, useState } from 'react';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { FOOD_BLURHASH } from '@/lib/constants/images';
import { cn } from '@/lib/utils';

type GlyphSize = 'sm' | 'md' | 'lg';

const GLYPH_CLASS: Record<GlyphSize, string> = {
  sm: 'text-base',
  md: 'text-2xl',
  lg: 'text-5xl',
};

interface Props {
  /** The absolute `image_url` a customer endpoint returns, or null. */
  uri: string | null | undefined;
  /**
   * Screen-reader name. Leave it off for a thumbnail sitting next to the dish's
   * own name, or the name is read twice.
   */
  label?: string;
  /** The frame: size, radius, margins — e.g. `h-12 w-12 rounded-xl`. */
  className?: string;
  /** Shown when there is no picture. 🍽️ for dishes and plans, 🍱 for boxes. */
  glyph?: string;
  glyphSize?: GlyphSize;
  /** On the picture; the fallback carries `${testID}-fallback`. */
  testID?: string;
  /** Drawn over the picture — a "Sold out" scrim, say. */
  children?: React.ReactNode;
}

/**
 * A dish, plan or meal box picture, with one fallback everywhere.
 *
 * Before this, each screen handled a missing picture its own way: an empty grey
 * square on one, a 🍱 on another, nothing at all on a third — which reads as a
 * broken load rather than "no photo yet". The fallback is also taken when a URL
 * is present but fails to load (a deleted upload, a dead CDN link), since a
 * blurhash that never resolves looks exactly like a hang.
 */
function FoodImageComponent({
  uri,
  label,
  className,
  glyph = '🍽️',
  glyphSize = 'md',
  testID,
  children,
}: Props) {
  // The URL that failed, not a bare flag: a recycled list row handed a new URL
  // must try it rather than inherit the previous row's failure.
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const src = uri && uri !== failedUri ? uri : null;

  return (
    <View className={cn('overflow-hidden bg-surface-muted', className)}>
      {src ? (
        <Image
          source={{ uri: src }}
          placeholder={{ blurhash: FOOD_BLURHASH }}
          contentFit="cover"
          transition={200}
          // Both caches: survives scroll-away and app restart.
          cachePolicy="memory-disk"
          recyclingKey={src}
          onError={() => setFailedUri(src)}
          style={{ width: '100%', height: '100%' }}
          accessibilityLabel={label}
          testID={testID}
        />
      ) : (
        <View
          testID={testID ? `${testID}-fallback` : undefined}
          accessible={Boolean(label)}
          accessibilityRole={label ? 'image' : undefined}
          accessibilityLabel={label}
          className="h-full w-full items-center justify-center bg-brand-50"
        >
          <Text
            className={GLYPH_CLASS[glyphSize]}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {glyph}
          </Text>
        </View>
      )}

      {children}
    </View>
  );
}

export const FoodImage = memo(FoodImageComponent);
