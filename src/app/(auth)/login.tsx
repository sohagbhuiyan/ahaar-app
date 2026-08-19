import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { Button, Input, InlineError } from '@/components/ui';
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
 * Both land back where they came from rather than being pushed at the tabs,
 * since the app is browsable either way.
 */
export default function LoginScreen() {
  const router = useRouter();

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const login = useLogin({
    onSuccess: (user) => {
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      leave();
    },
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
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-8">
            <Text className="text-3xl font-bold text-text-primary">Welcome back</Text>
            <Text className="mt-1.5 text-sm text-text-secondary">
              Sign in to manage your meal plan
            </Text>
          </View>

          {/* Field-level errors come from Zod; this shows the API's own message
              (bad credentials, inactive account, rate limit). */}
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

          <Button
            label="Sign in"
            size="lg"
            className="mt-6"
            loading={login.isPending}
            onPress={handleSubmit(onSubmit)}
          />

          <View className="mt-6 flex-row items-center justify-center gap-1.5">
            <Text className="text-sm text-text-secondary">New to Ahaar?</Text>
            <Link href="/(auth)/register" className="text-sm font-bold text-brand-500">
              Create an account
            </Link>
          </View>

          {/* An account is only needed to order — never to look around. */}
          <Button
            label="Keep browsing"
            variant="ghost"
            className="mt-2"
            onPress={leave}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
