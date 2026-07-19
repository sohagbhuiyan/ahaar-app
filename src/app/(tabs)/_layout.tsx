import { Tabs } from 'expo-router';
import HomeIcon from '../../components/icons/HomeIcon';
import PlansIcon from '../../components/icons/PlansIcon';
import FoodsIcon from '../../components/icons/FoodsIcon';
import MenuIcon from '../../components/icons/MenuIcon';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#ffd6e5',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: '#d70f64',
        tabBarInactiveTintColor: '#9e9e9e',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <HomeIcon color={color} filled={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: 'Plans',
          tabBarIcon: ({ color, focused }) => (
            <PlansIcon color={color} filled={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="foods"
        options={{
          title: 'Foods',
          tabBarIcon: ({ color, focused }) => (
            <FoodsIcon color={color} filled={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color, focused }) => (
            <MenuIcon color={color} filled={focused} />
          ),
        }}
      />
    </Tabs>
  );
}