import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { Button, Input, InlineError } from '@/components/ui';
import { useRegister } from '@/lib/query/hooks';

/**
 * Mirrors the backend's `RegisterRequest`. `password_confirmation` is Laravel's
 * `confirmed` rule — the field name matters, so it's kept verbatim rather than
 * renamed to something more idiomatic.
 */
const schema = z
  .object({
    name: z.string().min(2, 'Enter your name').max(120),
    email: z.string().min(1, 'Email is required').email('Enter a valid email'),
    phone: z.string().max(32).optional().or(z.literal('')),
    password: z.string().min(8, 'At least 8 characters'),
    password_confirmation: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: "Passwords don't match",
    path: ['password_confirmation'],
  });

type FormValues = z.infer<typeof schema>;

export default function RegisterScreen() {
  const router = useRouter();

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const register = useRegister({
    onSuccess: (user) => {
      toast.success(`Welcome, ${user.name.split(' ')[0]}`);
      leave();
    },
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
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-8">
            <Text className="text-3xl font-bold text-text-primary">Create account</Text>
            <Text className="mt-1.5 text-sm text-text-secondary">
              Fresh meals, delivered on your schedule
            </Text>
          </View>

          {register.isError ? (
            <InlineError error={register.error} className="mb-4" />
          ) : null}

          <View className="gap-4">
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
                  textContentType="name"
                  placeholder="Sohag Ahmed"
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
                  textContentType="emailAddress"
                  placeholder="you@example.com"
                />
              )}
            />

            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, onBlur, value }, fieldState }) => (
                <Input
                  label="Phone"
                  hint="Optional"
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={fieldState.error?.message}
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
                <Input
                  label="Password"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={fieldState.error?.message}
                  hint="At least 8 characters"
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                />
              )}
            />

            <Controller
              control={control}
              name="password_confirmation"
              render={({ field: { onChange, onBlur, value }, fieldState }) => (
                <Input
                  label="Confirm password"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={fieldState.error?.message}
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                  onSubmitEditing={handleSubmit(onSubmit)}
                  returnKeyType="go"
                />
              )}
            />
          </View>

          <Button
            label="Create account"
            size="lg"
            className="mt-6"
            loading={register.isPending}
            onPress={handleSubmit(onSubmit)}
          />

          <View className="mt-6 flex-row items-center justify-center gap-1.5">
            <Text className="text-sm text-text-secondary">Already have an account?</Text>
            <Link href="/(auth)/login" className="text-sm font-bold text-brand-500">
              Sign in
            </Link>
          </View>

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
