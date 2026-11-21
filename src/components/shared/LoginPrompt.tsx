import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View, type TextInput } from 'react-native';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { Button, InlineError, Input, PasswordInput, Sheet } from '@/components/ui';
import { useLogin } from '@/lib/query/hooks';
import { useAuthPromptStore } from '@/lib/store';

import { GoogleSignInButton } from './GoogleSignInButton';

const schema = z.object({
  email: z.string().min(1, 'common.validation.required').email('common.validation.email'),
  password: z.string().min(1, 'common.validation.required'),
});

type FormValues = z.infer<typeof schema>;

/**
 * The sign-in modal that guards ordering.
 *
 * Sign-in happens *here* rather than on a pushed route so the customer keeps
 * their place — the half-filled order behind the sheet is still there when it
 * closes, and `resolve()` replays the tap that opened it. Registration is the
 * one thing that does navigate: it needs more room than a sheet, and a brand
 * new account has no pending order worth preserving.
 *
 * There is no keyboard handling in this file on purpose: `Sheet` lifts itself
 * and its footer above the keyboard, so the fields and "Sign in" stay visible
 * while typing.
 *
 * Mounted once, from the root layout.
 */
export function LoginPrompt() {
  const { t } = useTranslation();
  const router = useRouter();
  const passwordRef = useRef<TextInput>(null);

  const open = useAuthPromptStore((s) => s.open);
  const reason = useAuthPromptStore((s) => s.reason);
  const close = useAuthPromptStore((s) => s.close);
  const resolve = useAuthPromptStore((s) => s.resolve);

  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const login = useLogin({
    onSuccess: (user) => {
      reset();
      toast.success(t('auth.toast.welcomeBack', { name: user.name.split(' ')[0] }));
      resolve();
    },
  });

  /**
   * A dismissed prompt must not keep the previous attempt's password or error
   * around — reopening it should look untouched. Cleared on the way out rather
   * than in an effect watching `open`, which would cascade an extra render on
   * every close.
   */
  const handleClose = () => {
    reset();
    login.reset();
    close();
  };

  const onSubmit = (values: FormValues) => {
    if (login.isPending) return;
    login.mutate(values);
  };

  const goToRegister = () => {
    handleClose();
    router.push('/(auth)/register');
  };

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title={t('auth.prompt.title')}
      description={
        reason
          ? // `reason` is an already-translated purpose phrase ("to place this
            // order"); each language's template puts it where its grammar wants.
            t('auth.prompt.needAccount', { reason })
          : t('auth.prompt.browsingOpen')
      }
      footer={
        <View className="gap-3">
          <Button
            label={t('auth.login.submit')}
            size="lg"
            loading={login.isPending}
            onPress={handleSubmit(onSubmit)}
          />

          <View className="flex-row items-center justify-center gap-1.5">
            <Text className="text-sm text-text-secondary">{t('auth.login.newHere')}</Text>
            <Pressable accessibilityRole="link" onPress={goToRegister}>
              <Text className="text-sm font-bold text-brand-500">
                {t('auth.login.createAccount')}
              </Text>
            </Pressable>
          </View>
        </View>
      }
    >
      {/* Resolves the prompt like the email form does, so the tap that opened
          it still goes through after a Google sign-in. */}
      <GoogleSignInButton
        divider
        onSuccess={() => {
          reset();
          login.reset();
          resolve();
        }}
      />

      {login.isError ? <InlineError error={login.error} className="mb-4" /> : null}

      <View className="gap-4 pb-2">
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value }, fieldState }) => (
            <Input
              label={t('auth.fields.email')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder={t('auth.fields.emailPlaceholder')}
              // "Next" moves to the password without dropping the keyboard,
              // so the sheet doesn't bounce down and back up between fields.
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value }, fieldState }) => (
            <PasswordInput
              ref={passwordRef}
              label={t('auth.fields.password')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
              autoComplete="current-password"
              textContentType="password"
              placeholder="••••••••"
              onSubmitEditing={handleSubmit(onSubmit)}
              returnKeyType="go"
            />
          )}
        />
      </View>
    </Sheet>
  );
}
