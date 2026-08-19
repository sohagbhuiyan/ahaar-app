/**
 * The "sign in to continue" prompt.
 *
 * Browsing is public: plans, the catalogue and every dish detail render for a
 * signed-out visitor. Authentication is demanded only at the moment it is
 * actually needed — placing an instant order, subscribing, ordering extras,
 * opening the profile. Rather than redirecting to a login *screen* (which
 * loses the visitor's place and their half-built order), those call sites push
 * the intent in here and a modal takes over in place.
 *
 * `pendingAction` is what makes it feel seamless: the tap that triggered the
 * prompt is replayed the instant the session exists, so signing in *completes*
 * the action instead of merely permitting it.
 *
 * Not persisted. A pending action captured before an app kill refers to a
 * screen that is no longer mounted.
 */
import { create } from 'zustand';

interface AuthPromptState {
  open: boolean;
  /** One line explaining what the sign-in unlocks, e.g. "to place this order". */
  reason: string | null;
  /** Replayed after a successful sign-in. Cleared once run. */
  pendingAction: (() => void) | null;

  /**
   * Open the prompt. `action` runs on success — pass the thing the user was
   * trying to do, not a navigation to where they already are.
   */
  prompt: (reason?: string, action?: () => void) => void;
  /** Dismissed without signing in. The pending action is dropped. */
  close: () => void;
  /** Signed in: close, then replay whatever was pending. */
  resolve: () => void;
}

export const useAuthPromptStore = create<AuthPromptState>((set, get) => ({
  open: false,
  reason: null,
  pendingAction: null,

  prompt: (reason, action) =>
    set({ open: true, reason: reason ?? null, pendingAction: action ?? null }),

  close: () => set({ open: false, reason: null, pendingAction: null }),

  resolve: () => {
    const { pendingAction } = get();
    set({ open: false, reason: null, pendingAction: null });
    // After the state update so the modal is already dismissing when the
    // action navigates — otherwise the sheet animates out over the new screen.
    pendingAction?.();
  },
}));
