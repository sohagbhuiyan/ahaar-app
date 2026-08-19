import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { cn } from '@/lib/utils';

export interface TabItem<T extends string | number> {
  value: T;
  label: string;
  /** Secondary line, e.g. the date under a weekday. */
  sublabel?: string;
  disabled?: boolean;
}

interface Props<T extends string | number> {
  items: TabItem<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Horizontal scroll (day tabs) vs. equal-width segments (weekly/monthly). */
  scrollable?: boolean;
  className?: string;
}

/**
 * Horizontal tab control.
 *
 * In `scrollable` mode the active tab is scrolled into view whenever it
 * changes — the Menu tab can hold 30 days, and a selection made from elsewhere
 * (deep link, "jump to today") would otherwise land off-screen.
 */
export function Tabs<T extends string | number>({
  items,
  value,
  onChange,
  scrollable = true,
  className,
}: Props<T>) {
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Map<T, number>>(new Map());

  useEffect(() => {
    if (!scrollable || value === null) return;
    const x = offsets.current.get(value);
    if (x === undefined) return;

    // Nudge left so the active tab isn't flush against the edge.
    scrollRef.current?.scrollTo({ x: Math.max(0, x - 16), animated: true });
  }, [value, scrollable]);

  const renderTab = (item: TabItem<T>) => {
    const active = item.value === value;

    return (
      <Pressable
        key={String(item.value)}
        accessibilityRole="tab"
        accessibilityState={{ selected: active, disabled: item.disabled }}
        disabled={item.disabled}
        onPress={() => onChange(item.value)}
        onLayout={(e) => offsets.current.set(item.value, e.nativeEvent.layout.x)}
        className={cn(
          'items-center justify-center rounded-2xl px-4 py-2.5',
          scrollable ? 'min-w-[76px]' : 'flex-1',
          active ? 'bg-brand-500' : 'bg-surface-muted',
          item.disabled && 'opacity-40',
        )}
      >
        <Text
          className={cn(
            'text-sm font-bold',
            active ? 'text-text-inverse' : 'text-text-secondary',
          )}
        >
          {item.label}
        </Text>

        {item.sublabel ? (
          <Text
            className={cn(
              'mt-0.5 text-[11px]',
              active ? 'text-brand-100' : 'text-text-muted',
            )}
          >
            {item.sublabel}
          </Text>
        ) : null}
      </Pressable>
    );
  };

  if (!scrollable) {
    return (
      <View className={cn('flex-row gap-2', className)}>{items.map(renderTab)}</View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
      className={className}
    >
      {items.map(renderTab)}
    </ScrollView>
  );
}
