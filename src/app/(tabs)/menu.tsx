import * as Application from "expo-application";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import MenuIcon from "@/components/icons/MenuIcon";
import BrandDecor from "@/components/illustrations/BrandDecor";
import {
  AhaarLogo,
  LocationPill,
  LocationRequiredCard,
  LocationSheet,
  OfflineBanner,
  PromoCarousel,
  PromoCodeStrip,
  SubscriptionSummaryCard,
} from "@/components/shared";
import { Avatar, Badge, Button, Skeleton } from "@/components/ui";
import { useRefreshOnFocus } from "@/lib/hooks/useRefreshOnFocus";
import {
  FALLBACK_HOME_LAYOUT,
  useCurrentLocation,
  useCurrentSubscription,
  useFilteredOrders,
  useHomeLayout,
  useIsSignedIn,
  usePayments,
  useProfile,
  useSubscriptions,
  type HomeLayout,
} from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";
import { useAuthPromptStore } from "@/lib/store";
import { colors, shadows } from "@/lib/theme";
import { formatMoney } from "@/lib/utils";

/** Everything this tab reads that can change while it sits in the background. */
const ACCOUNT_QUERIES = [
  queryKeys.profile.all(),
  queryKeys.subscription.all(),
  queryKeys.orders.all(),
  queryKeys.payments.all(),
] as const;

/**
 * My Account — the mobile counterpart of the web dashboard.
 *
 * The web app puts Dashboard / My Orders / Subscription / Deliveries /
 * Payments / Profile in a sidebar (`components/user/UserSidebar.tsx`). A phone
 * has no room for a sidebar, so the same set of destinations is presented as a
 * hub: the customer and their delivery location at the top, then their plan,
 * the admin's current offers, one row per section, and the kitchen's videos.
 *
 * Data arrives on its own after sign-in (see `useLogin`) and refreshes when the
 * tab is revisited, so a pull-to-refresh is never *needed* — it is still there.
 */
export default function AccountScreen() {
  const router = useRouter();
  const signedIn = useIsSignedIn();
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);

  const {
    data: user,
    isLoading: profileLoading,
    isFetching: profileFetching,
    refetch: refetchProfile,
  } = useProfile();

  const { data: subscription, refetch: refetchSub } = useCurrentSubscription();
  const { data: subscriptions, refetch: refetchSubscriptions } =
    useSubscriptions();
  const { orders, refetch: refetchOrders } = useFilteredOrders();
  const { data: payments, refetch: refetchPayments } = usePayments();
  const location = useCurrentLocation();
  const { data: cmsLayout, refetch: refetchHome } = useHomeLayout();
  const layout = cmsLayout ?? FALLBACK_HOME_LAYOUT;

  // Tabs stay mounted: coming back after ordering elsewhere shows the order.
  useRefreshOnFocus(ACCOUNT_QUERIES);

  const unpaidOrders = orders.filter(
    (o) => o.payment?.status === "pending",
  ).length;

  const onRefresh = () => {
    refetchProfile();
    refetchSub();
    refetchSubscriptions();
    refetchOrders();
    refetchPayments();
    refetchHome();
  };

  if (!signedIn) return <SignedOutAccount layout={layout} />;

  return (
    <SafeAreaView
      className="flex-1 bg-surface"
      edges={["top", "left", "right"]}
    >
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
        <View className="px-5 pb-4 pt-4">
          <Text className="text-2xl font-bold text-text-primary">
            My Account
          </Text>
          <Text className="mt-1 text-sm text-text-secondary">
            Everything about your orders and your plan
          </Text>
        </View>

        {/* ── Profile ─────────────────────────────────────────────────────── */}
        <View className="px-5">
          {profileLoading && !user ? (
            <Skeleton className="h-52 w-full rounded-3xl" />
          ) : (
            <Animated.View
              entering={FadeInDown.duration(400)}
              className="overflow-hidden rounded-3xl bg-brand-500 p-5"
              style={shadows.brand}
            >
              <BrandDecor />

              <View className="flex-row items-center gap-4">
                <View className="rounded-full border-2 border-white/70">
                  <Avatar name={user?.name} size="lg" />
                </View>
                <View className="flex-1">
                  <Text
                    numberOfLines={1}
                    className="text-lg font-bold text-text-inverse"
                  >
                    {user?.name ?? "—"}
                  </Text>
                  <Text
                    numberOfLines={1}
                    className="mt-0.5 text-sm text-white/85"
                  >
                    {user?.email ?? ""}
                  </Text>
                  {user?.phone ? (
                    <Text className="mt-0.5 text-xs text-white/75">
                      {user.phone}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Verification and account state — the things a customer can
                  act on, rather than a decorative repeat of the name. */}
              {user ? (
                <View className="mt-4 flex-row flex-wrap gap-2">
                  <Badge
                    label={
                      user.email_verified
                        ? "Email verified"
                        : "Email not verified"
                    }
                    variant={user.email_verified ? "success" : "warning"}
                  />
                  {user.phone ? (
                    <Badge
                      label={
                        user.phone_verified
                          ? "Phone verified"
                          : "Phone not verified"
                      }
                      variant={user.phone_verified ? "success" : "warning"}
                    />
                  ) : null}
                  {user.status !== "active" ? (
                    <Badge
                      label={user.status}
                      variant="danger"
                      className="capitalize"
                    />
                  ) : null}
                </View>
              ) : null}

              <View className="mt-4 gap-1.5 rounded-2xl bg-white/15 px-4 py-3">
                <DetailRow
                  label="Dietary preferences"
                  value={detailDiet(user)}
                />
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/profile")}
                className="mt-4 items-center rounded-2xl bg-surface py-3 active:opacity-90"
              >
                <Text className="text-sm font-bold text-brand-500">
                  Edit profile
                </Text>
              </Pressable>
            </Animated.View>
          )}
        </View>

        {/* ── Snapshot ────────────────────────────────────────────────────── */}
        <View className="mt-4 flex-row gap-3 px-5">
          <StatTile
            label="Orders"
            value={String(orders.length)}
            onPress={() => router.push("/orders")}
          />
          <StatTile
            label="Plans"
            value={subscriptions ? String(subscriptions.length) : "—"}
            onPress={() => router.push("/subscriptions")}
          />
          <StatTile
            label="Payments"
            value={payments ? String(payments.length) : "—"}
            onPress={() => router.push("/payments")}
          />
        </View>

        {/* ── Delivery location ───────────────────────────────────────────── */}
        <View className="mt-6 px-5">
          <SectionTitle>Delivery location</SectionTitle>
          {location.source === null && !location.isLoading ? (
            <LocationRequiredCard onPress={() => setLocationSheetOpen(true)} />
          ) : (
            <LocationPill
              location={location}
              onPress={() => setLocationSheetOpen(true)}
            />
          )}
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
                      pathname: "/schedule",
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
                      pathname: "/subscriptions/[id]",
                      params: { id: String(subscription.id) },
                    })
                  }
                />
              </View>
            </SubscriptionSummaryCard>
          </View>
        ) : null}

        <Offers layout={layout} />

        {/* ── Sections ────────────────────────────────────────────────────── */}
        <View className="mt-6 px-5">
          <SectionTitle>Manage</SectionTitle>

          <View className="gap-2">
            <SectionRow
              glyph="🧾"
              label="My Orders"
              hint="One-off, extra and guest orders"
              badge={unpaidOrders > 0 ? `${unpaidOrders} unpaid` : undefined}
              badgeVariant="warning"
              count={orders.length}
              onPress={() => router.push("/orders")}
            />

            <SectionRow
              glyph="📦"
              label="Subscription Orders"
              hint="Every plan you've bought"
              count={subscriptions?.length}
              onPress={() => router.push("/subscriptions")}
            />

            <SectionRow
              glyph="🗓️"
              label="My Plan"
              hint="The complete schedule, every day of your plan"
              count={
                subscription ? subscription.plan?.duration_days : undefined
              }
              onPress={() => router.push("/schedule")}
            />

            <SectionRow
              glyph="🚚"
              label="Deliveries"
              hint="Change a meal — swaps, extras and skipped days"
              onPress={() => router.push("/deliveries")}
            />

            <SectionRow
              glyph="💳"
              label="Payments"
              hint={
                payments && payments.length > 0
                  ? `Last charge ${formatMoney(payments[0].amount)}`
                  : "Charges and refunds"
              }
              count={payments?.length}
              onPress={() => router.push("/payments")}
            />

            <SectionRow
              glyph="👤"
              label="Profile"
              hint="Details, addresses and dietary preferences"
              onPress={() => router.push("/profile")}
            />

            <SectionRow
              glyph="🎬"
              label="Kitchen videos"
              hint="See how your meals are made, and join the conversation"
              onPress={() => router.push("/media")}
            />
          </View>
        </View>

        <BrandFooter />
      </ScrollView>

      <LocationSheet
        open={locationSheetOpen}
        onClose={() => setLocationSheetOpen(false)}
      />
    </SafeAreaView>
  );
}

/** Admin banners and promo codes — nothing at all when there are none. */
function Offers({ layout }: { layout: HomeLayout }) {
  if (layout.promoBanners.length === 0 && layout.promoCodes.length === 0)
    return null;

  return (
    <View className="mt-6">
      <Text className="mb-3 px-5 text-xs font-bold uppercase tracking-wider text-text-muted">
        Offers &amp; updates
      </Text>
      <PromoCarousel banners={layout.promoBanners} />
      <PromoCodeStrip
        codes={layout.promoCodes}
        heading={layout.promoCodesContent?.heading}
        subheading={layout.promoCodesContent?.subheading}
      />
    </View>
  );
}

/** What an account is for — the same destinations the signed-in hub lists. */
const ACCOUNT_BENEFITS = [
  {
    title: "Orders & deliveries",
    detail: "Track every order and swap a meal before the cutoff",
  },
  {
    title: "Your meal plan",
    detail: "The full schedule and your subscription in one place",
  },
  { title: "Payments", detail: "Every charge and refund, with its receipt" },
  {
    title: "Saved details",
    detail: "Addresses and dietary preferences, ready at checkout",
  },
] as const;

/**
 * The Account tab before sign-in.
 *
 * Signing in is the one thing to do here, so it is the primary action — full
 * width, in the brand colour — with registration under it for a first visit
 * and a short list of what the account is for below that. Signing in itself
 * happens in the `LoginPrompt` sheet, as it does everywhere else in the app,
 * and lands on Home once it succeeds.
 */
function SignedOutAccount({ layout }: { layout: HomeLayout }) {
  const router = useRouter();
  const promptLogin = useAuthPromptStore((s) => s.prompt);

  return (
    <SafeAreaView
      className="flex-1 bg-surface"
      edges={["top", "left", "right"]}
    >
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View className="px-5 pb-4 pt-4">
          <Text className="text-2xl font-bold text-text-primary">
            My Account
          </Text>
          <Text className="mt-1 text-sm text-text-secondary">
            Your orders, plan and payments, in one place
          </Text>
        </View>

        <View className="px-5">
          <View
            className="items-center overflow-hidden rounded-3xl bg-brand-500 px-6 pb-6 pt-8"
            style={shadows.brand}
          >
            <BrandDecor />
            <View
              className="h-16 w-16 items-center justify-center rounded-full bg-surface"
              style={shadows.card}
            >
              <MenuIcon color={colors.brand[500]} size={30} />
            </View>

            <Text className="mt-4 text-center text-xl font-bold text-text-inverse">
              Sign in to your account
            </Text>
            <Text className="mt-1.5 text-center text-sm leading-5 text-white/90">
              Pick up your orders, deliveries and subscription right where you
              left them.
            </Text>

            <Button
              label="Sign in"
              size="lg"
              className="mt-6 bg-surface active:bg-brand-50"
              textClassName="text-brand-500"
              onPress={() =>
                // Once signed in, start from Home rather than this tab.
                promptLogin("to see your orders, plan and payments", () =>
                  router.navigate("/"),
                )
              }
            />
            <Button
              label="Create an account"
              variant="outline"
              size="lg"
              className="mt-3 border-white/70 active:bg-white/10"
              textClassName="text-text-inverse"
              onPress={() => router.push("/(auth)/register")}
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
                  <Text className="text-sm font-bold text-text-primary">
                    {benefit.title}
                  </Text>
                  <Text className="mt-0.5 text-xs leading-4 text-text-secondary">
                    {benefit.detail}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <Offers layout={layout} />

        <Text className="mt-8 px-8 text-center text-xs text-text-muted">
          Browsing plans and dishes never needs an account.
        </Text>

        <BrandFooter />
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * The brand's sign-off at the foot of the account hub — where apps put who
 * they are and which build this is, out of the way of everything above.
 */
function BrandFooter() {
  // Null in Expo Go, where there is no native build to name.
  const version = Application.nativeApplicationVersion;

  return (
    <View className="mt-10 items-center px-8">
      <AhaarLogo height={44} />
      <Text className="mt-2 text-xs font-semibold text-text-muted">
        Fresh meals, delivered daily
      </Text>
      {version ? (
        <Text className="mt-0.5 text-[11px] text-text-muted">
          Version {version}
        </Text>
      ) : null}
    </View>
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

function detailDiet(user: ReturnType<typeof useProfile>["data"]): string {
  const tags = user?.dietary_preferences?.tags ?? [];
  const avoid = user?.dietary_preferences?.avoid_allergens ?? [];
  if (tags.length === 0 && avoid.length === 0) return "None set";

  const parts: string[] = [];
  if (tags.length > 0)
    parts.push(tags.map((t) => t.replace(/_/g, " ")).join(", "));
  if (avoid.length > 0) parts.push(`avoiding ${avoid.join(", ")}`);
  return parts.join(" · ");
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
    <View className="flex-row items-start justify-between gap-3">
      <Text className="text-xs text-white/80">{label}</Text>
      <Text
        numberOfLines={1}
        className="flex-1 text-right text-xs font-semibold capitalize text-text-inverse"
      >
        {value}
      </Text>
    </View>
  );
}

function StatTile({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      className="flex-1 items-center rounded-2xl border border-border bg-surface py-3 active:bg-surface-muted"
      style={shadows.card}
    >
      <Text className="text-xl font-bold text-text-primary tabular-nums">
        {value}
      </Text>
      <Text className="mt-0.5 text-[11px] font-semibold text-text-muted">
        {label}
      </Text>
    </Pressable>
  );
}

function SectionRow({
  glyph,
  label,
  hint,
  count,
  badge,
  badgeVariant = "muted",
  onPress,
}: {
  glyph: string;
  label: string;
  hint: string;
  /** Shown as a plain tally. Omitted while the list is still loading. */
  count?: number;
  /** Something that needs attention, e.g. an unpaid order. */
  badge?: string;
  badgeVariant?: "muted" | "warning";
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${hint}`}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 active:bg-surface-muted"
    >
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
        <Text className="text-lg">{glyph}</Text>
      </View>

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
        <Text className="text-sm font-semibold text-text-muted tabular-nums">
          {count}
        </Text>
      ) : null}

      <Text className="text-lg text-text-muted">›</Text>
    </Pressable>
  );
}
