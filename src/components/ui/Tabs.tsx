import { useEffect, useRef } from "react";
import { I18nManager, Pressable, ScrollView, Text, View } from "react-native";

import { cn } from "@/lib/utils";

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
  const offsets = useRef<Map<T, { x: number; width: number }>>(new Map());
  const viewportWidth = useRef(0);

  useEffect(() => {
    if (!scrollable || value === null) return;
    const tab = offsets.current.get(value);
    if (tab === undefined) return;

    // Nudge toward the start so the active tab isn't flush against the edge.
    // Offsets are physical (from the left) on both platforms; in RTL the tabs
    // start at the right, so align the tab's right edge instead.
    const x = I18nManager.isRTL
      ? tab.x + tab.width + 16 - viewportWidth.current
      : tab.x - 16;
    scrollRef.current?.scrollTo({ x: Math.max(0, x), animated: true });
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
        onLayout={(e) =>
          offsets.current.set(item.value, {
            x: e.nativeEvent.layout.x,
            width: e.nativeEvent.layout.width,
          })
        }
        className={cn(
          "items-center justify-center rounded-2xl px-4 py-2.5",
          scrollable ? "min-w-[76px]" : "flex-1",
          active ? "bg-brand-500" : "bg-surface-muted",
          item.disabled && "opacity-40",
        )}
      >
        <Text
          className={cn(
            "text-sm font-bold",
            active ? "text-text-inverse" : "text-text-secondary",
          )}
        >
          {item.label}
        </Text>

        {item.sublabel ? (
          <Text
            className={cn(
              "mt-0.5 text-[11px]",
              active ? "text-brand-100" : "text-text-muted",
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
      <View className={cn("flex-row gap-2", className)}>
        {items.map(renderTab)}
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={(e) => {
        viewportWidth.current = e.nativeEvent.layout.width;
      }}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
      className={className}
    >
      {items.map(renderTab)}
    </ScrollView>
  );
}
