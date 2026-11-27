import * as Application from "expo-application";
import { useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { LanguagePicker } from "@/components/shared/LanguagePicker";
import { Avatar, Badge, Button, Skeleton } from "@/components/ui";
import { useRefreshOnFocus } from "@/lib/hooks/useRefreshOnFocus";
import {
  FALLBACK_HOME_LAYOUT,
  useCurrentLocation,
  useCurrentSubscription,
  useFilteredOrders,
  useHomeLayout,
  useIsSignedIn,
  useLogout,
  usePayments,
  useProfile,
  useSubscriptions,
  type HomeLayout,
} from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";
import { useAuthPromptStore } from "@/lib/store";
import { colors, shadows } from "@/lib/theme";
import {
  allergenLabelKey,
  dietTagLabelKey,
  humanise,
} from "@/lib/constants/diet";
import { formatMoney } from "@/lib/utils";

/** Phone numbers and emails read left to right inside Arabic text. */
const ltr = (value: string) => `\u2066${value}\u2069`;

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
  const { t } = useTranslation();
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
  const { data: cmsLayout, refetch: refetchHome } = useHomeLayout();
  const layout = cmsLayout ?? FALLBACK_HOME_LAYOUT;
  // Signing out leaves the customer here, on the signed-out version of the tab.
  const logout = useLogout();

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
            {t("profile.accountTab.title")}
          </Text>
          <Text className="mt-1 text-sm text-text-secondary">
            {t("profile.accountTab.subtitle")}
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
                    {user?.email ? ltr(user.email) : ""}
                  </Text>
                  {user?.phone ? (
                    <Text className="mt-0.5 text-xs text-white/75">
                      {ltr(user.phone)}
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
                        ? t("profile.badges.emailVerified")
                        : t("profile.badges.emailNotVerified")
                    }
                    variant={user.email_verified ? "success" : "warning"}
                  />
                  {user.phone ? (
                    <Badge
                      label={
                        user.phone_verified
                          ? t("profile.badges.phoneVerified")
                          : t("profile.badges.phoneNotVerified")
                      }
                      variant={user.phone_verified ? "success" : "warning"}
                    />
                  ) : null}
                  {user.status !== "active" ? (
                    <Badge
                      label={t(`common.status.${user.status}`, {
                        defaultValue: humanise(user.status),
                      })}
                      variant="danger"
                    />
                  ) : null}
                </View>
              ) : null}

              <View className="mt-4 gap-1.5 rounded-2xl bg-white/15 px-4 py-3">
                <DetailRow
                  label={t("profile.dietaryPreferences")}
                  value={detailDiet(user, t)}
                />
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/profile")}
                className="mt-4 items-center rounded-2xl bg-surface py-3 active:opacity-90"
              >
                <Text className="text-sm font-bold text-brand-500">
                  {t("profile.accountTab.editProfile")}
                </Text>
              </Pressable>
            </Animated.View>
          )}
        </View>

        {/* ── Snapshot ────────────────────────────────────────────────────── */}
        <View className="mt-4 flex-row gap-3 px-5">
          <StatTile
            label={t("profile.accountTab.stats.orders")}
            value={String(orders.length)}
            onPress={() => router.push("/orders")}
          />
          <StatTile
            label={t("profile.accountTab.stats.plans")}
            value={subscriptions ? String(subscriptions.length) : "—"}
            onPress={() => router.push("/subscriptions")}
          />
          <StatTile
            label={t("profile.accountTab.stats.payments")}
            value={payments ? String(payments.length) : "—"}
            onPress={() => router.push("/payments")}
          />
        </View>

        <DeliveryLocationSection onPress={() => setLocationSheetOpen(true)} />

        {/* ── Active plan snapshot ────────────────────────────────────────── */}
        {subscription ? (
          <View className="mt-6 px-5">
            <SectionTitle>{t("profile.accountTab.currentPlan")}</SectionTitle>
            <SubscriptionSummaryCard subscription={subscription}>
              <View className="flex-row gap-2">
                <Button
                  label={t("profile.accountTab.fullSchedule")}
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
                  label={t("profile.accountTab.manage")}
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
          <SectionTitle>{t("profile.accountTab.manageSection")}</SectionTitle>

          <View className="gap-2">
            <SectionRow
              glyph="🧾"
              label={t("profile.accountTab.rows.orders")}
              hint={t("profile.accountTab.rows.ordersHint")}
              badge={
                unpaidOrders > 0
                  ? t("profile.accountTab.rows.unpaid", { count: unpaidOrders })
                  : undefined
              }
              badgeVariant="warning"
              count={orders.length}
              onPress={() => router.push("/orders")}
            />

            <SectionRow
              glyph="📦"
              label={t("profile.accountTab.rows.subscriptions")}
              hint={t("profile.accountTab.rows.subscriptionsHint")}
              count={subscriptions?.length}
              onPress={() => router.push("/subscriptions")}
            />

            <SectionRow
              glyph="🗓️"
              label={t("profile.accountTab.rows.plan")}
              hint={t("profile.accountTab.rows.planHint")}
              count={
                subscription ? subscription.plan?.duration_days : undefined
              }
              onPress={() => router.push("/schedule")}
            />

            <SectionRow
              glyph="🚚"
              label={t("profile.accountTab.rows.deliveries")}
              hint={t("profile.accountTab.rows.deliveriesHint")}
              onPress={() => router.push("/deliveries")}
            />

            <SectionRow
              glyph="💳"
              label={t("profile.accountTab.rows.payments")}
              hint={
                payments && payments.length > 0
                  ? t("profile.accountTab.rows.paymentsLastCharge", {
                      amount: ltr(formatMoney(payments[0].amount)),
                    })
                  : t("profile.accountTab.rows.paymentsHint")
              }
              count={payments?.length}
              onPress={() => router.push("/payments")}
            />

            <SectionRow
              glyph="👤"
              label={t("profile.accountTab.rows.profile")}
              hint={t("profile.accountTab.rows.profileHint")}
              onPress={() => router.push("/profile")}
            />

            <SectionRow
              glyph="🎬"
              label={t("profile.accountTab.rows.videos")}
              hint={t("profile.accountTab.rows.videosHint")}
              onPress={() => router.push("/media")}
            />

            {/* Direct sign-out — the same action as the button at the foot of
                Edit profile, which stays. Signed-in only: this whole list is. */}
            <SectionRow
              glyph="🚪"
              label={t("profile.logout")}
              hint={t("profile.accountTab.rows.logoutHint")}
              testID="account-logout"
              tone="danger"
              disabled={logout.isPending}
              onPress={() => logout.mutate()}
            />
          </View>
        </View>

        <LanguageSection />

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
  const { t } = useTranslation();
  if (layout.promoBanners.length === 0 && layout.promoCodes.length === 0)
    return null;

  return (
    <View className="mt-6">
      <Text className="mb-3 px-5 text-xs font-bold uppercase tracking-wider text-text-muted">
        {t("profile.accountTab.offers")}
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
/** Translation keys under `profile.accountTab.benefits`, resolved at render. */
const ACCOUNT_BENEFITS = ["orders", "plan", "payments", "details"] as const;

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
  const { t } = useTranslation();
  const promptLogin = useAuthPromptStore((s) => s.prompt);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);

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
            {t("profile.accountTab.title")}
          </Text>
          <Text className="mt-1 text-sm text-text-secondary">
            {t("profile.accountTab.signedOutSubtitle")}
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
              {t("profile.accountTab.signInTitle")}
            </Text>
            <Text className="mt-1.5 text-center text-sm leading-5 text-white/90">
              {t("profile.accountTab.signInBody")}
            </Text>

            <Button
              label={t("common.actions.signIn")}
              size="lg"
              className="mt-6 bg-surface active:bg-brand-50"
              textClassName="text-brand-500"
              onPress={() =>
                // Once signed in, start from Home rather than this tab.
                promptLogin(t("profile.accountTab.signInReason"), () =>
                  router.navigate("/"),
                )
              }
            />
            <Button
              label={t("profile.accountTab.createAccount")}
              variant="outline"
              size="lg"
              className="mt-3 border-white/70 active:bg-white/10"
              textClassName="text-text-inverse"
              onPress={() => router.push("/(auth)/register")}
            />
          </View>
        </View>

        <View className="mt-8 px-5">
          <SectionTitle>{t("profile.accountTab.withAccount")}</SectionTitle>

          <View className="gap-4">
            {ACCOUNT_BENEFITS.map((benefit) => (
              <View key={benefit} className="flex-row items-start gap-3">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-50">
                  <CheckIcon color={colors.brand[500]} />
                </View>
                <View className="flex-1 pt-0.5">
                  <Text className="text-sm font-bold text-text-primary">
                    {t(`profile.accountTab.benefits.${benefit}`)}
                  </Text>
                  <Text className="mt-0.5 text-xs leading-4 text-text-secondary">
                    {t(`profile.accountTab.benefits.${benefit}Detail`)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Where the food goes can be set before signing in, too. */}
        <DeliveryLocationSection onPress={() => setLocationSheetOpen(true)} />

        <Offers layout={layout} />

        <LanguageSection />

        <Text className="mt-8 px-8 text-center text-xs text-text-muted">
          {t("profile.accountTab.browsingFree")}
        </Text>

        <BrandFooter />
      </ScrollView>

      <LocationSheet
        open={locationSheetOpen}
        onClose={() => setLocationSheetOpen(false)}
      />
    </SafeAreaView>
  );
}

/**
 * "Set delivery" — the home of the delivery location (it used to sit at the
 * top of Home). The pill when one is set, the full-width prompt when not.
 */
function DeliveryLocationSection({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const location = useCurrentLocation();
  return (
    <View className="mt-6 px-5" testID="account-delivery-location">
      <SectionTitle>{t("profile.accountTab.deliveryLocation")}</SectionTitle>
      {location.source === null && !location.isLoading ? (
        <LocationRequiredCard onPress={onPress} />
      ) : (
        <LocationPill location={location} onPress={onPress} />
      )}
    </View>
  );
}

/**
 * The brand's sign-off at the foot of the account hub — where apps put who
 * they are and which build this is, out of the way of everything above.
 */
function BrandFooter() {
  const { t } = useTranslation();
  // Null in Expo Go, where there is no native build to name.
  const version = Application.nativeApplicationVersion;

  return (
    <View className="mt-10 items-center px-8">
      <AhaarLogo height={44} />
      <Text className="mt-2 text-xs font-semibold text-text-muted">
        {t("profile.accountTab.tagline")}
      </Text>
      {version ? (
        <Text className="mt-0.5 text-[11px] text-text-muted">
          {t("profile.accountTab.version", { version })}
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

/** Display language selector — reachable before signing in, too. */
function LanguageSection() {
  const { t } = useTranslation();
  return (
    <View className="mt-6 px-5">
      <SectionTitle>{t("profile.accountTab.language")}</SectionTitle>
      <LanguagePicker />
    </View>
  );
}

function detailDiet(
  user: ReturnType<typeof useProfile>["data"],
  t: TFunction,
): string {
  const tags = user?.dietary_preferences?.tags ?? [];
  const avoid = user?.dietary_preferences?.avoid_allergens ?? [];
  if (tags.length === 0 && avoid.length === 0)
    return t("profile.diet.noneSet");

  const sep = t("profile.diet.listSeparator");
  const parts: string[] = [];
  if (tags.length > 0)
    parts.push(
      tags
        .map((tag) => t(dietTagLabelKey(tag), { defaultValue: humanise(tag) }))
        .join(sep),
    );
  if (avoid.length > 0)
    parts.push(
      t("profile.diet.avoiding", {
        list: avoid
          .map((a) =>
            t(allergenLabelKey(a), { defaultValue: humanise(a) }).toLowerCase(),
          )
          .join(sep),
      }),
    );
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
        className="flex-1 text-right text-xs font-semibold text-text-inverse"
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
  tone = "default",
  disabled,
  testID,
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
  /** `danger` for a destructive row such as Log out. */
  tone?: "default" | "danger";
  disabled?: boolean;
  testID?: string;
  onPress: () => void;
}) {
  const danger = tone === "danger";
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${hint}`}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`flex-row items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 active:bg-surface-muted${disabled ? " opacity-60" : ""}`}
    >
      <View
        className={`h-10 w-10 items-center justify-center rounded-xl ${danger ? "bg-danger-soft" : "bg-brand-50"}`}
      >
        <Text className="text-lg">{glyph}</Text>
      </View>

      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text
            className={`text-sm font-bold ${danger ? "text-danger" : "text-text-primary"}`}
          >
            {label}
          </Text>
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
