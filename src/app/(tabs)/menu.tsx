import { ScrollView, Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AvatarIllustration from '../../components/illustrations/AvatarIllustration';

const MENU_SECTIONS = [
  {
    title: 'Account',
    items: [
      { icon: '👤', label: 'My Profile',       chevron: true },
      { icon: '📦', label: 'My Orders',         chevron: true },
      { icon: '❤️', label: 'Favourites',        chevron: true },
      { icon: '🏠', label: 'Saved Addresses',   chevron: true },
      { icon: '💳', label: 'Payment Methods',   chevron: true },
    ],
  },
  {
    title: 'My Plans',
    items: [
      { icon: '📋', label: 'Active Plan',       chevron: true },
      { icon: '🔄', label: 'Subscription',      chevron: true },
    ],
  },
  {
    title: 'Preferences',
    items: [
      { icon: '🔔', label: 'Notifications',     chevron: true },
      { icon: '🌙', label: 'Dark Mode',         chevron: false, toggle: true },
      { icon: '🌐', label: 'Language',          chevron: true },
    ],
  },
  {
    title: 'Support',
    items: [
      { icon: '💬', label: 'Help & FAQ',        chevron: true },
      { icon: '⭐', label: 'Rate the App',      chevron: true },
      { icon: '📄', label: 'Privacy Policy',    chevron: true },
      { icon: '📝', label: 'Terms of Service',  chevron: true },
    ],
  },
];

export default function MenuScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* ── Profile header ── */}
        <View className="bg-brand-500 px-5 pt-6 pb-10 rounded-b-3xl mb-2">
          <View className="items-center">
            <View className="w-20 h-20 rounded-full bg-brand-300 items-center justify-center mb-3">
              <AvatarIllustration width={64} height={64} />
            </View>
            <Text className="text-xl font-bold text-white">Ashir Ahmed</Text>
            <Text className="text-sm text-brand-100 mt-0.5">ashir@ahaar.app</Text>

            {/* Stats row */}
            <View className="flex-row mt-5 gap-8">
              {[
                { label: 'Orders',    value: '24'  },
                { label: 'Reviews',   value: '12'  },
                { label: 'Saved',     value: '8'   },
              ].map((s) => (
                <View key={s.label} className="items-center">
                  <Text className="text-xl font-bold text-white">{s.value}</Text>
                  <Text className="text-xs text-brand-100 mt-0.5">{s.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Promo banner ── */}
        <TouchableOpacity className="mx-5 mt-4 mb-2 bg-surface-secondary border border-brand-100 rounded-2xl px-4 py-3 flex-row items-center justify-between">
          <View>
            <Text className="text-sm font-bold text-text-primary">Refer & Earn</Text>
            <Text className="text-xs text-text-muted mt-0.5">Get ৳ 200 for every friend you invite</Text>
          </View>
          <Text className="text-2xl">🎁</Text>
        </TouchableOpacity>

        {/* ── Menu sections ── */}
        <View className="mt-4 gap-5">
          {MENU_SECTIONS.map((section) => (
            <View key={section.title} className="px-5">
              <Text className="text-xs font-bold text-text-muted uppercase tracking-widest mb-2">
                {section.title}
              </Text>
              <View className="bg-white rounded-2xl border border-brand-100 overflow-hidden">
                {section.items.map((item, idx) => (
                  <TouchableOpacity
                    key={item.label}
                    className={`flex-row items-center px-4 py-3.5 ${
                      idx !== section.items.length - 1 ? 'border-b border-brand-50' : ''
                    }`}
                  >
                    <View className="w-8 h-8 rounded-xl bg-surface-secondary items-center justify-center mr-3">
                      <Text className="text-base">{item.icon}</Text>
                    </View>
                    <Text className="flex-1 text-sm font-semibold text-text-primary">
                      {item.label}
                    </Text>
                    {item.toggle ? (
                      <View className="w-11 h-6 rounded-full bg-surface-muted items-center justify-center">
                        <Text className="text-xs text-text-muted">○</Text>
                      </View>
                    ) : (
                      <Text className="text-text-muted text-base">›</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* ── Sign out ── */}
        <TouchableOpacity className="mx-5 mt-6 bg-brand-50 border border-brand-100 rounded-2xl py-3.5 items-center">
          <Text className="text-brand-500 font-bold text-sm">Sign Out</Text>
        </TouchableOpacity>

        <Text className="text-center text-xs text-text-muted mt-4">
          Ahaar v1.0.0 · Made with ❤️ in Dhaka
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}