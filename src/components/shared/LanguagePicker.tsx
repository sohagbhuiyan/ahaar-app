import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { LOCALES, LOCALE_META, isRtlLocale, type AppLocale } from '@/lib/i18n/config';
import { useLanguageStore } from '@/lib/store/useLanguageStore';
import { cn } from '@/lib/utils';

/**
 * The one language selector — used on the profile screen, the account tab
 * and onboarding, so switching behaves identically everywhere.
 *
 * Crossing into or out of Arabic restarts the app (native layout direction is
 * fixed at startup), so that switch asks first.
 */
export function LanguagePicker({ className }: { className?: string }) {
  const { t } = useTranslation();
  const locale = useLanguageStore((s) => s.locale);
  const setLocale = useLanguageStore((s) => s.setLocale);
  const [pending, setPending] = useState<AppLocale | null>(null);

  const apply = async (next: AppLocale) => {
    setPending(next);
    try {
      await setLocale(next);
    } finally {
      setPending(null);
    }
  };

  const choose = (next: AppLocale) => {
    if (next === locale || pending) return;
    if (isRtlLocale(next) !== isRtlLocale(locale)) {
      Alert.alert(t('common.language.restartTitle'), t('common.language.restartBody'), [
        { text: t('common.actions.cancel'), style: 'cancel' },
        { text: t('common.language.restartConfirm'), onPress: () => void apply(next) },
      ]);
      return;
    }
    void apply(next);
  };

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('common.language.label')}
      className={cn('flex-row gap-2', className)}
    >
      {LOCALES.map((code) => {
        const active = code === locale;
        return (
          <Pressable
            key={code}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLanguage={code}
            onPress={() => choose(code)}
            className={cn(
              'flex-1 items-center rounded-xl border px-3 py-2.5',
              active ? 'border-brand-500 bg-brand-50' : 'border-border bg-surface',
            )}
          >
            {pending === code ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text
                className={cn(
                  'text-sm font-semibold',
                  active ? 'text-brand-700' : 'text-text-primary',
                )}
              >
                {LOCALE_META[code].native}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
