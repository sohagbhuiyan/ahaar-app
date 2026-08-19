import { Text, View } from 'react-native';

import { Button } from './Button';
import { isApiError } from '@/lib/api/types/common';
import { cn } from '@/lib/utils';

// ── Empty ────────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  title: string;
  description?: string;
  /** Illustration or icon. */
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/** Zero results — a valid outcome, so it must not look like a failure. */
export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <View className={cn('items-center px-8 py-12', className)}>
      {icon ? <View className="mb-4">{icon}</View> : null}

      <Text className="text-center text-base font-bold text-text-primary">
        {title}
      </Text>

      {description ? (
        <Text className="mt-1.5 text-center text-sm text-text-secondary">
          {description}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          variant="secondary"
          size="sm"
          onPress={onAction}
          fullWidth={false}
          className="mt-5"
        />
      ) : null}
    </View>
  );
}

// ── Error ────────────────────────────────────────────────────────────────────

interface ErrorStateProps {
  /** The thrown value. `ApiError` messages are already customer-safe. */
  error?: unknown;
  title?: string;
  /** Wire to the query's `refetch`. */
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

/**
 * Failure with a way out.
 *
 * The message comes from the normalised `ApiError` the axios interceptor
 * produces, so business rules surface verbatim ("Delivery is past cutoff")
 * while 5xx internals stay hidden behind a generic string.
 */
export function ErrorState({
  error,
  title,
  onRetry,
  retrying = false,
  className,
}: ErrorStateProps) {
  const offline = isApiError(error) && error.code === 'network';

  const heading =
    title ?? (offline ? "You're offline" : 'Something went wrong');

  const message = isApiError(error)
    ? error.message
    : 'Please try again in a moment.';

  return (
    <View className={cn('items-center px-8 py-12', className)}>
      <Text className="text-center text-base font-bold text-text-primary">
        {heading}
      </Text>

      <Text className="mt-1.5 text-center text-sm text-text-secondary">
        {message}
      </Text>

      {onRetry ? (
        <Button
          label="Try again"
          variant="secondary"
          size="sm"
          onPress={onRetry}
          loading={retrying}
          fullWidth={false}
          className="mt-5"
        />
      ) : null}
    </View>
  );
}

// ── Inline error ─────────────────────────────────────────────────────────────

/** Compact variant for failures beside content that did load. */
export function InlineError({
  error,
  className,
}: {
  error?: unknown;
  className?: string;
}) {
  const message = isApiError(error)
    ? error.message
    : 'Something went wrong. Please try again.';

  return (
    <View
      className={cn(
        'rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3',
        className,
      )}
    >
      <Text className="text-sm text-danger">{message}</Text>
    </View>
  );
}
