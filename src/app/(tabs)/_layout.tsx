import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { navTint } from "../../lib/theme";
import FloatingTabBar from "../../components/FloatingTabBar";
import FoodsIcon from "../../components/icons/FoodsIcon";
import HomeIcon from "../../components/icons/HomeIcon";
import MediaIcon from "../../components/icons/MediaIcon";
import MenuIcon from "../../components/icons/MenuIcon";
import PlansIcon from "../../components/icons/PlansIcon";

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
       
      tabBar={(props) => <FloatingTabBar {...(props as any)} />}
      screenOptions={{
        headerShown: false,
        // Screens glide a little toward the tab that was tapped instead of
        // cutting — the direction says where you went.
        animation: "shift",
        tabBarActiveTintColor: navTint.active,
        tabBarInactiveTintColor: navTint.inactive,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          tabBarIcon: ({ color, focused }) => (
            <HomeIcon color={color} filled={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: t("tabs.plans"),
          tabBarIcon: ({ color, focused }) => (
            <PlansIcon color={color} filled={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="foods"
        options={{
          title: t("tabs.foods"),
          tabBarIcon: ({ color, focused }) => (
            <FoodsIcon color={color} filled={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="media"
        options={{
          title: t("tabs.media"),
          tabBarIcon: ({ color, focused }) => (
            <MediaIcon color={color} filled={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: t("tabs.menu"),
          tabBarIcon: ({ color, focused }) => (
            <MenuIcon color={color} filled={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
