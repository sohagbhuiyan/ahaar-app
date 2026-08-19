import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { Button, InlineError, Input, Sheet } from '@/components/ui';
import { useLogin } from '@/lib/query/hooks';
import { useAuthPromptStore } from '@/lib/store';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
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
 * Mounted once, from the root layout.
 */
export function LoginPrompt() {
  const router = useRouter();

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
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
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
      title="Sign in to continue"
      description={
        reason
          ? `You need an account ${reason}.`
          : 'Browsing is open to everyone — ordering needs an account.'
      }
      footer={
        <View className="gap-3">
          <Button
            label="Sign in"
            size="lg"
            loading={login.isPending}
            onPress={handleSubmit(onSubmit)}
          />

          <View className="flex-row items-center justify-center gap-1.5">
            <Text className="text-sm text-text-secondary">New to Ahaar?</Text>
            <Pressable accessibilityRole="link" onPress={goToRegister}>
              <Text className="text-sm font-bold text-brand-500">
                Create an account
              </Text>
            </Pressable>
          </View>
        </View>
      }
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {login.isError ? <InlineError error={login.error} className="mb-4" /> : null}

        <View className="gap-4 pb-2">
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
                textContentType="emailAddress"
                placeholder="you@example.com"
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value }, fieldState }) => (
              <Input
                label="Password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={fieldState.error?.message}
                secureTextEntry
                autoComplete="current-password"
                textContentType="password"
                placeholder="••••••••"
                onSubmitEditing={handleSubmit(onSubmit)}
                returnKeyType="go"
              />
            )}
          />
        </View>
      </KeyboardAvoidingView>
    </Sheet>
  );
}
