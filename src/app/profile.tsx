import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { AddressFormSheet, OfflineBanner, ScreenHeader } from '@/components/shared';
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
  Separator,
  SkeletonText,
} from '@/components/ui';
import type { Address } from '@/lib/api/types/catalog';
import { isApiError } from '@/lib/api/types/common';
import { ALLERGENS, DIETARY_TAGS, humanise, LOCALES } from '@/lib/constants/diet';
import { formatAddress } from '@/components/shared/AddressPicker';
import {
  useAddresses,
  useDeleteAddress,
  useDeliverySlots,
  useIsSignedIn,
  useLogout,
  useProfile,
  useSetDefaultAddress,
  useUpdateDietaryPreferences,
  useUpdateProfile,
} from '@/lib/query/hooks';
import { slotWindow } from '@/lib/slots';
import { useAuthPromptStore } from '@/lib/store';
import { cn } from '@/lib/utils';

/**
 * Mirrors `UpdateProfileRequest`. Every field there is `sometimes`, so this
 * only sends what actually changed — see `changedOnly` below.
 */
const schema = z.object({
  name: z.string().min(2, 'Enter your name').max(120),
  email: z.string().min(1, 'Email is required').email('Enter a valid email').max(190),
  phone: z.string().max(32).optional().or(z.literal('')),
  locale: z.string().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

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

  const { data: user, isLoading, isError, error, refetch } = useProfile();
  const { data: addresses } = useAddresses();
  const { data: slots } = useDeliverySlots();

  const updateProfile = useUpdateProfile();
  const updateDietary = useUpdateDietaryPreferences();
  const setDefaultAddress = useSetDefaultAddress();
  const deleteAddress = useDeleteAddress();

  const logout = useLogout({ onSuccess: () => router.replace('/(tabs)') });

  const [addressForm, setAddressForm] = useState<{ open: boolean; address?: Address }>({
    open: false,
  });
  const [pendingDelete, setPendingDelete] = useState<Address | null>(null);

  const { control, handleSubmit, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', phone: '', locale: '' },
  });

  // Seed the form once the server's copy arrives. `reset` rather than
  // `defaultValues` so a background refetch can't clobber in-progress edits.
  useEffect(() => {
    if (!user) return;
    reset({
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
      locale: user.locale ?? '',
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
    if ((values.locale || null) !== user.locale && values.locale) {
      payload.locale = values.locale;
    }

    if (Object.keys(payload).length === 0) {
      toast('Nothing to save');
      return;
    }

    updateProfile.mutate(payload, {
      onSuccess: () => toast.success('Profile updated'),
      onError: (e) =>
        toast.error(isApiError(e) ? e.message : 'Could not save your profile'),
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
          toast.error(isApiError(e) ? e.message : 'Could not save that preference'),
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
          toast.error(isApiError(e) ? e.message : 'Could not save that preference'),
      },
    );
  };

  const setDefaultSlot = (slotId: number) => {
    updateProfile.mutate(
      { default_slot_id: slotId },
      {
        onSuccess: () => toast.success('Default meal time saved'),
        onError: (e) =>
          toast.error(isApiError(e) ? e.message : 'Could not save that'),
      },
    );
  };

  if (!signedIn) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="Account" />
        <EmptyState
          title="Sign in to your account"
          description="Manage your details, addresses and dietary preferences."
          actionLabel="Sign in"
          onAction={() => promptLogin('to manage your account')}
          className="flex-1 justify-center"
        />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="Account" />
        <View className="gap-4 p-5">
          <SkeletonText lines={6} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="Account" />
        <ErrorState error={error} onRetry={refetch} className="flex-1 justify-center" />
      </SafeAreaView>
    );
  }

  const tags = user?.dietary_preferences?.tags ?? [];
  const avoided = user?.dietary_preferences?.avoid_allergens ?? [];

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title="Account" />
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
            <Text className="text-sm text-text-secondary">{user?.email}</Text>

            <View className="mt-2 flex-row gap-2">
              {user?.email_verified === false ? (
                <Badge label="Email not verified" variant="warning" />
              ) : null}
              {user?.phone && user.phone_verified === false ? (
                <Badge label="Phone not verified" variant="warning" />
              ) : null}
              {user?.status && user.status !== 'active' ? (
                <Badge label={user.status} variant="danger" className="capitalize" />
              ) : null}
            </View>
          </View>

          {/* Shortcuts */}
          <View className="mb-6 gap-2">
            <LinkRow
              label="Your orders"
              hint="One-off orders and payments"
              onPress={() => router.push('/orders')}
            />
            <LinkRow
              label="Subscription orders"
              hint="Plans, schedules and allowances"
              onPress={() => router.push('/subscriptions')}
            />
            <LinkRow
              label="Payments"
              hint="Charges, refunds and anything outstanding"
              onPress={() => router.push('/payments')}
            />
          </View>

          {updateProfile.isError ? (
            <InlineError error={updateProfile.error} className="mb-4" />
          ) : null}

          {/* Details */}
          <Card>
            <View className="gap-4 p-5">
              <Text className="text-sm font-bold text-text-primary">Your details</Text>

              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value }, fieldState }) => (
                  <Input
                    label="Full name"
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
                    label="Email"
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
                    label="Phone"
                    hint="Changing this means verifying it again"
                    value={value ?? ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={fieldState.error?.message}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                  />
                )}
              />

              <Controller
                control={control}
                name="locale"
                render={({ field: { onChange, value } }) => (
                  <View className="gap-1.5">
                    <Text className="text-sm font-semibold text-text-primary">
                      Language for emails
                    </Text>
                    <View className="flex-row gap-2">
                      {LOCALES.map((locale) => (
                        <Chip
                          key={locale.value}
                          label={locale.label}
                          active={value === locale.value}
                          onPress={() => onChange(locale.value)}
                        />
                      ))}
                    </View>
                  </View>
                )}
              />

              <Button
                label="Save changes"
                loading={updateProfile.isPending}
                disabled={!formState.isDirty}
                onPress={handleSubmit(onSubmit)}
              />
            </View>
          </Card>

          {/* Dietary preferences */}
          <Card className="mt-4">
            <View className="p-5">
              <Text className="text-sm font-bold text-text-primary">
                Dietary preferences
              </Text>
              <Text className="mt-1 text-xs text-text-muted">
                Applied automatically when you swap a dish — anything you avoid
                is removed from the options you&apos;re offered.
              </Text>

              {updateDietary.isError ? (
                <InlineError error={updateDietary.error} className="mt-3" />
              ) : null}

              <Text className="mt-4 text-xs font-bold uppercase text-text-muted">
                I prefer
              </Text>
              <View className="mt-2 flex-row flex-wrap gap-2">
                {DIETARY_TAGS.map((tag) => (
                  <Chip
                    key={tag}
                    label={humanise(tag)}
                    active={tags.includes(tag)}
                    disabled={updateDietary.isPending}
                    onPress={() => toggleTag(tag)}
                  />
                ))}
              </View>

              <Separator className="my-4" />

              <Text className="text-xs font-bold uppercase text-text-muted">
                I avoid
              </Text>
              <View className="mt-2 flex-row flex-wrap gap-2">
                {ALLERGENS.map((allergen) => (
                  <Chip
                    key={allergen}
                    label={humanise(allergen)}
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
                  Preferred meal time
                </Text>
                <Text className="mt-1 text-xs text-text-muted">
                  Pre-selected when you order or subscribe.
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

          {/* Addresses */}
          <Card className="mt-4">
            <View className="p-5">
              <View className="flex-row items-center justify-between gap-3">
                <Text className="text-sm font-bold text-text-primary">Addresses</Text>
                <Button
                  label="Add"
                  size="sm"
                  variant="secondary"
                  fullWidth={false}
                  onPress={() => setAddressForm({ open: true })}
                />
              </View>

              {!addresses || addresses.length === 0 ? (
                <Text className="mt-3 text-sm text-text-secondary">
                  No saved addresses yet. Add one so we know where to deliver.
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
                          {address.instructions ? (
                            <Text className="mt-1 text-xs italic text-text-muted">
                              {address.instructions}
                            </Text>
                          ) : null}
                        </View>

                        {address.is_default ? (
                          <Badge label="Default" variant="brand" />
                        ) : null}
                      </View>

                      <View className="mt-2 flex-row gap-2">
                        <Button
                          label="Edit"
                          size="sm"
                          variant="ghost"
                          fullWidth={false}
                          onPress={() => setAddressForm({ open: true, address })}
                        />
                        {!address.is_default ? (
                          <Button
                            label="Make default"
                            size="sm"
                            variant="ghost"
                            fullWidth={false}
                            loading={setDefaultAddress.isPending}
                            onPress={() =>
                              setDefaultAddress.mutate(address.id, {
                                onSuccess: () => toast.success('Default address set'),
                                onError: (e) =>
                                  toast.error(
                                    isApiError(e) ? e.message : 'Could not set that',
                                  ),
                              })
                            }
                          />
                        ) : null}
                        <Button
                          label="Delete"
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

          <Button
            label="Sign out"
            variant="outline"
            className="mt-6"
            loading={logout.isPending}
            onPress={() => logout.mutate()}
          />
        </ScrollView>
      </KeyboardAvoidingView>

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
              toast.success('Address deleted');
            },
            onError: (e) => {
              setPendingDelete(null);
              toast.error(
                isApiError(e) ? e.message : 'That address could not be deleted',
              );
            },
          });
        }}
        title="Delete this address?"
        description={pendingDelete ? formatAddress(pendingDelete) : undefined}
        confirmLabel="Delete"
        destructive
        loading={deleteAddress.isPending}
      />
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
