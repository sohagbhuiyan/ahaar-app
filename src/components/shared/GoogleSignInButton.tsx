import { Text, View } from 'react-native';
import { toast } from 'sonner-native';

import GoogleIcon from '@/components/icons/GoogleIcon';
import { Button, InlineError, type ButtonSize } from '@/components/ui';
import type { User } from '@/lib/api/types/auth';
import { googleSignInAvailable } from '@/lib/auth/google';
import { useGoogleLogin } from '@/lib/query/hooks';

interface Props {
  /** After a real sign-in. Backing out of Google's picker calls nothing. */
  onSuccess?: (user: User, isNewUser: boolean) => void;
  label?: string;
  size?: ButtonSize;
  /** Draw the "or" rule under the button, above an email form. */
  divider?: boolean;
  className?: string;
}

/**
 * "Continue with Google", for sign-in and sign-up alike.
 *
 * Renders nothing where native Google Sign-In can't run (Expo Go, the web
 * build, a build without client ids), so the email form never sits under a
 * button that can only fail.
 */
export function GoogleSignInButton({
  onSuccess,
  label = 'Continue with Google',
  size = 'lg',
  divider = false,
  className,
}: Props) {
  const google = useGoogleLogin({
    onSuccess: (user, isNewUser) => {
      const first = user.name.split(' ')[0];
      toast.success(isNewUser ? `Welcome to Ahaar, ${first}` : `Welcome back, ${first}`);
      onSuccess?.(user, isNewUser);
    },
  });

  if (!googleSignInAvailable) return null;

  return (
    <View className={className}>
      {google.isError ? <InlineError error={google.error} className="mb-3" /> : null}

      <Button
        label={label}
        variant="outline"
        size={size}
        loading={google.isPending}
        left={<GoogleIcon size={20} />}
        accessibilityHint="Opens Google to choose an account"
        onPress={() => {
          if (!google.isPending) google.mutate();
        }}
      />

      {divider ? <OrDivider /> : null}
    </View>
  );
}

export function OrDivider() {
  return (
    <View className="my-5 flex-row items-center gap-3">
      <View className="h-px flex-1 bg-border" />
      <Text className="text-xs font-semibold uppercase tracking-wider text-text-muted">or</Text>
      <View className="h-px flex-1 bg-border" />
    </View>
  );
}
