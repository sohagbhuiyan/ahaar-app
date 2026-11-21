import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { toast } from 'sonner-native';

import GoogleIcon from '@/components/icons/GoogleIcon';
import { Button, Card, InlineError } from '@/components/ui';
import type { User } from '@/lib/api/types/auth';
import { googleSignInAvailable } from '@/lib/auth/google';
import { useLinkGoogle, useUnlinkGoogle } from '@/lib/query/hooks';
import { useAppLocale } from '@/lib/store/useLanguageStore';

/** The website's reset flow: the API emails a link to its reset-password page. */
const WEBSITE_URL = process.env.EXPO_PUBLIC_WEBSITE_URL ?? 'https://www.ahaar.store';

/**
 * Connected accounts: sign in with Google as well as (or instead of) a password.
 *
 * Disconnecting is disabled while the account has no password. The API refuses
 * it anyway, since the customer would have no way left to sign in.
 */
export function ConnectedAccountsCard({ user, className }: { user: User; className?: string }) {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const link = useLinkGoogle({
    onSuccess: () => toast.success(t('profile.connected.googleConnected')),
  });
  const unlink = useUnlinkGoogle({
    onSuccess: () => toast.success(t('profile.connected.googleDisconnected')),
  });

  const linked = user.google_linked;
  // A build that can't run Google Sign-In still shows an existing connection,
  // but can't offer to make a new one.
  if (!linked && !googleSignInAvailable) return null;

  const passwordless = !user.has_password;
  const error = link.error ?? unlink.error;

  return (
    <Card className={className}>
      <View className="p-5">
        <Text className="text-sm font-bold text-text-primary">
          {t('profile.connected.title')}
        </Text>
        <Text className="mt-1 text-xs text-text-muted">{t('profile.connected.description')}</Text>

        {error ? <InlineError error={error} className="mt-3" /> : null}

        {linked && passwordless ? (
          <Button
            label={t('profile.connected.setPassword')}
            size="sm"
            variant="outline"
            className="mt-4"
            accessibilityHint={t('profile.connected.setPasswordHint')}
            onPress={() =>
              void WebBrowser.openBrowserAsync(
                `${WEBSITE_URL}/${locale}/forgot-password?email=${encodeURIComponent(user.email)}`,
              )
            }
          />
        ) : null}

        <View className="mt-4 flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-muted">
            <GoogleIcon size={20} />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-text-primary">
              {t('profile.connected.google')}
            </Text>
            <Text className="text-xs text-text-muted">
              {linked
                ? passwordless
                  ? t('profile.connected.connectedNeedsPassword')
                  : t('profile.connected.connected')
                : t('profile.connected.notConnected')}
            </Text>
          </View>

          {linked ? (
            <Button
              label={t('profile.connected.disconnect')}
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
              label={t('profile.connected.connect')}
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
