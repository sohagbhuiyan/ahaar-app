import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter, useSegments, type Href } from 'expo-router';
import { View } from 'react-native';

import { Button, Dialog } from '@/components/ui';
import { useProfile } from '@/lib/query/hooks/useProfile';
import { useAuthHydrated, useIsAuthenticated } from '@/lib/store';

/**
 * Routes the suggestion never covers: the auth flow, the welcome tour, and
 * the profile setup itself (the form and the map it opens).
 */
const QUIET_ROUTES = ['(auth)', 'onboarding', 'complete-profile', 'location-picker'];

/** Let a navigation (e.g. off verify-email onto Home) settle before asking. */
const SHOW_DELAY_MS = 700;

/**
 * Once per app launch — module state, never persisted — so "Later" holds
 * until the app is next started.
 */
let shownThisLaunch = false;

/** Test hook: forget that the prompt was shown in this process. */
export function resetProfileCompletionPrompt() {
  shownThisLaunch = false;
}

/**
 * "Complete your profile" — a dismissible suggestion, mounted by `AuthGate`.
 *
 * Shown once per launch to a signed-in customer whose `/me` says
 * `profile_complete === false`, while they are on the main app. Ordering is
 * still blocked by the API until name, phone and a delivery address exist
 * (403 `profile_incomplete`, which `AuthGate` turns into a visit to the
 * complete-profile screen) — this only offers the shortcut up front.
 */
export function ProfileCompletionPrompt() {
  const { t } = useTranslation();
  const router = useRouter();
  const segments = useSegments();

  const hydrated = useAuthHydrated();
  const isAuthenticated = useIsAuthenticated();
  const { data: profile } = useProfile();

  const [open, setOpen] = useState(false);

  const route = segments[0] as string | undefined;
  const eligible =
    hydrated &&
    isAuthenticated &&
    profile?.profile_complete === false &&
    !QUIET_ROUTES.includes(route ?? '');

  useEffect(() => {
    if (!eligible || shownThisLaunch) return;
    const id = setTimeout(() => {
      shownThisLaunch = true;
      setOpen(true);
    }, SHOW_DELAY_MS);
    return () => clearTimeout(id);
  }, [eligible]);

  // Signed out (or completed elsewhere) while it was up: nothing to suggest.
  const visible = open && isAuthenticated && profile?.profile_complete === false;

  const later = () => setOpen(false);
  const completeNow = () => {
    setOpen(false);
    router.push('/complete-profile' as Href);
  };

  return (
    <Dialog
      open={visible}
      onClose={later}
      title={t('profile.completePrompt.title')}
      description={t('profile.completePrompt.body')}
      footer={
        <View className="gap-2">
          <Button
            label={t('profile.completePrompt.completeNow')}
            onPress={completeNow}
            testID="profile-prompt-complete"
          />
          <Button
            label={t('profile.completePrompt.later')}
            variant="ghost"
            onPress={later}
            testID="profile-prompt-later"
          />
        </View>
      }
    />
  );
}
