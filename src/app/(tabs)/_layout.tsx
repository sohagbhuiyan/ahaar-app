import { Tabs } from "expo-router";
import { navTint } from "../../lib/theme";
import FloatingTabBar from "../../components/FloatingTabBar";
import FoodsIcon from "../../components/icons/FoodsIcon";
import HomeIcon from "../../components/icons/HomeIcon";
import MenuIcon from "../../components/icons/MenuIcon";
import PlansIcon from "../../components/icons/PlansIcon";

export default function TabLayout() {
  return (
    <Tabs
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tabBar={(props) => <FloatingTabBar {...(props as any)} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: navTint.active,
        tabBarInactiveTintColor: navTint.inactive,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <HomeIcon color={color} filled={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: "Plans",
          tabBarIcon: ({ color, focused }) => (
            <PlansIcon color={color} filled={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="foods"
        options={{
          title: "Foods",
          tabBarIcon: ({ color, focused }) => (
            <FoodsIcon color={color} filled={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: "Account",
          tabBarIcon: ({ color, focused }) => (
            <MenuIcon color={color} filled={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
