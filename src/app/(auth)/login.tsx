import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
  type TextInput,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { AhaarLogo } from '@/components/shared/AhaarLogo';
import { GoogleSignInButton } from '@/components/shared/GoogleSignInButton';
import { Button, InlineError, Input, PasswordInput } from '@/components/ui';
import { useLogin } from '@/lib/query/hooks';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

/**
 * The full-screen sign-in route.
 *
 * Most sign-ins happen in `LoginPrompt`, the sheet that guards ordering — this
 * screen exists for the deep link and for anyone who navigates here directly.
 *
 * Success lands on Home. The screen doesn't navigate itself: `AuthGate` moves
 * a signed-in customer off the auth screens the moment the token exists, and
 * Home then asks for a delivery location if the account has none.
 */
export default function LoginScreen() {
  const router = useRouter();
  const passwordRef = useRef<TextInput>(null);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const login = useLogin({
    onSuccess: (user) => toast.success(`Welcome back, ${user.name.split(' ')[0]}`),
  });

  const { control, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (values: FormValues) => {
    if (login.isPending) return;
    login.mutate(values);
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
          <Animated.View entering={FadeInDown.duration(500)} className="items-center">
            <AhaarLogo height={88} />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(80).duration(500)}
            className="mb-8 mt-6 items-center"
          >
            <Text className="text-3xl font-bold text-text-primary">Welcome back</Text>
            <Text className="mt-1.5 text-center text-sm text-text-secondary">
              Sign in to manage your meals, plan and deliveries
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(160).duration(500)}>
            {/* Like the email form, a Google sign-in leaves navigation to AuthGate. */}
            <GoogleSignInButton divider />

            {/* Field-level errors come from Zod; this shows the API's own
                message (bad credentials, inactive account, rate limit). */}
            {login.isError ? <InlineError error={login.error} className="mb-4" /> : null}

            <View className="gap-4">
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
                    label="Password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={fieldState.error?.message}
                    autoComplete="current-password"
                    textContentType="password"
                    placeholder="••••••••"
                    onSubmitEditing={handleSubmit(onSubmit)}
                    returnKeyType="go"
                  />
                )}
              />
            </View>

            <Button
              label="Sign in"
              size="lg"
              className="mt-6"
              loading={login.isPending}
              onPress={handleSubmit(onSubmit)}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(240).duration(500)} className="mt-8">
            <View className="flex-row items-center gap-3">
              <View className="h-px flex-1 bg-border" />
              <Text className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                New to Ahaar?
              </Text>
              <View className="h-px flex-1 bg-border" />
            </View>

            <Button
              label="Create an account"
              variant="outline"
              size="lg"
              className="mt-4"
              onPress={() => router.push('/(auth)/register')}
            />

            {/* An account is only needed to order — never to look around. */}
            <Button label="Keep browsing" variant="ghost" className="mt-2" onPress={leave} />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
