import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import { Avatar, Button } from '@/components/ui';
import { isApiError } from '@/lib/api/types/common';
import {
  COMMENT_MAX_LENGTH,
  COMMENT_MIN_LENGTH,
  type MediaComment,
} from '@/lib/api/types/media';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import { useCreateMediaComment, useIsSignedIn } from '@/lib/query/hooks';
import { colors } from '@/lib/theme';
import { formatRelativeTime } from '@/lib/utils';

export function MediaCommentItem({
  comment,
  onDelete,
}: {
  comment: MediaComment;
  /** Offered only on the customer's own comments. */
  onDelete?: (comment: MediaComment) => void;
}) {
  return (
    <View className="flex-row gap-3 py-3">
      <Avatar name={comment.author.name} size="sm" />

      <View className="flex-1">
        <View className="flex-row flex-wrap items-center gap-x-2">
          <Text className="text-sm font-bold text-text-primary">{comment.author.name}</Text>
          <Text className="text-xs text-text-muted">{formatRelativeTime(comment.created_at)}</Text>
        </View>

        <Text className="mt-0.5 text-sm leading-5 text-text-secondary">{comment.body}</Text>

        {comment.is_mine && onDelete ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete your comment"
            onPress={() => onDelete(comment)}
            hitSlop={8}
            className="mt-1 self-start active:opacity-70"
          >
            <Text className="text-xs font-semibold text-danger">Delete</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** The API's own sentence: a 422 names the broken rule, a 429 says slow down. */
function commentError(error: unknown): string | null {
  if (!error) return null;
  if (!isApiError(error)) return 'Your comment could not be posted. Please try again.';
  return error.errors?.body?.[0] ?? error.message;
}

/**
 * The comment box pinned under a video.
 *
 * Signed out, it is a prompt rather than a field: pressing it opens the login
 * sheet, and signing in brings the customer back to a focused box instead of
 * making them tap again. The screen's KeyboardAvoidingView keeps it above the
 * keyboard; the home-indicator inset is dropped while typing so there is no
 * gap between the box and the keys.
 */
export function MediaCommentComposer({ videoId }: { videoId: number }) {
  const insets = useSafeAreaInsets();
  const signedIn = useIsSignedIn();
  const requireAuth = useRequireAuth();
  const create = useCreateMediaComment(videoId);

  const [body, setBody] = useState('');
  const [focusOnMount, setFocusOnMount] = useState(false);
  const keyboardOpen = useKeyboardOpen();

  const trimmed = body.trim();
  const error = commentError(create.error);
  const bottomPadding = (keyboardOpen ? 0 : insets.bottom) + 12;

  const submit = () => {
    if (trimmed.length < COMMENT_MIN_LENGTH || create.isPending) return;
    create.mutate(trimmed, {
      onSuccess: () => {
        setBody('');
        toast.success('Comment posted');
      },
    });
  };

  if (!signedIn) {
    return (
      <View
        className="border-t border-border bg-surface px-5 pt-3"
        style={{ paddingBottom: bottomPadding }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign in to comment"
          onPress={() => requireAuth(() => setFocusOnMount(true), 'to join the conversation')}
          className="rounded-2xl border border-border px-4 py-3.5 active:opacity-70"
        >
          <Text className="text-base text-text-muted">Sign in to add a comment…</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      className="border-t border-border bg-surface px-5 pt-3"
      style={{ paddingBottom: bottomPadding }}
    >
      {error ? <Text className="mb-2 text-xs font-medium text-danger">{error}</Text> : null}

      <View className="flex-row items-end gap-2">
        <TextInput
          value={body}
          onChangeText={(text) => {
            setBody(text);
            if (create.isError) create.reset();
          }}
          placeholder="Add a comment…"
          placeholderTextColor={colors.text.muted}
          accessibilityLabel="Comment"
          autoFocus={focusOnMount}
          multiline
          maxLength={COMMENT_MAX_LENGTH}
          className="max-h-28 min-h-12 flex-1 rounded-2xl border border-border bg-surface px-4 py-3 text-base text-text-primary"
        />

        <Button
          label="Post"
          accessibilityLabel="Post comment"
          fullWidth={false}
          loading={create.isPending}
          disabled={trimmed.length < COMMENT_MIN_LENGTH}
          onPress={submit}
        />
      </View>

      {body.length > COMMENT_MAX_LENGTH - 100 ? (
        <Text className="mt-1 text-right text-[11px] text-text-muted">
          {body.length}/{COMMENT_MAX_LENGTH}
        </Text>
      ) : null}
    </View>
  );
}

function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // iOS reports before the animation, Android only after it.
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setOpen(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return open;
}
