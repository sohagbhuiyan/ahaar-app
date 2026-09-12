import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  KEYBOARD_STATUS,
  useBottomSheetInternal,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
  type BottomSheetScrollViewMethods,
} from '@gorhom/bottom-sheet';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import {
  BackHandler,
  Platform,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FullWindowOverlay } from 'react-native-screens';

import { colors } from '@/lib/theme';
import { cn } from '@/lib/utils';

import { SheetContext, type SheetContextValue } from './sheetContext';
import { scrollOffsetToReveal } from './sheetScroll';

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

/** The sheet never grows past this share of the window; longer content scrolls. */
const MAX_HEIGHT_RATIO = 0.9;

/**
 * The keyboard resizes the scroll view over a few hundred milliseconds, one
 * layout per frame. The focused field is revealed once layouts have been quiet
 * this long, rather than chased frame by frame.
 */
const LAYOUT_SETTLE_MS = 100;

const SHEET_BACKGROUND = {
  backgroundColor: colors.surface.DEFAULT,
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
};

/**
 * Bottom sheet.
 *
 * Built on `@gorhom/bottom-sheet`. It used to be RN's `Modal`, which had a
 * problem nothing inside it could fix: a transparent Modal is a window of its
 * own, so the keyboard slid straight over it. Android never resizes that
 * window, and on iOS a KeyboardAvoidingView inside the height-capped panel only
 * padded the content, not the panel — the sign-in fields and the button under
 * them ended up behind the keyboard.
 *
 * The library moves the whole sheet instead:
 *   - `keyboardBehavior="interactive"` lifts it by the keyboard's height, in
 *     step with the keyboard animation, and `keyboardBlurBehavior="restore"`
 *     settles it back when the keyboard goes. On Android too — see
 *     `android_keyboardInputMode` below.
 *   - `footer` renders through `footerComponent`, which the library keeps
 *     pinned above the keyboard, so the primary action stays reachable while
 *     typing.
 *   - `Input` switches to `BottomSheetTextInput` inside a sheet (via
 *     `SheetContext`) — how the library knows which field has focus.
 *   - When the sheet and the keyboard don't both fit on screen, the library
 *     shrinks the scroll view but never scrolls it, so a field could end up
 *     behind the footer. `Input` reports focus through `SheetContext` as well,
 *     and the sheet scrolls that field clear of the footer: on focus, and
 *     again once the keyboard has finished resizing it.
 *
 * It keeps what the Modal gave for free: Android's back button closes the
 * sheet, and on iOS the sheet mounts in a `FullWindowOverlay`, so it still
 * appears above the modal-presented `/order` and `/checkout` screens, which
 * open sheets of their own.
 *
 * Sized to its content and capped at 90% of the window, so a long add-on list
 * scrolls rather than pushing the footer off-screen. Drag down or tap outside
 * to dismiss.
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
  const { height: windowHeight } = useWindowDimensions();
  const modalRef = useRef<BottomSheetModal>(null);

  // Scroll-to-field bookkeeping. Refs, not state: none of it is rendered.
  const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
  const contentRef = useRef<View>(null);
  const focusedFieldRef = useRef<View | null>(null);
  const scrollOffsetRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /**
   * `open` is the source of truth, but the library's modal is imperative and
   * keeps state of its own that must not be contradicted: `dismiss()` on a
   * modal that isn't showing leaves it "dismissing" with nothing to dismiss,
   * and from then on it ignores `present()`. Calling `dismiss()` on mount, or
   * after the customer had already swiped the sheet away, is what made taps on
   * "Sign in" do nothing. So the sheet tracks what it has asked the modal for
   * and only sends a call that changes something.
   */
  const openRef = useRef(open);
  // From `present()` until the modal reports that it has gone.
  const presentedRef = useRef(false);
  // Set when the close was ours, to tell it apart from a drag or a backdrop tap.
  const closeRequestedRef = useRef(false);

  const syncPresentation = useCallback(() => {
    const modal = modalRef.current;
    if (!modal) return;

    if (openRef.current && !presentedRef.current) {
      presentedRef.current = true;
      closeRequestedRef.current = false;
      modal.present();
    } else if (!openRef.current && presentedRef.current && !closeRequestedRef.current) {
      closeRequestedRef.current = true;
      modal.dismiss();
    }
  }, []);

  useEffect(() => {
    openRef.current = open;
    syncPresentation();
  }, [open, syncPresentation]);

  /** Fires once the sheet has gone, however it went. */
  const handleDismiss = useCallback(() => {
    presentedRef.current = false;
    // The content unmounted with the sheet: no field in it is focused any
    // more, and the next scroll view starts at the top.
    focusedFieldRef.current = null;
    scrollOffsetRef.current = 0;

    const closeWasRequested = closeRequestedRef.current;
    closeRequestedRef.current = false;
    if (!openRef.current) return;

    if (closeWasRequested) {
      // Opened again while it was closing. Present once the modal has
      // finished unmounting the old sheet, not in the middle of it.
      setTimeout(syncPresentation, 0);
    } else {
      // Dragged away or the backdrop tapped: the parent still thinks it's open.
      onClose();
    }
  }, [onClose, syncPresentation]);

  // Android hardware back closes the sheet, not the screen behind it.
  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [open, onClose]);

  const hasFooter = footer !== undefined && footer !== null && footer !== false;
  const [footerSlot] = useState(() => createSlot(footer));
  useLayoutEffect(() => {
    footerSlot.set(footer);
  }, [footerSlot, footer]);

  // The footer floats over the content, so the content reserves its height.
  const [footerHeight, setFooterHeight] = useState(0);
  const handleFooterLayout = useCallback((event: LayoutChangeEvent) => {
    setFooterHeight(Math.round(event.nativeEvent.layout.height));
  }, []);

  /**
   * Scrolls the focused field into the part of the scroll view the footer
   * doesn't cover, moving as little as possible. A sheet that fits above the
   * keyboard already shows every field, so there this does nothing.
   */
  const revealFocusedField = useCallback(() => {
    const field = focusedFieldRef.current;
    const content = contentRef.current;
    if (!field || !content) return;

    field.measureLayout(content, (_x, y, _width, height) => {
      const offset = scrollOffsetToReveal({
        fieldTop: y,
        fieldHeight: height,
        scrollOffset: scrollOffsetRef.current,
        // The footer floats over the bottom of the scroll view.
        visibleHeight: viewportHeightRef.current - (hasFooter ? footerHeight : 0),
      });
      if (offset !== null) scrollRef.current?.scrollTo({ y: offset, animated: true });
    });
  }, [hasFooter, footerHeight]);

  const sheetContext = useMemo<SheetContextValue>(
    () => ({
      onFieldFocus: (field) => {
        focusedFieldRef.current = field;
        revealFocusedField();
      },
      onFieldBlur: (field) => {
        // Moving to the next field can report the new focus before the old
        // blur; only forget the field that is actually leaving.
        if (focusedFieldRef.current === field) focusedFieldRef.current = null;
      },
    }),
    [revealFocusedField],
  );

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  // The scroll view shrinks when the keyboard leaves the sheet too little room.
  const handleScrollLayout = useCallback(
    (event: LayoutChangeEvent) => {
      viewportHeightRef.current = event.nativeEvent.layout.height;
      if (!focusedFieldRef.current) return;
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(revealFocusedField, LAYOUT_SETTLE_MS);
    },
    [revealFocusedField],
  );

  useEffect(() => () => clearTimeout(settleTimerRef.current), []);

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props}>
        <SheetFooter
          slot={footerSlot}
          bottomInset={insets.bottom}
          onLayout={handleFooterLayout}
        />
      </BottomSheetFooter>
    ),
    [footerSlot, insets.bottom, handleFooterLayout],
  );

  // The title lives in the handle: it stays put while the content scrolls, it
  // is draggable like the grabber, and dynamic sizing counts its height.
  const renderHandle = useCallback(
    () => <SheetHandle title={title} description={description} />,
    [title, description],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.4}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      onDismiss={handleDismiss}
      enablePanDownToClose
      enableDynamicSizing
      maxDynamicContentSize={Math.round(windowHeight * MAX_HEIGHT_RATIO)}
      topInset={insets.top}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      // Not `adjustResize`: in that mode the library leaves the sheet where it
      // is and waits for Android to shrink the window. Edge-to-edge is
      // mandatory now, so the window never shrinks and the keyboard covers the
      // fields. `adjustPan` has the library lift the sheet itself, as on iOS.
      android_keyboardInputMode="adjustPan"
      handleComponent={renderHandle}
      backdropComponent={renderBackdrop}
      footerComponent={hasFooter ? renderFooter : undefined}
      backgroundStyle={SHEET_BACKGROUND}
      containerComponent={Platform.OS === 'ios' ? OverlayContainer : undefined}
    >
      <BottomSheetScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        onLayout={handleScrollLayout}
        contentContainerStyle={{
          paddingBottom: hasFooter ? footerHeight + 16 : insets.bottom + 16,
        }}
      >
        <SheetContext.Provider value={sheetContext}>
          {/* Unstyled, so it starts exactly where the scroll content does —
              fields are measured against it. Not collapsable, so it is a real
              view to measure against. */}
          <View ref={contentRef} collapsable={false}>
            <View className={cn('px-5', className)}>{children}</View>
          </View>
        </SheetContext.Provider>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

function SheetHandle({ title, description }: { title?: string; description?: string }) {
  return (
    <View>
      {/* Grabber — signals "this can be dragged away". */}
      <View className="items-center pb-1 pt-3">
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
    </View>
  );
}

function SheetFooter({
  slot,
  bottomInset,
  onLayout,
}: {
  slot: FooterSlot;
  bottomInset: number;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const node = useSyncExternalStore(slot.subscribe, slot.get, slot.get);
  const { animatedKeyboardState } = useBottomSheetInternal();

  // The home-indicator inset only matters while the footer sits at the bottom
  // of the screen. Above the keyboard it would read as a gap under the button.
  const spacerStyle = useAnimatedStyle(
    () => ({
      height:
        16 +
        (animatedKeyboardState.get().status === KEYBOARD_STATUS.SHOWN ? 0 : bottomInset),
    }),
    [bottomInset, animatedKeyboardState],
  );

  return (
    <View onLayout={onLayout} className="border-t border-border bg-surface px-5 pt-4">
      {node}
      <Animated.View style={spacerStyle} />
    </View>
  );
}

/**
 * On iOS the sheet renders above everything, native modals included. Gesture
 * handler does not reach into a `FullWindowOverlay` on its own, hence the root
 * view inside it.
 */
function OverlayContainer({ children }: PropsWithChildren) {
  return (
    <FullWindowOverlay>
      <GestureHandlerRootView style={{ flex: 1 }}>{children}</GestureHandlerRootView>
    </FullWindowOverlay>
  );
}

/**
 * A one-value store holding the latest footer.
 *
 * The library renders `footerComponent` itself and remounts it whenever that
 * function changes. Built from a `footer` element that is new on every parent
 * render, it would change on every render — re-measuring the footer and
 * resetting the button's pressed state on each tap of a stepper. The footer
 * component stays stable and subscribes to this instead.
 */
function createSlot(initial: ReactNode) {
  let current = initial;
  const listeners = new Set<() => void>();

  return {
    get: () => current,
    set: (next: ReactNode) => {
      if (next === current) return;
      current = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

type FooterSlot = ReturnType<typeof createSlot>;
