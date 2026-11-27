import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import GlobeIcon from '@/components/icons/GlobeIcon';
import { Sheet } from '@/components/ui/Sheet';
import { LOCALES, LOCALE_META, isRtlLocale, type AppLocale } from '@/lib/i18n/config';
import { useLanguageStore } from '@/lib/store/useLanguageStore';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/utils';

interface Props {
  /**
   * `surface` — on a white bar (Home header).
   * `onBrand` — on the orange onboarding field.
   */
  tone?: 'surface' | 'onBrand';
  className?: string;
}

/**
 * Compact language switcher: a small globe + short code chip (EN · BN · AR)
 * that opens a sheet with the three languages.
 *
 * Tapping a language applies it at once and closes the sheet — no separate
 * "Done". Crossing into or out of Arabic restarts the app (native layout
 * direction is fixed at startup), which the row says up front instead of
 * asking afterwards.
 *
 * The sheet is a portal at the app root, so it would otherwise survive a
 * navigation and float over an unrelated screen. It is owned by the screen it
 * was opened from and closes the moment that screen loses focus.
 *
 * The inline `LanguagePicker` stays the settings control (Account tab, Edit
 * profile); this is the quick switch for headers.
 */
export function LanguageSwitcher({ tone = 'surface', className }: Props) {
  const { t } = useTranslation();
  const locale = useLanguageStore((s) => s.locale);
  const setLocale = useLanguageStore((s) => s.setLocale);
  const [open, setOpen] = useState(false);

  // Leaving the screen closes the sheet, so it can never be left floating
  // over wherever the customer went next.
  useFocusEffect(useCallback(() => () => setOpen(false), []));

  const choose = (next: AppLocale) => {
    setOpen(false);
    if (next === locale) return;
    void setLocale(next);
  };

  const onBrand = tone === 'onBrand';

  return (
    <>
      <Pressable
        testID="language-switcher"
        accessibilityRole="button"
        accessibilityLabel={`${t('common.language.switch')} (${LOCALE_META[locale].native})`}
        onPress={() => setOpen(true)}
        hitSlop={6}
        className={cn(
          'h-10 flex-row items-center gap-1 rounded-full px-2.5 active:opacity-70',
          onBrand ? 'bg-white/20' : 'bg-surface-muted',
          className,
        )}
      >
        <GlobeIcon color={onBrand ? colors.text.inverse : colors.text.primary} size={18} />
        <Text
          className={cn(
            'text-xs font-bold uppercase',
            onBrand ? 'text-text-inverse' : 'text-text-primary',
          )}
        >
          {locale}
        </Text>
      </Pressable>

      <Sheet open={open} onClose={() => setOpen(false)} title={t('common.language.label')}>
        <View accessibilityRole="radiogroup" className="gap-2 pb-2">
          {LOCALES.map((code) => {
            const active = code === locale;
            const restarts = !active && isRtlLocale(code) !== isRtlLocale(locale);
            return (
              <Pressable
                key={code}
                testID={`language-option-${code}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLanguage={code}
                onPress={() => choose(code)}
                className={cn(
                  'flex-row items-center gap-3 rounded-2xl border px-4 py-3.5 active:opacity-80',
                  active ? 'border-brand-500 bg-brand-50' : 'border-border bg-surface',
                )}
              >
                <View
                  className={cn(
                    'h-8 w-10 items-center justify-center rounded-lg',
                    active ? 'bg-brand-500' : 'bg-surface-muted',
                  )}
                >
                  <Text
                    className={cn(
                      'text-xs font-bold uppercase',
                      active ? 'text-text-inverse' : 'text-text-secondary',
                    )}
                  >
                    {code}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text
                    className={cn(
                      'text-base font-semibold',
                      active ? 'text-brand-700' : 'text-text-primary',
                    )}
                  >
                    {LOCALE_META[code].native}
                  </Text>
                  {restarts ? (
                    <Text className="mt-0.5 text-xs text-text-muted">
                      {t('common.language.restartHint')}
                    </Text>
                  ) : null}
                </View>
                {active ? <Text className="text-base font-bold text-brand-500">✓</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </>
  );
}
