import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { PressableScale } from '@/components/ui';
import {
  dayOfMonth,
  formatDayHeading,
  formatWeekRange,
  mealTone,
  weekdayShort,
  weekIndexOf,
  type CalendarDay,
  type DeliveryWeek,
  type MealTone,
} from '@/lib/deliveries';
import { colors, shadows } from '@/lib/theme';
import { cn, todayISO } from '@/lib/utils';

interface Props {
  weeks: DeliveryWeek[];
  /** Selected date, YYYY-MM-DD. */
  value: string | null;
  onChange: (date: string) => void;
  className?: string;
}

/** Space between day boxes. */
const DAY_GAP = 6;
/** `mx-5` on the card plus `p-3` inside it — the pager width before layout. */
const HORIZONTAL_CHROME = 40 + 24;

/**
 * The subscriber's calendar: one row of seven day boxes per plan week.
 *
 * A week fits the screen at every width — each box takes a seventh of the row —
 * so there is no long ribbon of dates to scrub through. Swipe sideways for the
 * next week or use the arrows; the header always says which week of how many.
 * Each box shows the weekday, the date and one dot per meal, coloured by what
 * the customer can still do with it. Days the plan doesn't deliver on stay in
 * the row, dimmed, so the week keeps its shape.
 *
 * Choosing a date never moves the page; picking one in another week brings that
 * week into view.
 */
export function DeliveryCalendar({ weeks, value, onChange, className }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const [pageWidth, setPageWidth] = useState(Math.max(1, windowWidth - HORIZONTAL_CHROME));
  const scrollRef = useRef<ScrollView>(null);

  const today = todayISO();
  const lastWeek = Math.max(weeks.length - 1, 0);
  const clamp = (week: number) => Math.min(Math.max(week, 0), lastWeek);
  const selectedWeek = weekIndexOf(weeks, value) ?? 0;

  // Browsing to another week is remembered only for the current selection:
  // picking a date (from anywhere) returns the view to that date's week,
  // without an effect writing state back.
  const [browsing, setBrowsing] = useState<{ week: number; forDate: string | null } | null>(null);
  const visibleWeek = clamp(
    browsing && browsing.forDate === value ? browsing.week : selectedWeek,
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ x: visibleWeek * pageWidth, y: 0, animated: true });
  }, [visibleWeek, pageWidth]);

  const week = weeks[visibleWeek];
  if (!week) return null;

  const showWeek = (next: number) => setBrowsing({ week: clamp(next), forDate: value });

  const onLayout = (event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    if (width > 0 && width !== pageWidth) setPageWidth(width);
  };

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    if (next !== visibleWeek) showWeek(next);
  };

  const todayInPlan = weeks.some((w) => w.days.some((d) => d.inPlan && d.date === today));

  return (
    <View
      className={cn('mx-5 rounded-3xl border border-border bg-surface p-3', className)}
      style={shadows.card}
    >
      <View className="mb-3 flex-row items-center gap-2">
        <WeekArrow
          direction="previous"
          disabled={visibleWeek === 0}
          onPress={() => showWeek(visibleWeek - 1)}
        />
        <View className="flex-1 items-center">
          <Text className="text-sm font-bold text-text-primary">
            Week {week.number} of {weeks.length}
          </Text>
          <Text className="mt-0.5 text-xs text-text-muted">
            {formatWeekRange(week.from, week.to)}
          </Text>
        </View>
        <WeekArrow
          direction="next"
          disabled={visibleWeek === lastWeek}
          onPress={() => showWeek(visibleWeek + 1)}
        />
      </View>

      <View onLayout={onLayout}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          contentOffset={{ x: selectedWeek * pageWidth, y: 0 }}
          onMomentumScrollEnd={onMomentumScrollEnd}
        >
          {weeks.map((w) => (
            <View key={w.from} style={{ width: pageWidth, flexDirection: 'row', gap: DAY_GAP }}>
              {w.days.map((day) => (
                <DayBox
                  key={day.date}
                  day={day}
                  selected={day.date === value}
                  isToday={day.date === today}
                  onPress={() => onChange(day.date)}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      </View>

      <View className="mt-3 flex-row items-center gap-3 border-t border-border pt-3">
        <View className="flex-1 flex-row flex-wrap items-center gap-x-3 gap-y-1">
          <LegendItem tone="open" label="Editable" />
          <LegendItem tone="locked" label="Locked" />
          <LegendItem tone="delivered" label="Delivered" />
        </View>

        {todayInPlan && value !== today ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Jump to today"
            onPress={() => onChange(today)}
            hitSlop={8}
            className="rounded-full bg-brand-50 px-3 py-1.5 active:bg-brand-100"
          >
            <Text className="text-xs font-bold text-brand-700">Today</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function DayBox({
  day,
  selected,
  isToday,
  onPress,
}: {
  day: CalendarDay;
  selected: boolean;
  isToday: boolean;
  onPress: () => void;
}) {
  const tones = day.deliveries.map(mealTone);
  const allOff = day.inPlan && tones.every((tone) => tone === 'off');
  const count = day.deliveries.length;

  const accessibilityLabel = [
    formatDayHeading(day.date),
    day.inPlan ? `${count} ${count === 1 ? 'meal' : 'meals'}` : 'no delivery',
    allOff ? 'skipped' : null,
    isToday ? 'today' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled: !day.inPlan }}
      disabled={!day.inPlan}
      onPress={onPress}
      pressedScale={0.92}
      className={cn(
        'flex-1 rounded-2xl border',
        selected
          ? 'border-brand-500 bg-brand-500'
          : isToday
            ? 'border-brand-300 bg-brand-50'
            : day.inPlan
              ? 'border-border bg-surface'
              : 'border-transparent bg-surface-muted',
      )}
      style={selected ? shadows.brand : undefined}
      contentClassName="w-full items-center py-2.5"
    >
      <Text
        numberOfLines={1}
        className={cn(
          'text-[10px] font-bold uppercase',
          selected ? 'text-white/85' : isToday ? 'text-brand-600' : 'text-text-muted',
        )}
      >
        {weekdayShort(day.date)}
      </Text>

      <Text
        className={cn(
          'mt-0.5 text-lg font-bold',
          selected
            ? 'text-text-inverse'
            : allOff || !day.inPlan
              ? 'text-text-muted'
              : 'text-text-primary',
          allOff && 'line-through',
        )}
      >
        {dayOfMonth(day.date)}
      </Text>

      {/* One dot per meal, so a full-board day reads as three at a glance. */}
      <View className="mt-1 h-1.5 flex-row gap-0.5">
        {tones.slice(0, 3).map((tone, index) => (
          <View key={index} className={cn('h-1.5 w-1.5 rounded-full', dotClass(tone, selected))} />
        ))}
      </View>
    </PressableScale>
  );
}

function dotClass(tone: MealTone, onSelected: boolean): string {
  if (onSelected) return tone === 'off' ? 'bg-white/40' : 'bg-white';
  switch (tone) {
    case 'open':
      return 'bg-brand-500';
    case 'locked':
      return 'bg-brand-200';
    case 'delivered':
      return 'bg-success';
    default:
      return 'bg-border-strong';
  }
}

function LegendItem({ tone, label }: { tone: MealTone; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className={cn('h-1.5 w-1.5 rounded-full', dotClass(tone, false))} />
      <Text className="text-[11px] text-text-muted">{label}</Text>
    </View>
  );
}

function WeekArrow({
  direction,
  disabled,
  onPress,
}: {
  direction: 'previous' | 'next';
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={direction === 'previous' ? 'Previous week' : 'Next week'}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      className={cn(
        'h-9 w-9 items-center justify-center rounded-full bg-surface-muted active:bg-brand-50',
        disabled && 'opacity-40',
      )}
    >
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path
          d={direction === 'previous' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
          stroke={colors.text.primary}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}
