import FoodCardIllustration from '@/components/illustrations/FoodCardIllustration';
import { useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


const FILTERS = ['All', 'Burgers', 'Pizza', 'Asian', 'Salads', 'Desserts', 'Drinks'];

const FOODS = [
  { id: '1',  name: 'Classic Cheeseburger',    cat: 'Burgers', price: '৳ 280', rating: '4.7', time: '20 min', badge: 'Best Seller' },
  { id: '2',  name: 'Pepperoni Pizza',          cat: 'Pizza',   price: '৳ 490', rating: '4.5', time: '35 min', badge: null },
  { id: '3',  name: 'Spicy Chicken Ramen',      cat: 'Asian',   price: '৳ 310', rating: '4.9', time: '25 min', badge: 'Trending' },
  { id: '4',  name: 'Caesar Salad',             cat: 'Salads',  price: '৳ 220', rating: '4.6', time: '15 min', badge: null },
  { id: '5',  name: 'Double Smash Burger',      cat: 'Burgers', price: '৳ 360', rating: '4.8', time: '22 min', badge: 'New' },
  { id: '6',  name: 'Chocolate Lava Cake',      cat: 'Desserts', price: '৳ 180', rating: '4.9', time: '10 min', badge: 'Fan Fave' },
  { id: '7',  name: 'Pad Thai',                 cat: 'Asian',   price: '৳ 295', rating: '4.7', time: '28 min', badge: null },
  { id: '8',  name: 'Four Cheese Pizza',        cat: 'Pizza',   price: '৳ 520', rating: '4.6', time: '35 min', badge: null },
  { id: '9',  name: 'Mango Lassi',              cat: 'Drinks',  price: '৳ 120', rating: '4.8', time: '5 min',  badge: 'Refreshing' },
  { id: '10', name: 'Nutella Crepe',            cat: 'Desserts', price: '৳ 200', rating: '4.7', time: '12 min', badge: null },
];

export default function FoodsScreen() {
  const [active, setActive] = useState('All');

  const filtered = active === 'All' ? FOODS : FOODS.filter((f) => f.cat === active);

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* ── Header ── */}
      <View className="px-5 pt-6 pb-3 border-b border-brand-100">
        <Text className="text-2xl font-bold text-text-primary">Explore Foods</Text>
        <Text className="text-sm text-text-secondary mt-1">
          {filtered.length} items available
        </Text>
      </View>

      {/* ── Filter tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12, gap: 8 }}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setActive(f)}
            className={`px-4 py-2 rounded-full border ${
              active === f
                ? 'bg-brand-500 border-brand-500'
                : 'bg-white border-brand-100'
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                active === f ? 'text-white' : 'text-text-secondary'
              }`}
            >
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Food grid ── */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
        columnWrapperStyle={{ gap: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            className="flex-1 bg-white rounded-2xl border border-brand-100 overflow-hidden"
            style={{ elevation: 2, shadowColor: '#d70f64', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}
          >
            {/* Image area */}
            <View className="w-full h-28 bg-surface-secondary items-center justify-center">
              <FoodCardIllustration width={80} height={80} />
              {item.badge && (
                <View className="absolute top-2 left-2 bg-brand-500 rounded-lg px-2 py-0.5">
                  <Text className="text-white text-xs font-bold">{item.badge}</Text>
                </View>
              )}
            </View>

            {/* Info */}
            <View className="p-3">
              <Text className="text-sm font-bold text-text-primary" numberOfLines={1}>
                {item.name}
              </Text>
              <View className="flex-row items-center justify-between mt-1">
                <Text className="text-xs text-text-muted">⭐ {item.rating}</Text>
                <Text className="text-xs text-text-muted">🕐 {item.time}</Text>
              </View>
              <View className="flex-row items-center justify-between mt-2">
                <Text className="text-sm font-bold text-brand-500">{item.price}</Text>
                <TouchableOpacity className="w-7 h-7 rounded-full bg-brand-500 items-center justify-center">
                  <Text className="text-white text-base leading-none font-bold">+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}