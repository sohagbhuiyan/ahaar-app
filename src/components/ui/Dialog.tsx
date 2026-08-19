import { Modal, Pressable, Text, View } from 'react-native';

import { Button } from './Button';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  /** Custom actions. Omit to use `AlertDialog`'s confirm/cancel pair instead. */
  footer?: React.ReactNode;
  /** Whether tapping the scrim dismisses. Off for destructive confirmations. */
  dismissOnBackdropPress?: boolean;
  className?: string;
}

/** Centred modal for short, focused decisions. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissOnBackdropPress = true,
  className,
}: DialogProps) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1 items-center justify-center px-6">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={dismissOnBackdropPress ? onClose : undefined}
          className="absolute inset-0 bg-black/40"
        />

        <View className={cn('w-full rounded-3xl bg-surface p-5', className)}>
          <Text className="text-lg font-bold text-text-primary">{title}</Text>

          {description ? (
            <Text className="mt-1.5 text-sm text-text-secondary">{description}</Text>
          ) : null}

          {children ? <View className="mt-4">{children}</View> : null}

          {footer ? <View className="mt-5">{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

interface AlertDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles confirm as destructive and disables backdrop dismissal. */
  destructive?: boolean;
  loading?: boolean;
}

/**
 * Confirmation dialog.
 *
 * A destructive variant deliberately can't be dismissed by tapping the scrim —
 * an accidental tap should never be ambiguous about whether the action ran.
 */
export function AlertDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
}: AlertDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      dismissOnBackdropPress={!destructive}
      footer={
        <View className="flex-row gap-3">
          <Button
            label={cancelLabel}
            variant="outline"
            onPress={onClose}
            disabled={loading}
            className="flex-1"
            fullWidth={false}
          />
          <Button
            label={confirmLabel}
            variant={destructive ? 'destructive' : 'primary'}
            onPress={onConfirm}
            loading={loading}
            className="flex-1"
            fullWidth={false}
          />
        </View>
      }
    />
  );
}
