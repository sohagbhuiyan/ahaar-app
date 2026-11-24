import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/lib/theme';
import { cn } from '@/lib/utils';

const STROKE = colors.brand[500];

/** Leaf · scooter · heart — the three promises under the plan cards. */
const ITEMS = [
  {
    key: 'fresh',
    icon: (
      <Path
        d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Zm0 0 7-7"
        stroke={STROKE}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    key: 'onTime',
    icon: (
      <>
        <Circle cx={6} cy={17} r={2.5} stroke={STROKE} strokeWidth={2} />
        <Circle cx={18} cy={17} r={2.5} stroke={STROKE} strokeWidth={2} />
        <Path
          d="M8.5 17h7M14 7h3l2.5 7.5M14 7l-2.5 7.5M5 12h6"
          stroke={STROKE}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  {
    key: 'health',
    icon: (
      <Path
        d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"
        stroke={STROKE}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    ),
  },
] as const;

/**
 * "Fresh & healthy meals · On-time delivery · Your health, our priority" —
 * the strip under the plan cards, as on the website's home plans section.
 * Copy is `home.plans.trust.<key>`.
 */
export function PlanTrustStrip({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <View className={cn('flex-row justify-between gap-2', className)}>
      {ITEMS.map(({ key, icon }) => (
        <View key={key} className="flex-1 items-center gap-2" accessible accessibilityRole="text">
          <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-50">
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              {icon}
            </Svg>
          </View>
          <Text className="text-center text-xs font-semibold leading-4 text-text-primary">
            {t(`home.plans.trust.${key}`)}
          </Text>
        </View>
      ))}
    </View>
  );
}
