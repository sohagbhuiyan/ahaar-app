import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import type { TFunction } from 'i18next';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { z } from 'zod';

import {
  AddressFormSheet,
  LocationPill,
  LocationSheet,
  OfflineBanner,
  ScreenHeader,
} from '@/components/shared';
import {
  AlertDialog,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  InlineError,
  Input,
  PasswordInput,
  Separator,
  Sheet,
  SkeletonText,
} from '@/components/ui';
import type { Address } from '@/lib/api/types/catalog';
import { isApiError } from '@/lib/api/types/common';
import {
  ALLERGENS,
  allergenLabelKey,
  DIETARY_TAGS,
  dietTagLabelKey,
  humanise,
} from '@/lib/constants/diet';
import { formatAddress } from '@/components/shared/AddressPicker';
import { ConnectedAccountsCard } from '@/components/shared/ConnectedAccountsCard';
import { LanguagePicker } from '@/components/shared/LanguagePicker';
import {
  useAddresses,
  useChangeLocation,
  useCurrentLocation,
  useDeleteAccount,
  useDeleteAddress,
  useDeliverySlots,
  useIsSignedIn,
  useLogout,
  useProfile,
  useUpdateDietaryPreferences,
  useUpdateProfile,
} from '@/lib/query/hooks';
import { locationPickerHref } from '@/lib/location/picker';
import { slotWindow } from '@/lib/slots';
import { useAuthPromptStore } from '@/lib/store';
import { cn } from '@/lib/utils';

/**
 * Mirrors `UpdateProfileRequest`. Every field there is `sometimes`, so this
 * only sends what actually changed — see `changedOnly` below.
 *
 * `users.locale` (the language for emails and notifications) is not on this
 * form: `LanguagePicker` keeps it in sync with the app's display language.
 */
function makeSchema(t: TFunction) {
  return z.object({
    name: z
      .string()
      .min(2, t('common.validation.minLength', { min: 2 }))
      .max(120, t('common.validation.maxLength', { max: 120 })),
    email: z
      .string()
      .min(1, t('common.validation.required'))
      .email(t('common.validation.email'))
      .max(190, t('common.validation.maxLength', { max: 190 })),
    phone: z
      .string()
      .max(32, t('common.validation.maxLength', { max: 32 }))
      .optional()
      .or(z.literal('')),
  });
}

type FormValues = z.infer<ReturnType<typeof makeSchema>>;

/**
 * What a Google-only customer types to confirm deletion. A fixed Latin word in
 * every language: it is compared client-side and must be typeable on any
 * keyboard layout the customer has.
 */
const DELETE_WORD = 'DELETE';

/** Phone numbers and emails read left to right inside Arabic text. */
const ltr = (value: string) => `⁦${value}⁩`;

/**
 * Account screen.
 *
 * Everything on it is backed by a real endpoint rather than a placeholder:
 *   PATCH /me                       → name, email, phone, locale, default slot
 *   PATCH /me/dietary-preferences   → tags and allergens to avoid
 *   GET/POST/PATCH/DELETE /addresses, POST /addresses/{id}/set-default
 *
 * The two profile endpoints are deliberately separate mutations rather than one
 * "save" button: dietary preferences also invalidate the swap cache (they
 * filter swap options server-side), and bundling them would either over-
 * invalidate or silently skip that.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const signedIn = useIsSignedIn();
  const promptLogin = useAuthPromptStore((s) => s.prompt);
  const { t } = useTranslation();
  // Rebuilt per language so validation messages follow a language switch.
  const schema = useMemo(() => makeSchema(t), [t]);

  const { data: user, isLoading, isError, error, refetch } = useProfile();
  const { data: addresses } = useAddresses();
  const { data: slots } = useDeliverySlots();

  const updateProfile = useUpdateProfile();
  const updateDietary = useUpdateDietaryPreferences();
  // The default address is the delivery location shown on Home, so switching
  // it here goes through the same path as the Home location sheet.
  const { selectAddress, pendingAddressId } = useChangeLocation();
  const deleteAddress = useDeleteAddress();

  const logout = useLogout({ onSuccess: () => router.replace('/(tabs)') });
  const deleteAccount = useDeleteAccount({
    onSuccess: () => {
      setDeleteSheetOpen(false);
      toast.success(t('profile.toast.accountDeleted'));
      router.replace('/(tabs)');
    },
  });

  const [addressForm, setAddressForm] = useState<{ open: boolean; address?: Address }>({
    open: false,
  });
  const [pendingDelete, setPendingDelete] = useState<Address | null>(null);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const location = useCurrentLocation();

  const { control, handleSubmit, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', phone: '' },
  });

  // Seed the form once the server's copy arrives. `reset` rather than
  // `defaultValues` so a background refetch can't clobber in-progress edits.
  useEffect(() => {
    if (!user) return;
    reset({
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
    });
  }, [user, reset]);

  const onSubmit = (values: FormValues) => {
    if (updateProfile.isPending || !user) return;

    /**
     * Only the changed fields. Every rule in `UpdateProfileRequest` is
     * `sometimes`, and `email`/`phone` carry a `unique` check that ignores the
     * current user — resending an unchanged email is harmless but resending an
     * unchanged *phone* would needlessly clear `phone_verified_at`, since the
     * controller wipes verification whenever `phone` is present and different.
     */
    const payload: Record<string, string | null> = {};
    if (values.name !== user.name) payload.name = values.name;
    if (values.email !== user.email) payload.email = values.email;
    if ((values.phone || null) !== user.phone) payload.phone = values.phone || null;

    if (Object.keys(payload).length === 0) {
      toast(t('profile.toast.nothingToSave'));
      return;
    }

    updateProfile.mutate(payload, {
      onSuccess: () => toast.success(t('profile.toast.profileUpdated')),
      onError: (e) =>
        toast.error(isApiError(e) ? e.message : t('profile.toast.profileSaveFailed')),
    });
  };

  const toggleTag = (tag: string) => {
    if (!user) return;
    const current = user.dietary_preferences?.tags ?? [];
    const next = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];

    updateDietary.mutate(
      { tags: next, avoid_allergens: user.dietary_preferences?.avoid_allergens ?? [] },
      {
        onError: (e) =>
          toast.error(isApiError(e) ? e.message : t('profile.toast.preferenceSaveFailed')),
      },
    );
  };

  const toggleAllergen = (allergen: string) => {
    if (!user) return;
    const current = user.dietary_preferences?.avoid_allergens ?? [];
    const next = current.includes(allergen)
      ? current.filter((a) => a !== allergen)
      : [...current, allergen];

    updateDietary.mutate(
      { tags: user.dietary_preferences?.tags ?? [], avoid_allergens: next },
      {
        onError: (e) =>
          toast.error(isApiError(e) ? e.message : t('profile.toast.preferenceSaveFailed')),
      },
    );
  };

  const setDefaultSlot = (slotId: number) => {
    updateProfile.mutate(
      { default_slot_id: slotId },
      {
        onSuccess: () => toast.success(t('profile.toast.mealTimeSaved')),
        onError: (e) =>
          toast.error(isApiError(e) ? e.message : t('profile.toast.saveFailed')),
      },
    );
  };

  if (!signedIn) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title={t('profile.title')} />
        <View className="flex-1 justify-center p-5">
          <EmptyState
            title={t('profile.signedOut.title')}
            description={t('profile.signedOut.description')}
            actionLabel={t('common.actions.signIn')}
            onAction={() => promptLogin(t('profile.signedOut.reason'))}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title={t('profile.title')} />
        <View className="gap-4 p-5">
          <SkeletonText lines={6} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title={t('profile.title')} />
        <ErrorState error={error} onRetry={refetch} className="flex-1 justify-center" />
      </SafeAreaView>
    );
  }

  const tags = user?.dietary_preferences?.tags ?? [];
  const avoided = user?.dietary_preferences?.avoid_allergens ?? [];

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title={t('profile.title')} />
      <OfflineBanner />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Identity */}
          <View className="mb-6 items-center">
            <Avatar name={user?.name} size="lg" />
            <Text className="mt-3 text-lg font-bold text-text-primary">
              {user?.name}
            </Text>
            <Text className="text-sm text-text-secondary">{user?.email ? ltr(user.email) : ''}</Text>

            <View className="mt-2 flex-row gap-2">
              {user?.email_verified === false ? (
                <Badge label={t('profile.badges.emailNotVerified')} variant="warning" />
              ) : null}
              {user?.phone && user.phone_verified === false ? (
                <Badge label={t('profile.badges.phoneNotVerified')} variant="warning" />
              ) : null}
              {user?.status && user.status !== 'active' ? (
                <Badge
                  label={t(`common.status.${user.status}`, { defaultValue: humanise(user.status) })}
                  variant="danger"
                />
              ) : null}
            </View>
          </View>

          {/* Shortcuts */}
          <View className="mb-6 gap-2">
            <LinkRow
              label={t('profile.links.orders')}
              hint={t('profile.links.ordersHint')}
              onPress={() => router.push('/orders')}
            />
            <LinkRow
              label={t('profile.links.subscriptions')}
              hint={t('profile.links.subscriptionsHint')}
              onPress={() => router.push('/subscriptions')}
            />
            <LinkRow
              label={t('profile.links.payments')}
              hint={t('profile.links.paymentsHint')}
              onPress={() => router.push('/payments')}
            />
          </View>

          {updateProfile.isError ? (
            <InlineError error={updateProfile.error} className="mb-4" />
          ) : null}

          {/* Details */}
          <Card>
            <View className="gap-4 p-5">
              <Text className="text-sm font-bold text-text-primary">
                {t('profile.yourDetails')}
              </Text>

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
                  />
                )}
              />

              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value }, fieldState }) => (
                  <Input
                    label={t('profile.email')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={fieldState.error?.message}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                  />
                )}
              />

              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, onBlur, value }, fieldState }) => (
                  <Input
                    label={t('profile.phone')}
                    hint={t('profile.phoneHint')}
                    value={value ?? ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={fieldState.error?.message}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                  />
                )}
              />

              <Button
                label={t('profile.saveChanges')}
                loading={updateProfile.isPending}
                disabled={!formState.isDirty}
                onPress={handleSubmit(onSubmit)}
              />
            </View>
          </Card>

          {/* Language — display language; emails and notifications follow it. */}
          <Card className="mt-4">
            <View className="gap-2 p-5">
              <Text className="text-sm font-bold text-text-primary">
                {t('profile.appLanguage')}
              </Text>
              <Text className="text-xs text-text-muted">{t('profile.appLanguageHint')}</Text>
              <LanguagePicker className="mt-1" />
            </View>
          </Card>

          {/* Dietary preferences */}
          <Card className="mt-4">
            <View className="p-5">
              <Text className="text-sm font-bold text-text-primary">
                {t('profile.dietaryPreferences')}
              </Text>
              <Text className="mt-1 text-xs text-text-muted">{t('profile.dietaryHint')}</Text>

              {updateDietary.isError ? (
                <InlineError error={updateDietary.error} className="mt-3" />
              ) : null}

              <Text className="mt-4 text-xs font-bold uppercase text-text-muted">
                {t('profile.iPrefer')}
              </Text>
              <View className="mt-2 flex-row flex-wrap gap-2">
                {DIETARY_TAGS.map((tag) => (
                  <Chip
                    key={tag}
                    label={t(dietTagLabelKey(tag), { defaultValue: humanise(tag) })}
                    active={tags.includes(tag)}
                    disabled={updateDietary.isPending}
                    onPress={() => toggleTag(tag)}
                  />
                ))}
              </View>

              <Separator className="my-4" />

              <Text className="text-xs font-bold uppercase text-text-muted">
                {t('profile.iAvoid')}
              </Text>
              <View className="mt-2 flex-row flex-wrap gap-2">
                {ALLERGENS.map((allergen) => (
                  <Chip
                    key={allergen}
                    label={t(allergenLabelKey(allergen), { defaultValue: humanise(allergen) })}
                    active={avoided.includes(allergen)}
                    disabled={updateDietary.isPending}
                    tone="warning"
                    onPress={() => toggleAllergen(allergen)}
                  />
                ))}
              </View>
            </View>
          </Card>

          {/* Default meal time */}
          {slots && slots.length > 0 ? (
            <Card className="mt-4">
              <View className="p-5">
                <Text className="text-sm font-bold text-text-primary">
                  {t('profile.preferredMealTime')}
                </Text>
                <Text className="mt-1 text-xs text-text-muted">
                  {t('profile.preferredMealHint')}
                </Text>

                <View className="mt-3 flex-row flex-wrap gap-2">
                  {slots.map((slot) => (
                    <Chip
                      key={slot.id}
                      label={`${slot.name} · ${slotWindow(slot)}`}
                      active={user?.default_slot_id === slot.id}
                      disabled={updateProfile.isPending}
                      onPress={() => setDefaultSlot(slot.id)}
                    />
                  ))}
                </View>
              </View>
            </Card>
          ) : null}

          {/* Delivery location — the same pill and sheet as Home, so GPS,
              saved addresses and typing one in all work from here too. */}
          <Card className="mt-4">
            <View className="p-5">
              <Text className="text-sm font-bold text-text-primary">
                {t('profile.deliveryLocation')}
              </Text>
              <Text className="mt-1 text-xs text-text-muted">
                {t('profile.deliveryLocationHint')}
              </Text>
              <LocationPill
                location={location}
                onPress={() => setLocationSheetOpen(true)}
                className="mt-3"
              />
            </View>
          </Card>

          {/* Addresses */}
          <Card className="mt-4">
            <View className="p-5">
              <View className="flex-row items-center justify-between gap-3">
                <Text className="text-sm font-bold text-text-primary">
                  {t('profile.addresses.title')}
                </Text>
                {/* A new address starts on the map, so it always has an exact pin. */}
                <Button
                  label={t('profile.addresses.add')}
                  size="sm"
                  variant="secondary"
                  fullWidth={false}
                  onPress={() => router.push(locationPickerHref({ mode: 'add' }))}
                />
              </View>

              {!addresses || addresses.length === 0 ? (
                <Text className="mt-3 text-sm text-text-secondary">
                  {t('profile.addresses.empty')}
                </Text>
              ) : (
                <View className="mt-3">
                  {addresses.map((address, index) => (
                    <View key={address.id}>
                      {index > 0 ? <Separator className="my-3" /> : null}

                      <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-1">
                          <Text className="text-sm font-semibold text-text-primary">
                            {address.label ?? address.line1}
                          </Text>
                          <Text className="mt-0.5 text-xs text-text-muted">
                            {formatAddress(address)}
                          </Text>
                          {address.short_address ? (
                            <Text className="mt-1 text-xs text-text-secondary">
                              {t('profile.addresses.shortAddress', {
                                code: ltr(address.short_address),
                              })}
                            </Text>
                          ) : null}
                          {address.instructions ? (
                            <Text className="mt-1 text-xs italic text-text-muted">
                              {address.instructions}
                            </Text>
                          ) : null}
                        </View>

                        {address.is_default ? (
                          <Badge label={t('profile.deliveryLocation')} variant="brand" />
                        ) : null}
                      </View>

                      <View className="mt-2 flex-row gap-2">
                        <Button
                          label={t('common.actions.edit')}
                          size="sm"
                          variant="ghost"
                          fullWidth={false}
                          onPress={() => setAddressForm({ open: true, address })}
                        />
                        {!address.is_default ? (
                          <Button
                            label={t('profile.addresses.deliverHere')}
                            size="sm"
                            variant="ghost"
                            fullWidth={false}
                            loading={pendingAddressId === address.id}
                            onPress={() =>
                              selectAddress(address.id)
                                .then(() => toast.success(t('profile.toast.locationUpdated')))
                                .catch((e: unknown) =>
                                  toast.error(
                                    isApiError(e) ? e.message : t('profile.toast.locationFailed'),
                                  ),
                                )
                            }
                          />
                        ) : null}
                        <Button
                          label={t('common.actions.delete')}
                          size="sm"
                          variant="ghost"
                          fullWidth={false}
                          textClassName="text-danger"
                          onPress={() => setPendingDelete(address)}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </Card>

          {user ? <ConnectedAccountsCard user={user} className="mt-4" /> : null}

          {user ? (
            <Card className="mt-6 border-danger/30 bg-surface p-4">
              <Text className="text-base font-bold text-danger">
                {t('profile.deleteAccount.title')}
              </Text>
              <Text className="mt-1.5 text-xs text-text-secondary leading-relaxed">
                {t('profile.deleteAccount.description')}
              </Text>
              <Button
                label={t('profile.deleteAccount.button')}
                variant="destructive"
                size="sm"
                className="mt-4 self-start"
                fullWidth={false}
                onPress={() => {
                  setDeletePassword('');
                  setDeleteConfirmText('');
                  setDeleteReason('');
                  setDeleteSheetOpen(true);
                }}
              />
            </Card>
          ) : null}

          <Button
            label={t('profile.logout')}
            variant="outline"
            className="mt-6"
            loading={logout.isPending}
            onPress={() => logout.mutate()}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <LocationSheet
        open={locationSheetOpen}
        onClose={() => setLocationSheetOpen(false)}
      />

      <AddressFormSheet
        open={addressForm.open}
        address={addressForm.address}
        onClose={() => setAddressForm({ open: false })}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteAddress.mutate(pendingDelete.id, {
            onSuccess: () => {
              setPendingDelete(null);
              toast.success(t('profile.toast.addressDeleted'));
            },
            onError: (e) => {
              setPendingDelete(null);
              toast.error(
                isApiError(e) ? e.message : t('profile.toast.addressDeleteFailed'),
              );
            },
          });
        }}
        title={t('profile.addresses.deleteTitle')}
        description={pendingDelete ? formatAddress(pendingDelete) : undefined}
        confirmLabel={t('common.actions.delete')}
        destructive
        loading={deleteAddress.isPending}
      />

      <Sheet
        open={deleteSheetOpen}
        onClose={() => {
          if (deleteAccount.isPending) return;
          setDeleteSheetOpen(false);
          setDeletePassword('');
          setDeleteConfirmText('');
          setDeleteReason('');
          deleteAccount.reset();
        }}
        title={t('profile.deleteAccount.sheetTitle')}
        description={t('profile.deleteAccount.sheetDescription')}
        footer={
          <View className="gap-3">
            <Button
              label={t('profile.deleteAccount.confirmButton')}
              variant="destructive"
              size="lg"
              loading={deleteAccount.isPending}
              disabled={
                deleteAccount.isPending ||
                (user?.has_password !== false
                  ? !deletePassword.trim()
                  : deleteConfirmText.trim().toUpperCase() !== DELETE_WORD)
              }
              onPress={() => {
                deleteAccount.mutate(
                  {
                    password: user?.has_password !== false ? deletePassword : undefined,
                    confirm: user?.has_password === false ? true : undefined,
                    reason: deleteReason.trim() || undefined,
                  },
                  {
                    onError: (e) => {
                      toast.error(
                        isApiError(e)
                          ? e.message
                          : t('profile.toast.accountDeleteFailed'),
                      );
                    },
                  },
                );
              }}
            />
            <Button
              label={t('common.actions.cancel')}
              variant="outline"
              size="md"
              disabled={deleteAccount.isPending}
              onPress={() => {
                setDeleteSheetOpen(false);
                setDeletePassword('');
                setDeleteConfirmText('');
                setDeleteReason('');
                deleteAccount.reset();
              }}
            />
          </View>
        }
      >
        {deleteAccount.isError ? (
          <InlineError error={deleteAccount.error} className="mb-4" />
        ) : null}

        <View className="gap-4 pb-2">
          {user?.has_password !== false ? (
            <PasswordInput
              label={t('profile.deleteAccount.passwordLabel')}
              placeholder={t('profile.deleteAccount.passwordPlaceholder')}
              value={deletePassword}
              onChangeText={setDeletePassword}
              editable={!deleteAccount.isPending}
              returnKeyType="next"
              autoFocus
            />
          ) : (
            <View className="gap-1.5">
              <Text className="text-xs text-text-secondary">
                <Trans
                  i18nKey="profile.deleteAccount.googleIntro"
                  values={{ word: DELETE_WORD }}
                  components={[<Text key="word" className="font-bold text-danger" />]}
                />
              </Text>
              <Input
                label={t('profile.deleteAccount.typeToConfirm', { word: DELETE_WORD })}
                placeholder={DELETE_WORD}
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                autoCapitalize="characters"
                editable={!deleteAccount.isPending}
                returnKeyType="next"
                autoFocus
              />
            </View>
          )}

          <Input
            label={t('profile.deleteAccount.reasonLabel')}
            placeholder={t('profile.deleteAccount.reasonPlaceholder')}
            value={deleteReason}
            onChangeText={setDeleteReason}
            editable={!deleteAccount.isPending}
            returnKeyType="done"
          />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

function LinkRow({
  label,
  hint,
  onPress,
}: {
  label: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3.5 active:opacity-80"
    >
      <View className="flex-1">
        <Text className="text-sm font-semibold text-text-primary">{label}</Text>
        <Text className="mt-0.5 text-xs text-text-muted">{hint}</Text>
      </View>
      <Text className="text-lg text-text-muted">›</Text>
    </Pressable>
  );
}

function Chip({
  label,
  active,
  disabled = false,
  tone = 'brand',
  onPress,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  tone?: 'brand' | 'warning';
  onPress: () => void;
}) {
  const activeClass =
    tone === 'warning' ? 'bg-warning-soft border-warning' : 'bg-brand-50 border-brand-500';
  const activeText = tone === 'warning' ? 'text-warning' : 'text-brand-700';

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'rounded-xl border px-3 py-1.5',
        active ? activeClass : 'border-border bg-surface',
        disabled && 'opacity-50',
      )}
    >
      <Text
        className={cn(
          'text-xs font-bold',
          active ? activeText : 'text-text-secondary',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}
