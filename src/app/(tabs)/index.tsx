import { ScrollView, Text, View, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BannerIllustration from '../../components/illustrations/BannerIllustration';
import FoodCardIllustration from '../../components/illustrations/FoodCardIllustration';

const CATEGORIES = [
  { id: '1', label: 'Burger',  emoji: '🍔' },
  { id: '2', label: 'Pizza',   emoji: '🍕' },
  { id: '3', label: 'Sushi',   emoji: '🍱' },
  { id: '4', label: 'Salad',   emoji: '🥗' },
  { id: '5', label: 'Dessert', emoji: '🍰' },
];

const FEATURED = [
  { id: '1', name: 'Smoky BBQ Burger',  restaurant: 'Grill House',    price: '৳ 320',  time: '25 min', rating: '4.8' },
  { id: '2', name: 'Margherita Pizza',  restaurant: 'Pizzeria Roma',  price: '৳ 450',  time: '35 min', rating: '4.6' },
  { id: '3', name: 'Spicy Ramen Bowl',  restaurant: 'Noodle Station', price: '৳ 280',  time: '20 min', rating: '4.9' },
];

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* ── Header ── */}
        <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
          <View>
            <Text className="text-xs font-semibold text-brand-500 uppercase tracking-widest">
              Deliver to
            </Text>
            <Text className="text-lg font-bold text-text-primary">
              Dhaka, Bangladesh 📍
            </Text>
          </View>
          <View className="w-10 h-10 rounded-full bg-brand-100 items-center justify-center">
            <Text className="text-lg">👤</Text>
          </View>
        </View>

        {/* ── Search ── */}
        <View className="mx-5 mt-3 mb-5 flex-row items-center bg-surface-muted rounded-2xl px-4 py-3">
          <Text className="text-base mr-2">🔍</Text>
          <TextInput
            placeholder="Search food or restaurant…"
            placeholderTextColor="#9e9e9e"
            className="flex-1 text-sm text-text-primary"
          />
        </View>

        {/* ── Hero Banner ── */}
        <View className="mx-5 rounded-3xl bg-brand-500 overflow-hidden mb-6">
          <View className="px-5 py-5">
            <Text className="text-xs font-semibold text-brand-200 uppercase tracking-widest mb-1">
              Today's Special
            </Text>
            <Text className="text-2xl font-bold text-white leading-tight mb-1">
              Get 30% Off{'\n'}Your First Order
            </Text>
            <Text className="text-sm text-brand-100 mb-4">
              Use code <Text className="font-bold text-white">AHAAR30</Text>
            </Text>
            <TouchableOpacity className="self-start bg-white rounded-xl px-4 py-2">
              <Text className="text-brand-500 font-bold text-sm">Order Now</Text>
            </TouchableOpacity>
          </View>
          <View className="absolute right-0 bottom-0 opacity-30">
            <BannerIllustration width={130} height={100} />
          </View>
        </View>

        {/* ── Categories ── */}
        <Text className="px-5 text-base font-bold text-text-primary mb-3">
          What are you craving?
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
          className="mb-6"
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              className="items-center bg-surface-secondary border border-brand-100 rounded-2xl px-4 py-3"
            >
              <Text className="text-2xl mb-1">{cat.emoji}</Text>
              <Text className="text-xs font-semibold text-text-primary">{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Featured ── */}
        <View className="flex-row items-center justify-between px-5 mb-3">
          <Text className="text-base font-bold text-text-primary">Featured</Text>
          <TouchableOpacity>
            <Text className="text-sm font-semibold text-brand-500">See all</Text>
          </TouchableOpacity>
        </View>

        <View className="px-5 gap-4">
          {FEATURED.map((item) => (
            <TouchableOpacity
              key={item.id}
              className="bg-white rounded-2xl border border-brand-100 overflow-hidden flex-row"
              style={{ elevation: 2, shadowColor: '#d70f64', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}
            >
              {/* Illustration placeholder */}
              <View className="w-24 h-24 bg-surface-secondary items-center justify-center">
                <FoodCardIllustration width={72} height={72} />
              </View>
              <View className="flex-1 px-4 py-3 justify-between">
                <View>
                  <Text className="text-sm font-bold text-text-primary" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text className="text-xs text-text-muted mt-0.5">{item.restaurant}</Text>
                </View>
                <View className="flex-row items-center justify-between mt-2">
                  <Text className="text-sm font-bold text-brand-500">{item.price}</Text>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-xs text-text-secondary">⭐ {item.rating}</Text>
                    <Text className="text-xs text-text-muted">🕐 {item.time}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}