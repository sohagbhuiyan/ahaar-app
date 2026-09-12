/**
 * `@gorhom/bottom-sheet` for Jest.
 *
 * The library's own `mock.js` renders modal content whether or not it was
 * presented, and has no footer, so a test could neither tell an open sheet
 * from a closed one nor find the primary button. This one honours
 * present()/dismiss() and renders the handle, the content and the footer the
 * way the real sheet lays them out.
 *
 * It also keeps the one quirk of the real modal that `Sheet` has to respect:
 * `dismiss()` on a modal that isn't presented leaves it "dismissing" with
 * nothing to dismiss, and while it is stuck like that `present()` draws
 * nothing (`BottomSheetModal.tsx`, `handleDismiss` and `handlePortalRender`).
 * Only another `dismiss()` clears it. That is what made "Sign in" taps do
 * nothing, so a regression shows up here rather than on a phone.
 *
 * A button labelled "Drag sheet closed" stands in for the customer swiping
 * the sheet away or tapping the backdrop.
 */
const React = require('react');
const { Pressable, View } = require('react-native');

const base = require('@gorhom/bottom-sheet/mock');

const KEYBOARD_STATUS = { UNDETERMINED: 0, SHOWN: 1, HIDDEN: 2 };

const BottomSheetModal = React.forwardRef(function BottomSheetModal(props, ref) {
  const [, rerender] = React.useReducer((n) => n + 1, 0);
  /** 'idle' | 'presented' | 'stuck' */
  const status = React.useRef('idle');
  const onDismiss = React.useRef(props.onDismiss);
  onDismiss.current = props.onDismiss;

  /** The sheet has gone, however it went. */
  const unmount = () => {
    status.current = 'idle';
    rerender();
    onDismiss.current?.();
  };

  React.useImperativeHandle(ref, () => ({
    present: () => {
      if (status.current === 'idle') status.current = 'presented';
      rerender();
    },
    dismiss: () => {
      if (status.current === 'idle') {
        status.current = 'stuck';
        return;
      }
      unmount();
    },
    close: () => {
      if (status.current === 'presented') unmount();
    },
    forceClose: () => {
      if (status.current === 'presented') unmount();
    },
    snapToIndex: () => {},
    snapToPosition: () => {},
    expand: () => {},
    collapse: () => {},
  }));

  if (status.current !== 'presented') return null;

  const { handleComponent: Handle, footerComponent: Footer, children } = props;

  return React.createElement(
    View,
    { testID: 'bottom-sheet' },
    Handle ? React.createElement(Handle, {}) : null,
    typeof children === 'function' ? children({}) : children,
    Footer
      ? React.createElement(Footer, { animatedFooterPosition: { value: 0, get: () => 0 } })
      : null,
    React.createElement(Pressable, {
      accessibilityRole: 'button',
      accessibilityLabel: 'Drag sheet closed',
      onPress: unmount,
    }),
  );
});

module.exports = {
  ...base,
  BottomSheetModal,
  BottomSheetFooter: ({ children }) => children,
  BottomSheetBackdrop: () => null,
  KEYBOARD_STATUS,
  useBottomSheetInternal: () => ({
    animatedKeyboardState: {
      value: { status: KEYBOARD_STATUS.HIDDEN },
      get: () => ({ status: KEYBOARD_STATUS.HIDDEN }),
    },
  }),
};
