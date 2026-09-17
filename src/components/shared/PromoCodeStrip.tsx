import { ScrollView, Text, View } from 'react-native';

import type { PromoCode } from '@/lib/api/types/home';
import { cmsText } from '@/lib/cms';
import { formatLongDate } from '@/lib/utils';

interface Props {
  codes: PromoCode[];
  heading?: string | null;
  subheading?: string | null;
  className?: string;
}

/**
 * Admin-published promo codes, as tear-off tickets.
 *
 * Renders nothing without codes, which today is always: the API does not
 * serve them yet (see `'promo_codes'` in `api/types/home.ts`). The code itself
 * is selectable text — long-press copies it with the system menu, so no
 * clipboard module is needed.
 */
export function PromoCodeStrip({ codes, heading, subheading, className }: Props) {
  if (codes.length === 0) return null;

  return (
    <View className={className}>
      <View className="mb-3 px-5">
        <Text className="text-lg font-bold text-text-primary">
          {cmsText(heading, 'Offers for you')}
        </Text>
        <Text className="mt-0.5 text-sm text-text-secondary">
          {cmsText(subheading, 'Press and hold a code to copy it')}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}
        style={{ flexGrow: 0 }}
      >
        {codes.map((promo) => (
          <View
            key={promo.code}
            className="w-72 flex-row overflow-hidden rounded-3xl border border-brand-100 bg-surface"
          >
            <View className="w-20 items-center justify-center bg-brand-500 px-2">
              <Text
                numberOfLines={3}
                className="text-center text-sm font-bold leading-4 text-text-inverse"
              >
                {promo.discount_label ?? 'Offer'}
              </Text>
            </View>

            {/* The perforation between the stub and the ticket. */}
            <View className="w-0 border-l border-dashed border-brand-200" />

            <View className="flex-1 p-4">
              <Text numberOfLines={1} className="text-sm font-bold text-text-primary">
                {promo.title ?? 'Promo code'}
              </Text>
              {promo.description ? (
                <Text numberOfLines={2} className="mt-0.5 text-xs text-text-secondary">
                  {promo.description}
                </Text>
              ) : null}

              <View className="mt-3 self-start rounded-xl border border-dashed border-brand-500 bg-brand-50 px-3 py-1.5">
                <Text
                  selectable
                  accessibilityLabel={`Promo code ${promo.code}`}
                  className="text-sm font-bold tracking-widest text-brand-700"
                >
                  {promo.code}
                </Text>
              </View>

              {promo.expires_at ? (
                <Text className="mt-2 text-[11px] text-text-muted">
                  Valid until {formatLongDate(promo.expires_at.slice(0, 10))}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
