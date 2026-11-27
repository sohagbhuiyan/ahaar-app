import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { AhaarLogo } from '@/components/shared/AhaarLogo';
import { GoogleSignInButton } from '@/components/shared/GoogleSignInButton';
import { Button, InlineError, Input, PasswordInput } from '@/components/ui';
import { verifyEmailRoute } from '@/lib/auth/verifyEmailRoute';
import { useRegister } from '@/lib/query/hooks';

/**
 * Mirrors the backend's `RegisterRequest`. `password_confirmation` is Laravel's
 * `confirmed` rule — the field name matters, so it's kept verbatim rather than
 * renamed to something more idiomatic.
 */
const schema = z
  .object({
    name: z.string().min(2, 'minLength:2').max(120, 'maxLength:120'),
    email: z.string().min(1, 'required').email('email'),
    phone: z.string().max(32, 'maxLength:32').optional().or(z.literal('')),
    password: z.string().min(8, 'minLength:8'),
    password_confirmation: z.string().min(1, 'required'),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: 'passwordMismatch',
    path: ['password_confirmation'],
  });

type FormValues = z.infer<typeof schema>;

/**
 * Schema messages are `common.validation` keys, optionally `key:n` for the
 * length rules, resolved at render time so they follow the app language.
 */
function validationMessage(t: TFunction, message?: string) {
  if (!message) return undefined;
  const [key, n] = message.split(':');
  const value = n === undefined ? undefined : Number(n);
  return t(`common.validation.${key}`, { min: value, max: value });
}

/**
 * Create an account.
 *
 * The API answers with no session: the email has to be proven first, so a
 * successful submit goes on to the verify-email screen, and the account is
 * signed in once the mailed code is entered there. (Nothing to fight with
 * `AuthGate` here — it only moves *signed-in* customers off `(auth)`.)
 */
export default function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const register = useRegister({
    onSuccess: (challenge) => router.push(verifyEmailRoute(challenge)),
  });

  const { control, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      password_confirmation: '',
    },
  });

  const onSubmit = (values: FormValues) => {
    if (register.isPending) return;
    register.mutate({
      ...values,
      // Send `undefined` rather than "" so Laravel's `nullable` rule applies.
      phone: values.phone || undefined,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 24,
            paddingVertical: 32,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(500)} className="mb-8 items-center">
            <AhaarLogo height={64} />
            <Text className="mt-5 text-3xl font-bold text-text-primary">{t('auth.register.title')}</Text>
            <Text className="mt-1.5 text-center text-sm text-text-secondary">
              {t('auth.register.subtitle')}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            {/* No form to fill: Google vouches for the email, and an existing
                account with it is connected rather than duplicated. */}
            <GoogleSignInButton label={t('auth.register.googleLabel')} divider />

            {register.isError ? (
              <InlineError error={register.error} className="mb-4" />
            ) : null}

            <View className="gap-4">
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value }, fieldState }) => (
                  <Input
                    label={t('auth.fields.fullName')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={validationMessage(t, fieldState.error?.message)}
                    autoComplete="name"
                    textContentType="name"
                    placeholder={t('auth.fields.namePlaceholder')}
                  />
                )}
              />

              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value }, fieldState }) => (
                  <Input
                    label={t('auth.fields.email')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={validationMessage(t, fieldState.error?.message)}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    placeholder={t('auth.fields.emailPlaceholder')}
                  />
                )}
              />

              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, onBlur, value }, fieldState }) => (
                  <Input
                    label={t('auth.fields.phone')}
                    hint={t('common.states.optional')}
                    value={value ?? ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={validationMessage(t, fieldState.error?.message)}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                  />
                )}
              />

              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value }, fieldState }) => (
                  <PasswordInput
                    label={t('auth.fields.password')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={validationMessage(t, fieldState.error?.message)}
                    hint={t('auth.fields.passwordHint')}
                    autoComplete="new-password"
                    textContentType="newPassword"
                  />
                )}
              />

              <Controller
                control={control}
                name="password_confirmation"
                render={({ field: { onChange, onBlur, value }, fieldState }) => (
                  <PasswordInput
                    label={t('auth.fields.confirmPassword')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={validationMessage(t, fieldState.error?.message)}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    onSubmitEditing={handleSubmit(onSubmit)}
                    returnKeyType="go"
                  />
                )}
              />
            </View>

            <Button
              label={t('auth.register.submit')}
              size="lg"
              className="mt-6"
              loading={register.isPending}
              onPress={handleSubmit(onSubmit)}
            />

            <View className="mt-6 flex-row items-center justify-center gap-1.5">
              <Text className="text-sm text-text-secondary">{t('auth.register.haveAccount')}</Text>
              <Link href="/(auth)/login" className="text-sm font-bold text-brand-500">
                {t('auth.register.signInLink')}
              </Link>
            </View>

            <Button label={t('auth.register.keepBrowsing')} variant="ghost" className="mt-2" onPress={leave} />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
