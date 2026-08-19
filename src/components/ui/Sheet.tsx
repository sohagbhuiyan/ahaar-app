import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  /** Sticky footer — put the primary action here so it stays reachable. */
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Bottom sheet.
 *
 * Built on RN's `Modal` rather than a gesture library: it gets the platform's
 * own back-button handling and focus containment for free, which a
 * hand-rolled overlay does not. `@gorhom/bottom-sheet` would add drag-to-
 * dismiss, but also a native dependency this app doesn't otherwise need.
 *
 * Content scrolls and is height-capped so a long add-on list can't push the
 * footer off-screen.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  className,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      // Android hardware back closes the sheet, not the screen behind it.
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1 justify-end">
        {/* Scrim — tapping outside dismisses. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          className="absolute inset-0 bg-black/40"
        />

        <View
          className={cn(
            'max-h-[85%] rounded-t-3xl bg-surface',
            className,
          )}
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          {/* Grabber — signals "this can be dismissed" even without a gesture. */}
          <View className="items-center pt-3 pb-1">
            <View className="h-1 w-10 rounded-full bg-border" />
          </View>

          {title ? (
            <View className="px-5 pb-3 pt-2">
              <Text className="text-lg font-bold text-text-primary">{title}</Text>
              {description ? (
                <Text className="mt-1 text-sm text-text-secondary">{description}</Text>
              ) : null}
            </View>
          ) : null}

          <ScrollView
            className="px-5"
            contentContainerStyle={{ paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          {footer ? (
            <View className="border-t border-border px-5 pt-4">{footer}</View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
