import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import type { TFunction } from 'i18next';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { LocationPill, LocationSheet, ScreenHeader } from '@/components/shared';
import { Button, Card, InlineError, Input, SkeletonText } from '@/components/ui';
import * as profileApi from '@/lib/api/endpoints/profile';
import type { UpdateProfilePayload } from '@/lib/api/types/auth';
import { isApiError } from '@/lib/api/types/common';
import { useCurrentLocation, useLogout, useProfile, useUpdateProfile } from '@/lib/query/hooks';
import { queryKeys } from '@/lib/query/keys';
import { useAuthStore } from '@/lib/store';

/** Same rules as the API's `UpdateProfileRequest`, with both fields required. */
function makeSchema(t: TFunction) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(2, t('common.validation.minLength', { min: 2 }))
      .max(120, t('common.validation.maxLength', { max: 120 })),
    phone: z
      .string()
      .trim()
      .min(1, t('profile.complete.errors.phoneRequired'))
      .regex(/^\+?[0-9][0-9\s-]{6,18}[0-9]$/, t('profile.complete.errors.phone')),
  });
}

type FormValues = z.infer<ReturnType<typeof makeSchema>>;

/**
 * Finishing registration: full name, phone and a delivery location.
 *
 * Every new account starts incomplete — email accounts (the phone is optional
 * at sign-up, the address is never asked) and Google accounts (Google gives a
 * name and email only). Customers arrive from the once-per-launch suggestion
 * (`ProfileCompletionPrompt`) or because the API refused a purchase with 403
 * `profile_incomplete` (`AuthGate`). Either way this is not a trap: the back
 * control, swipe-back and the Android back button all leave, and a refused
 * purchase simply stays refused until the profile is complete.
 */
export default function CompleteProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const schema = useMemo(() => makeSchema(t), [t]);
  const queryClient = useQueryClient();
  const syncUser = useAuthStore((s) => s.syncUser);

  const { data: user, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const logout = useLogout({ onSuccess: () => router.dismissTo('/(tabs)') });
  const location = useCurrentLocation();

  const [locationOpen, setLocationOpen] = useState(false);
  const [addressTried, setAddressTried] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const hasAddress = location.source === 'address' && !!location.address;
  const addressMissing = addressTried && !hasAddress;

  const { control, handleSubmit, reset, setError } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', phone: '' },
  });

  useEffect(() => {
    if (user) reset({ name: user.name ?? '', phone: user.phone ?? '' }, { keepDirtyValues: true });
  }, [user, reset]);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  // Opened while already complete (a stale cache): nothing to do here.
  useEffect(() => {
    if (user?.profile_complete && !finishing) leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.profile_complete]);

  const onSubmit = async (values: FormValues) => {
    if (!user || finishing) return;
    if (!hasAddress) {
      setAddressTried(true);
      return;
    }

    // Only what changed: resending an unchanged phone clears its verification.
    const payload: UpdateProfilePayload = {};
    const phone = values.phone.replace(/[\s-]/g, '');
    if (values.name.trim() !== user.name) payload.name = values.name.trim();
    if (phone !== (user.phone ?? '')) payload.phone = phone;

    setFinishing(true);
    try {
      if (Object.keys(payload).length > 0) {
        await updateProfile.mutateAsync(payload);
      }

      // The address was saved by the location sheet; read the verdict back.
      const fresh = await profileApi.getProfile();
      queryClient.setQueryData(queryKeys.profile.me(), fresh);
      syncUser(fresh);

      if (fresh.profile_complete === false) {
        setFinishing(false);
        if (fresh.profile_missing?.includes('address')) setAddressTried(true);
        toast.error(t('profile.complete.stillMissing'));
        return;
      }

      toast.success(t('profile.complete.done'));
      leave();
    } catch (e) {
      setFinishing(false);
      if (isApiError(e) && e.errors) {
        for (const [field, messages] of Object.entries(e.errors)) {
          if (field === 'name' || field === 'phone') setError(field, { message: messages[0] });
        }
      }
      toast.error(isApiError(e) ? e.message : t('profile.complete.saveError'));
    }
  };

  if (isLoading || !user) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title={t('profile.complete.title')} onBack={leave} />
        <View className="gap-4 p-5">
          <SkeletonText lines={5} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title={t('profile.complete.title')} onBack={leave} />

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text className="mb-5 text-sm text-text-secondary">{t('profile.complete.subtitle')}</Text>

          {updateProfile.isError ? <InlineError error={updateProfile.error} className="mb-4" /> : null}

          <Card>
            <View className="gap-4 p-5">
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value }, fieldState }) => (
                  <Input
                    label={t('profile.fullName')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={fieldState.error?.message}
                    autoComplete="name"
                    testID="complete-profile-name"
                  />
                )}
              />

              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, onBlur, value }, fieldState }) => (
                  <Input
                    label={t('profile.complete.phone')}
                    hint={t('profile.complete.phoneHint')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={fieldState.error?.message}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    placeholder="+966 5X XXX XXXX"
                    testID="complete-profile-phone"
                  />
                )}
              />

              <View className="gap-2">
                <Text className="text-sm font-medium text-text-primary">{t('profile.complete.address')}</Text>
                <LocationPill
                  location={hasAddress ? location : { ...location, source: null, title: '' }}
                  onPress={() => setLocationOpen(true)}
                />
                <Text className="text-xs text-text-muted">{t('profile.complete.addressHint')}</Text>
                {addressMissing ? (
                  <Text className="text-xs text-danger">{t('profile.complete.errors.address')}</Text>
                ) : null}
              </View>

              <Button
                label={t('profile.complete.submit')}
                loading={finishing || updateProfile.isPending}
                onPress={handleSubmit(onSubmit)}
                testID="complete-profile-submit"
              />
            </View>
          </Card>

          <Button
            label={t('profile.complete.signOut')}
            variant="ghost"
            className="mt-4"
            loading={logout.isPending}
            onPress={() => logout.mutate()}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <LocationSheet open={locationOpen} onClose={() => setLocationOpen(false)} />
    </SafeAreaView>
  );
}
