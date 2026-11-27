import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import { AhaarLogo } from '@/components/shared/AhaarLogo';
import { Button } from '@/components/ui';
import { apiErrorDomainCode } from '@/lib/api/endpoints/auth';
import { isApiError } from '@/lib/api/types/common';
import { useResendEmailCode, useVerifyEmail } from '@/lib/query/hooks';
import { cn } from '@/lib/utils';

const CODE_LENGTH = 6;
/** The API's default code lifetime, when the caller didn't pass one. */
const DEFAULT_EXPIRES_IN = 300;

/** Whole seconds until `deadline` (a `Date.now()` timestamp), never negative. */
function secondsUntil(deadline: number, now: number) {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function toSeconds(value: string | string[] | undefined, fallback: number) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

type ErrorState = { message: string; needsNewCode: boolean } | null;

/**
 * Enter the 6-digit code mailed to a new (or still unverified) email account.
 *
 * Reached from registration (201, no token yet) and from sign-in (403
 * `email_unverified`, once the password was right). Params: `email`,
 * `resend` — seconds until another code may be requested — and optionally
 * `expires` and `sent` (`0` when no new mail went out this time).
 *
 * A correct code is a sign-in: `useVerifyEmail` stores the session exactly as
 * `useLogin` does, and `AuthGate` then moves the customer off `(auth)` — this
 * screen doesn't navigate on success.
 */
export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    email?: string;
    resend?: string;
    expires?: string;
    sent?: string;
  }>();
  const email = (Array.isArray(params.email) ? params.email[0] : params.email) ?? '';
  const notSentNow = params.sent === '0';

  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<ErrorState>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [now, setNow] = useState(() => Date.now());
  const [resendAt, setResendAt] = useState(() => Date.now() + toSeconds(params.resend, 0) * 1000);
  const [expiresAt, setExpiresAt] = useState(
    () => Date.now() + toSeconds(params.expires, DEFAULT_EXPIRES_IN) * 1000,
  );

  const resendIn = secondsUntil(resendAt, now);
  const expiresIn = secondsUntil(expiresAt, now);
  const expired = expiresIn === 0;

  // One tick a second while either clock is still running.
  const ticking = resendIn > 0 || !expired;
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticking]);

  const verify = useVerifyEmail({
    onSuccess: (user) =>
      toast.success(t('auth.toast.welcomeNew', { name: user.name.split(' ')[0] })),
  });

  const resend = useResendEmailCode({
    onSuccess: (result) => {
      const at = Date.now();
      setNow(at);
      setResendAt(at + result.resend_available_in * 1000);
      setExpiresAt(at + result.expires_in * 1000);
      setCode('');
      setError(null);
      setInfo(t('auth.verify.resent'));
      inputRef.current?.focus();
    },
  });

  const submit = useCallback(
    (value: string) => {
      if (verify.isPending || value.length !== CODE_LENGTH || !email) return;
      setError(null);
      setInfo(null);
      verify.mutate(
        { email, code: value },
        {
          onError: (e) => {
            const domain = apiErrorDomainCode(e);
            setCode('');
            if (domain === 'otp_invalid') {
              const left = isApiError(e)
                ? Number((e.details as { attempts_remaining?: unknown } | undefined)?.attempts_remaining)
                : NaN;
              setError({
                message: Number.isFinite(left)
                  ? t('auth.verify.errors.invalidWithAttempts', { count: left })
                  : t('auth.verify.errors.invalid'),
                needsNewCode: false,
              });
            } else if (domain === 'otp_expired') {
              setError({ message: t('auth.verify.errors.expired'), needsNewCode: true });
            } else if (domain === 'otp_attempts_exceeded') {
              setError({ message: t('auth.verify.errors.attemptsExceeded'), needsNewCode: true });
            } else {
              // Rate limit, network, a 422 on the email itself, …: the API's
              // own (localised) sentence, or the client's fallback.
              setError({
                message: isApiError(e) ? e.message : t('auth.api.generic'),
                needsNewCode: false,
              });
            }
            inputRef.current?.focus();
          },
        },
      );
    },
    [email, t, verify],
  );

  const onChangeCode = (text: string) => {
    // Digits only, whatever was pasted or autofilled ("123 456", "Code: 123456").
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (error && digits.length > 0) setError(null);
    if (digits.length === CODE_LENGTH) submit(digits);
  };

  const onResend = () => {
    if (resend.isPending || resendIn > 0 || !email) return;
    setInfo(null);
    resend.mutate(email, {
      onError: (e) => {
        const domain = apiErrorDomainCode(e);
        if (domain === 'otp_resend_throttled' || (isApiError(e) && e.status === 429)) {
          const retry = Number((isApiError(e) ? e.details : undefined)?.retry_after);
          if (Number.isFinite(retry) && retry > 0) {
            const at = Date.now();
            setNow(at);
            setResendAt(at + retry * 1000);
          }
          setError({ message: t('auth.verify.errors.resendThrottled'), needsNewCode: false });
        } else if (domain === 'otp_delivery_failed' || (isApiError(e) && e.status === 503)) {
          setError({ message: t('auth.verify.errors.deliveryFailed'), needsNewCode: false });
        } else {
          setError({
            message: isApiError(e) ? e.message : t('auth.api.generic'),
            needsNewCode: false,
          });
        }
      },
    });
  };

  const changeEmail = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/register' as Href);
  };

  const needsNewCode = expired || Boolean(error?.needsNewCode);
  const canResend = resendIn === 0 && !resend.isPending;

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
            <Text className="mt-5 text-center text-3xl font-bold text-text-primary">
              {t('auth.verify.title')}
            </Text>
            <Text className="mt-1.5 text-center text-sm text-text-secondary">
              {notSentNow ? t('auth.verify.subtitleEarlier') : t('auth.verify.subtitle')}
            </Text>
            {/* An address reads left-to-right in every language. */}
            <Text
              className="mt-1 text-center text-base font-bold text-text-primary"
              style={{ writingDirection: 'ltr' }}
              testID="verify-email-address"
            >
              {email}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            <Text className="mb-2 text-sm font-semibold text-text-primary">
              {t('auth.verify.codeLabel')}
            </Text>

            {/* One real field under six drawn boxes: autofill, paste and the
                keyboard all go to the same input, and the boxes only render it.
                The row is pinned LTR — a code is read left to right, in Arabic too. */}
            <Pressable
              onPress={() => inputRef.current?.focus()}
              accessible={false}
              style={{ direction: 'ltr' }}
              className="relative flex-row justify-between gap-2"
            >
              {Array.from({ length: CODE_LENGTH }, (_, i) => {
                const char = code[i] ?? '';
                const active = i === Math.min(code.length, CODE_LENGTH - 1) && !verify.isPending;
                return (
                  <View
                    key={i}
                    className={cn(
                      'h-14 flex-1 items-center justify-center rounded-2xl border bg-surface',
                      error ? 'border-danger' : active ? 'border-brand-500' : 'border-border',
                    )}
                    style={active && !error ? { borderWidth: 2 } : undefined}
                  >
                    <Text className="text-2xl font-bold text-text-primary">{char}</Text>
                  </View>
                );
              })}

              <TextInput
                ref={inputRef}
                value={code}
                onChangeText={onChangeCode}
                autoFocus
                maxLength={CODE_LENGTH + 8 /* room for a pasted "123 456" */}
                keyboardType="number-pad"
                inputMode="numeric"
                textContentType="oneTimeCode"
                autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
                importantForAutofill="yes"
                editable={!verify.isPending}
                caretHidden
                selectionColor="transparent"
                accessibilityLabel={t('auth.verify.codeLabel')}
                accessibilityHint={t('auth.verify.codeHint')}
                testID="verify-email-code"
                // Covers the boxes so a tap or long-press (paste) lands on it,
                // while staying invisible.
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  opacity: 0.02,
                  color: 'transparent',
                  fontSize: 1,
                }}
              />
            </Pressable>

            <Text className="mt-2 text-xs text-text-muted" testID="verify-email-expiry">
              {expired
                ? t('auth.verify.expiredHint')
                : t('auth.verify.expiresIn', { time: formatClock(expiresIn) })}
            </Text>

            {error ? (
              <View
                className="mt-4 rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3"
                accessibilityLiveRegion="polite"
              >
                <Text className="text-sm text-danger" testID="verify-email-error">
                  {error.message}
                </Text>
              </View>
            ) : info ? (
              <View
                className="mt-4 rounded-2xl border border-border bg-surface-muted px-4 py-3"
                accessibilityLiveRegion="polite"
              >
                <Text className="text-sm text-text-secondary">{info}</Text>
              </View>
            ) : null}

            <Button
              label={t('auth.verify.submit')}
              size="lg"
              className="mt-6"
              loading={verify.isPending}
              disabled={code.length !== CODE_LENGTH || needsNewCode}
              onPress={() => submit(code)}
              testID="verify-email-submit"
            />

            <View className="mt-6 items-center gap-1">
              <Text className="text-sm text-text-secondary">{t('auth.verify.noCode')}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !canResend }}
                disabled={!canResend}
                onPress={onResend}
                hitSlop={8}
                testID="verify-email-resend"
              >
                <Text
                  className={cn(
                    'text-sm font-bold',
                    canResend ? 'text-brand-500' : 'text-text-muted',
                  )}
                >
                  {resend.isPending
                    ? t('auth.verify.resending')
                    : resendIn > 0
                      ? t('auth.verify.resendIn', { time: formatClock(resendIn) })
                      : t('auth.verify.resend')}
                </Text>
              </Pressable>
            </View>

            <Button
              label={t('auth.verify.changeEmail')}
              variant="ghost"
              className="mt-4"
              onPress={changeEmail}
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

