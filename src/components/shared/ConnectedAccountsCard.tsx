import * as WebBrowser from 'expo-web-browser';
import { Text, View } from 'react-native';
import { toast } from 'sonner-native';

import GoogleIcon from '@/components/icons/GoogleIcon';
import { Button, Card, InlineError } from '@/components/ui';
import type { User } from '@/lib/api/types/auth';
import { googleSignInAvailable } from '@/lib/auth/google';
import { useLinkGoogle, useUnlinkGoogle } from '@/lib/query/hooks';

/** The website's reset flow: the API emails a link to its reset-password page. */
const WEBSITE_URL = process.env.EXPO_PUBLIC_WEBSITE_URL ?? 'https://www.ahaar.store';

/**
 * Connected accounts: sign in with Google as well as (or instead of) a password.
 *
 * Disconnecting is disabled while the account has no password. The API refuses
 * it anyway, since the customer would have no way left to sign in.
 */
export function ConnectedAccountsCard({ user, className }: { user: User; className?: string }) {
  const link = useLinkGoogle({ onSuccess: () => toast.success('Google connected') });
  const unlink = useUnlinkGoogle({ onSuccess: () => toast.success('Google disconnected') });

  const linked = user.google_linked;
  // A build that can't run Google Sign-In still shows an existing connection,
  // but can't offer to make a new one.
  if (!linked && !googleSignInAvailable) return null;

  const passwordless = !user.has_password;
  const error = link.error ?? unlink.error;

  return (
    <Card className={className}>
      <View className="p-5">
        <Text className="text-sm font-bold text-text-primary">Connected accounts</Text>
        <Text className="mt-1 text-xs text-text-muted">
          Sign in with Google instead of typing a password. Your plan and orders stay on
          this account either way.
        </Text>

        {error ? <InlineError error={error} className="mt-3" /> : null}

        {linked && passwordless ? (
          <Button
            label="Set a password"
            size="sm"
            variant="outline"
            className="mt-4"
            accessibilityHint="Opens the Ahaar website to email you a link for choosing a password"
            onPress={() =>
              void WebBrowser.openBrowserAsync(
                `${WEBSITE_URL}/en/forgot-password?email=${encodeURIComponent(user.email)}`,
              )
            }
          />
        ) : null}

        <View className="mt-4 flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-muted">
            <GoogleIcon size={20} />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-text-primary">Google</Text>
            <Text className="text-xs text-text-muted">
              {linked
                ? passwordless
                  ? 'Connected. Set a password before you can disconnect.'
                  : 'Connected'
                : 'Not connected'}
            </Text>
          </View>

          {linked ? (
            <Button
              label="Disconnect"
              size="sm"
              variant="ghost"
              fullWidth={false}
              textClassName="text-danger"
              disabled={passwordless}
              loading={unlink.isPending}
              onPress={() => {
                link.reset();
                unlink.mutate();
              }}
            />
          ) : (
            <Button
              label="Connect"
              size="sm"
              variant="secondary"
              fullWidth={false}
              loading={link.isPending}
              onPress={() => {
                unlink.reset();
                link.mutate();
              }}
            />
          )}
        </View>
      </View>
    </Card>
  );
}
