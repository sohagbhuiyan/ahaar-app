import React, { useEffect, useState } from "react";
import {
    Animated,
    Dimensions,
    Platform,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { navTint } from "../lib/theme";
import { useInstantOrderCount } from "../lib/store";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ACTIVE_COLOR = navTint.active;
const INACTIVE_COLOR = navTint.inactive;
const TAB_BAR_HEIGHT = 58;

type NavigationState = {
  index: number;
  routes: { key: string; name: string }[];
};

type NavigationHelpers = {
  emit: (event: {
    type: string;
    target?: string;
    canPreventDefault?: boolean;
  }) => { defaultPrevented: boolean };
  navigate: (name: string) => void;
};

type DescriptorOptions = {
  title?: string;
  tabBarLabel?:
    | string
    | ((props: { focused: boolean; color: string }) => React.ReactNode);
  tabBarIcon?: (props: {
    focused: boolean;
    color: string;
    size: number;
  }) => React.ReactNode;
};

type RouteDescriptors = Record<string, { options: DescriptorOptions }>;

interface FloatingTabBarProps {
  state: NavigationState;
  descriptors: RouteDescriptors;
  navigation: NavigationHelpers;
}

interface TabItemProps {
  isFocused: boolean;
  label: string;
  icon: (props: { color: string; filled: boolean }) => React.ReactNode;
  onPress: () => void;
  onLongPress: () => void;
  tabCount: number;
  /** Unread-style count drawn over the icon. 0 hides it. */
  badge?: number;
}

function TabItem({
  isFocused,
  label,
  icon,
  onPress,
  onLongPress,
  tabCount,
  badge = 0,
}: TabItemProps) {
  // `useState(() => …)`, not `useRef(new Animated.Value(…)).current`.
  //
  // The ref form allocates a fresh `Animated.Value` on *every* render only to
  // throw it away, and reading `.current` during render is exactly what the
  // React Compiler (enabled for this app in app.json) refuses to optimise
  // around. The lazy state initialiser runs once and returns the same instance
  // for the life of the tab, which is what the animation needs anyway.
  const [scaleAnim] = useState(() => new Animated.Value(1));
  const [labelOpacity] = useState(() => new Animated.Value(isFocused ? 1 : 0));
  const [pillScale] = useState(() => new Animated.Value(isFocused ? 1 : 0));
  const [iconTranslate] = useState(() => new Animated.Value(isFocused ? -2 : 0));

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: isFocused ? 1.06 : 1,
        useNativeDriver: true,
        tension: 120,
        friction: 10,
      }),
      Animated.timing(labelOpacity, {
        toValue: isFocused ? 1 : 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.spring(pillScale, {
        toValue: isFocused ? 1 : 0,
        useNativeDriver: true,
        tension: 160,
        friction: 12,
      }),
      Animated.spring(iconTranslate, {
        toValue: isFocused ? -2 : 0,
        useNativeDriver: true,
        tension: 180,
        friction: 12,
      }),
    ]).start();
    // The four `Animated.Value`s are created once by their lazy initialisers
    // and never replaced, so listing them changes nothing but satisfies the
    // exhaustive-deps rule honestly rather than silencing it.
  }, [isFocused, scaleAnim, labelOpacity, pillScale, iconTranslate]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.88,
      useNativeDriver: true,
      tension: 200,
      friction: 8,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: isFocused ? 1.06 : 1,
      useNativeDriver: true,
      tension: 160,
      friction: 10,
    }).start();
  };

  const tabWidth = SCREEN_WIDTH / tabCount;

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      style={{
        width: tabWidth,
        height: TAB_BAR_HEIGHT,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Pill bg — spring scale 0→1 instead of mount/unmount */}
      <Animated.View
        style={{
          position: "absolute",
          width: 52,
          height: 52,
          borderRadius: 14,
          backgroundColor: "#fff0f5",
          transform: [{ scale: pillScale }],
        }}
      />

      <Animated.View
        style={{
          alignItems: "center",
          transform: [{ scale: scaleAnim }],
        }}
      >
        <Animated.View style={{ transform: [{ translateY: iconTranslate }] }}>
          {icon({
            color: isFocused ? ACTIVE_COLOR : INACTIVE_COLOR,
            filled: isFocused,
          })}

          {/* Basket count. Without it the basket is invisible from every tab
              but Foods, and a half-built order is easy to forget about. */}
          {badge > 0 && (
            <View
              accessibilityLabel={`${badge} in basket`}
              style={{
                position: "absolute",
                top: -6,
                right: -10,
                minWidth: 16,
                height: 16,
                paddingHorizontal: 4,
                borderRadius: 8,
                backgroundColor: ACTIVE_COLOR,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1.5,
                borderColor: "#ffffff",
              }}
            >
              <Text style={{ color: "#ffffff", fontSize: 9, fontWeight: "700" }}>
                {badge > 9 ? "9+" : badge}
              </Text>
            </View>
          )}
        </Animated.View>

        <Animated.Text
          style={{
            fontSize: 10,
            fontWeight: "600",
            letterSpacing: 0.2,
            color: ACTIVE_COLOR,
            marginTop: 1,
            opacity: labelOpacity,
          }}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function FloatingTabBar({
  state,
  descriptors,
  navigation,
}: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();
  const basketCount = useInstantOrderCount();

  const totalHeight = TAB_BAR_HEIGHT + insets.bottom;

  return (
    <View
      style={{
        width: "100%",
        height: totalHeight,
        backgroundColor: "#ffffff",
        flexDirection: "row",
        alignItems: "flex-start",
        paddingTop: 0,
        borderTopWidth: 1,
        borderTopColor: "#ffe0ee",
        ...Platform.select({
          ios: {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -3 },
            shadowOpacity: 0.06,
            shadowRadius: 10,
          },
          android: {
            elevation: 16,
          },
        }),
      }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          typeof options.tabBarLabel === "string"
            ? options.tabBarLabel
            : typeof options.title === "string"
              ? options.title
              : route.name;

        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: "tabLongPress", target: route.key });
        };

        const iconRenderer = (props: { color: string; filled: boolean }) => {
          if (options.tabBarIcon) {
            return options.tabBarIcon({
              ...props,
              size: 24,
              focused: props.filled,
            }) as React.ReactNode;
          }
          return null;
        };

        return (
          <TabItem
            key={route.key}
            isFocused={isFocused}
            label={label}
            icon={iconRenderer}
            onPress={onPress}
            onLongPress={onLongPress}
            tabCount={state.routes.length}
            badge={route.name === "foods" ? basketCount : 0}
          />
        );
      })}
    </View>
  );
}
