import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import MenuIcon from '@/components/icons/MenuIcon';
import { OfflineBanner, SubscriptionSummaryCard } from '@/components/shared';
import { Avatar, Badge, Button, Card, Separator, Skeleton } from '@/components/ui';
import {
  useCurrentSubscription,
  useFilteredOrders,
  useIsSignedIn,
  usePayments,
  useProfile,
  useSubscriptions,
} from '@/lib/query/hooks';
import { useAuthPromptStore } from '@/lib/store';
import { colors, shadows } from '@/lib/theme';
import { formatMoney } from '@/lib/utils';

/**
 * My Account — the mobile counterpart of the web dashboard.
 *
 * The web app puts Dashboard / My Orders / Subscription / Deliveries /
 * Payments / Profile in a sidebar (`components/user/UserSidebar.tsx`). A phone
 * has no room for a sidebar, so the same set of destinations is presented as a
 * hub: a snapshot at the top, then one row per section. Same places, same
 * names, same order — a customer who knows the website knows this screen.
 *
 * This tab used to *be* the day-by-day menu. That content is unchanged, it has
 * simply moved to `/deliveries`, which is where the web keeps it too.
 */
export default function AccountScreen() {
  const router = useRouter();
  const signedIn = useIsSignedIn();

  const {
    data: user,
    isLoading: profileLoading,
    isFetching: profileFetching,
    refetch: refetchProfile,
  } = useProfile();

  const { data: subscription, refetch: refetchSub } = useCurrentSubscription();
  const { data: subscriptions } = useSubscriptions();
  const { orders, refetch: refetchOrders } = useFilteredOrders();
  const { data: payments } = usePayments();

  const unpaidOrders = orders.filter((o) => o.payment?.status === 'pending').length;

  const onRefresh = () => {
    refetchProfile();
    refetchSub();
    refetchOrders();
  };

  if (!signedIn) return <SignedOutAccount />;

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'left', 'right']}>
      <OfflineBanner />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={profileFetching && !profileLoading}
            onRefresh={onRefresh}
          />
        }
      >
        <View className="px-5 pb-4 pt-6">
          <Text className="text-2xl font-bold text-text-primary">My Account</Text>
          <Text className="mt-1 text-sm text-text-secondary">
            Everything about your orders and your plan
          </Text>
        </View>

        {/* ── Profile Details ─────────────────────────────────────────────── */}
        <View className="px-5">
          <SectionTitle>Profile Details</SectionTitle>

          <Card>
            {profileLoading ? (
              <View className="p-5">
                <Skeleton className="h-16 w-full" />
              </View>
            ) : (
              <View className="p-5">
                <View className="flex-row items-center gap-3">
                  <Avatar name={user?.name} size="lg" />

                  <View className="flex-1">
                    <Text numberOfLines={1} className="text-base font-bold text-text-primary">
                      {user?.name ?? '—'}
                    </Text>
                    <Text numberOfLines={1} className="mt-0.5 text-sm text-text-secondary">
                      {user?.email ?? ''}
                    </Text>
                    {user?.phone ? (
                      <Text className="mt-0.5 text-xs text-text-muted">{user.phone}</Text>
                    ) : null}
                  </View>
                </View>

                {/* Verification and account state — the things a customer can
                    act on, rather than a decorative repeat of the name. */}
                {user ? (
                  <View className="mt-3 flex-row flex-wrap gap-2">
                    <Badge
                      label={user.email_verified ? 'Email verified' : 'Email not verified'}
                      variant={user.email_verified ? 'success' : 'warning'}
                    />
                    {user.phone ? (
                      <Badge
                        label={user.phone_verified ? 'Phone verified' : 'Phone not verified'}
                        variant={user.phone_verified ? 'success' : 'warning'}
                      />
                    ) : null}
                    {user.status !== 'active' ? (
                      <Badge label={user.status} variant="danger" className="capitalize" />
                    ) : null}
                  </View>
                ) : null}

                <Separator className="my-4" />

                <View className="gap-1">
                  <DetailRow label="Default address" value={detailAddress(user)} />
                  <DetailRow
                    label="Dietary preferences"
                    value={detailDiet(user)}
                  />
                </View>

                <Button
                  label="Edit profile"
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                  onPress={() => router.push('/profile')}
                />
              </View>
            )}
          </Card>
        </View>

        {/* ── Active plan snapshot ────────────────────────────────────────── */}
        {subscription ? (
          <View className="mt-6 px-5">
            <SectionTitle>Current plan</SectionTitle>
            <SubscriptionSummaryCard subscription={subscription}>
              <View className="flex-row gap-2">
                <Button
                  label="Full schedule"
                  size="sm"
                  fullWidth={false}
                  className="flex-1"
                  onPress={() =>
                    router.push({
                      pathname: '/schedule',
                      params: { subscription: String(subscription.id) },
                    })
                  }
                />
                <Button
                  label="Manage"
                  variant="outline"
                  size="sm"
                  fullWidth={false}
                  className="flex-1"
                  onPress={() =>
                    router.push({
                      pathname: '/subscriptions/[id]',
                      params: { id: String(subscription.id) },
                    })
                  }
                />
              </View>
            </SubscriptionSummaryCard>
          </View>
        ) : null}

        {/* ── Sections ────────────────────────────────────────────────────── */}
        <View className="mt-6 px-5">
          <SectionTitle>Manage</SectionTitle>

          <View className="gap-2">
            <SectionRow
              label="My Orders"
              hint="One-off, extra and guest orders"
              badge={unpaidOrders > 0 ? `${unpaidOrders} unpaid` : undefined}
              badgeVariant="warning"
              count={orders.length}
              onPress={() => router.push('/orders')}
            />

            <SectionRow
              label="Subscription Orders"
              hint="Every plan you've bought"
              count={subscriptions?.length}
              onPress={() => router.push('/subscriptions')}
            />

            <SectionRow
              label="My Plan"
              hint="The complete schedule, every day of your plan"
              count={subscription ? subscription.plan?.duration_days : undefined}
              onPress={() => router.push('/schedule')}
            />

            <SectionRow
              label="Deliveries"
              hint="Change a meal — swaps, extras and skipped days"
              onPress={() => router.push('/deliveries')}
            />

            <SectionRow
              label="Payments"
              hint={
                payments && payments.length > 0
                  ? `Last charge ${formatMoney(payments[0].amount)}`
                  : 'Charges and refunds'
              }
              count={payments?.length}
              onPress={() => router.push('/payments')}
            />

            <SectionRow
              label="Profile"
              hint="Details, addresses and dietary preferences"
              onPress={() => router.push('/profile')}
            />

            <SectionRow
              label="Kitchen videos"
              hint="See how your meals are made, and join the conversation"
              onPress={() => router.push('/media')}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** What an account is for — the same destinations the signed-in hub lists. */
const ACCOUNT_BENEFITS = [
  { title: 'Orders & deliveries', detail: 'Track every order and swap a meal before the cutoff' },
  { title: 'Your meal plan', detail: 'The full schedule and your subscription in one place' },
  { title: 'Payments', detail: 'Every charge and refund, with its receipt' },
  { title: 'Saved details', detail: 'Addresses and dietary preferences, ready at checkout' },
] as const;

/**
 * The Account tab before sign-in.
 *
 * Signing in is the one thing to do here, so it is the primary action — full
 * width, in the brand colour — with registration under it for a first visit
 * and a short list of what the account is for below that. Signing in itself
 * happens in the `LoginPrompt` sheet, as it does everywhere else in the app.
 */
function SignedOutAccount() {
  const router = useRouter();
  const promptLogin = useAuthPromptStore((s) => s.prompt);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'left', 'right']}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View className="px-5 pb-4 pt-6">
          <Text className="text-2xl font-bold text-text-primary">My Account</Text>
          <Text className="mt-1 text-sm text-text-secondary">
            Your orders, plan and payments, in one place
          </Text>
        </View>

        <View className="px-5">
          <View className="items-center rounded-3xl border border-brand-100 bg-brand-50 px-6 pb-6 pt-8">
            <View
              className="h-16 w-16 items-center justify-center rounded-full bg-surface"
              style={shadows.card}
            >
              <MenuIcon color={colors.brand[500]} size={30} />
            </View>

            <Text className="mt-4 text-center text-xl font-bold text-text-primary">
              Sign in to your account
            </Text>
            <Text className="mt-1.5 text-center text-sm leading-5 text-text-secondary">
              Pick up your orders, deliveries and subscription right where you left them.
            </Text>

            <Button
              label="Sign in"
              size="lg"
              className="mt-6"
              onPress={() => promptLogin('to see your orders, plan and payments')}
            />
            <Button
              label="Create an account"
              variant="outline"
              size="lg"
              className="mt-3 bg-surface"
              onPress={() => router.push('/(auth)/register')}
            />
          </View>
        </View>

        <View className="mt-8 px-5">
          <SectionTitle>With an account</SectionTitle>

          <View className="gap-4">
            {ACCOUNT_BENEFITS.map((benefit) => (
              <View key={benefit.title} className="flex-row items-start gap-3">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-50">
                  <CheckIcon color={colors.brand[500]} />
                </View>
                <View className="flex-1 pt-0.5">
                  <Text className="text-sm font-bold text-text-primary">{benefit.title}</Text>
                  <Text className="mt-0.5 text-xs leading-4 text-text-secondary">
                    {benefit.detail}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <Text className="mt-8 px-8 text-center text-xs text-text-muted">
          Browsing plans and dishes never needs an account.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6 9 17l-5-5"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** "Home · Amsterdam", or an honest blank. */
function detailAddress(user: ReturnType<typeof useProfile>['data']): string {
  const address = user?.default_address;
  if (!address) return 'Not set';
  return [address.label, address.city].filter(Boolean).join(' · ') || address.line1;
}

function detailDiet(user: ReturnType<typeof useProfile>['data']): string {
  const tags = user?.dietary_preferences?.tags ?? [];
  const avoid = user?.dietary_preferences?.avoid_allergens ?? [];
  if (tags.length === 0 && avoid.length === 0) return 'None set';

  const parts: string[] = [];
  if (tags.length > 0) parts.push(tags.map((t) => t.replace(/_/g, ' ')).join(', '));
  if (avoid.length > 0) parts.push(`avoiding ${avoid.join(', ')}`);
  return parts.join(' · ');
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-text-muted">
      {children}
    </Text>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-3 py-0.5">
      <Text className="text-xs text-text-secondary">{label}</Text>
      <Text
        numberOfLines={1}
        className="flex-1 text-right text-xs font-semibold capitalize text-text-primary"
      >
        {value}
      </Text>
    </View>
  );
}

function SectionRow({
  label,
  hint,
  count,
  badge,
  badgeVariant = 'muted',
  onPress,
}: {
  label: string;
  hint: string;
  /** Shown as a plain tally. Omitted while the list is still loading. */
  count?: number;
  /** Something that needs attention, e.g. an unpaid order. */
  badge?: string;
  badgeVariant?: 'muted' | 'warning';
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${hint}`}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3.5 active:opacity-80"
    >
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-bold text-text-primary">{label}</Text>
          {badge ? <Badge label={badge} variant={badgeVariant} /> : null}
        </View>
        <Text numberOfLines={1} className="mt-0.5 text-xs text-text-muted">
          {hint}
        </Text>
      </View>

      {count !== undefined ? (
        <Text className="text-sm font-semibold text-text-muted tabular-nums">{count}</Text>
      ) : null}

      <Text className="text-lg text-text-muted">›</Text>
    </Pressable>
  );
}
