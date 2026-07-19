import { ScrollView, Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PlanIllustration from '../../components/illustrations/PlanIllustration';

const PLANS = [
  {
    id: '1',
    name: 'Basic',
    subtitle: 'Light & Healthy',
    price: '৳ 2,499',
    period: '/week',
    meals: 3,
    perDay: 1,
    features: ['1 meal/day', 'Chef-curated menu', 'Free delivery', 'Cancel anytime'],
    popular: false,
    color: 'bg-surface-secondary',
    textColor: 'text-text-primary',
    badgeColor: 'bg-brand-100 text-brand-500',
  },
  {
    id: '2',
    name: 'Standard',
    subtitle: 'Most Popular 🔥',
    price: '৳ 4,199',
    period: '/week',
    meals: 14,
    perDay: 2,
    features: ['2 meals/day', 'Customisable menu', 'Free delivery', 'Nutrition tracking', 'Cancel anytime'],
    popular: true,
    color: 'bg-brand-500',
    textColor: 'text-white',
    badgeColor: 'bg-white text-brand-500',
  },
  {
    id: '3',
    name: 'Premium',
    subtitle: 'Full Day Coverage',
    price: '৳ 5,999',
    period: '/week',
    meals: 21,
    perDay: 3,
    features: ['3 meals/day', 'Personal dietitian', 'Priority delivery', 'Nutrition tracking', 'Snacks included', 'Cancel anytime'],
    popular: false,
    color: 'bg-surface-secondary',
    textColor: 'text-text-primary',
    badgeColor: 'bg-brand-100 text-brand-500',
  },
];

export default function PlansScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* ── Header ── */}
        <View className="px-5 pt-6 pb-2">
          <Text className="text-2xl font-bold text-text-primary">Meal Plans</Text>
          <Text className="text-sm text-text-secondary mt-1">
            Subscribe and save — fresh meals every day
          </Text>
        </View>

        {/* ── Illustration ── */}
        <View className="items-center my-4">
          <PlanIllustration width={200} height={120} />
        </View>

        {/* ── Toggle weekly/monthly (decorative) ── */}
        <View className="mx-5 flex-row bg-surface-muted rounded-2xl p-1 mb-6">
          <TouchableOpacity className="flex-1 bg-white rounded-xl py-2 items-center" style={{ elevation: 1 }}>
            <Text className="text-sm font-bold text-brand-500">Weekly</Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-1 py-2 items-center">
            <Text className="text-sm font-semibold text-text-muted">Monthly</Text>
          </TouchableOpacity>
        </View>

        {/* ── Plan cards ── */}
        <View className="px-5 gap-4">
          {PLANS.map((plan) => (
            <View
              key={plan.id}
              className={`${plan.color} rounded-3xl overflow-hidden`}
              style={
                plan.popular
                  ? { elevation: 6, shadowColor: '#d70f64', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } }
                  : { borderWidth: 1, borderColor: '#ffd6e5' }
              }
            >
              <View className="p-5">
                {/* Title row */}
                <View className="flex-row items-start justify-between mb-3">
                  <View>
                    <Text className={`text-xl font-bold ${plan.textColor}`}>{plan.name}</Text>
                    <Text className={`text-xs font-semibold mt-0.5 ${plan.popular ? 'text-brand-100' : 'text-text-muted'}`}>
                      {plan.subtitle}
                    </Text>
                  </View>
                  <View className={`${plan.badgeColor} rounded-xl px-3 py-1`}>
                    <Text className="text-xs font-bold">
                      {plan.perDay}x / day
                    </Text>
                  </View>
                </View>

                {/* Price */}
                <View className="flex-row items-end mb-4">
                  <Text className={`text-3xl font-bold ${plan.textColor}`}>{plan.price}</Text>
                  <Text className={`text-sm mb-1 ml-1 ${plan.popular ? 'text-brand-200' : 'text-text-muted'}`}>
                    {plan.period}
                  </Text>
                </View>

                {/* Features */}
                <View className="gap-2 mb-5">
                  {plan.features.map((f, i) => (
                    <View key={i} className="flex-row items-center gap-2">
                      <Text className={plan.popular ? 'text-brand-200' : 'text-brand-500'}>✓</Text>
                      <Text className={`text-sm ${plan.popular ? 'text-brand-100' : 'text-text-secondary'}`}>{f}</Text>
                    </View>
                  ))}
                </View>

                {/* CTA */}
                <TouchableOpacity
                  className={`rounded-2xl py-3 items-center ${plan.popular ? 'bg-white' : 'bg-brand-500'}`}
                >
                  <Text className={`font-bold text-sm ${plan.popular ? 'text-brand-500' : 'text-white'}`}>
                    Choose {plan.name}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}