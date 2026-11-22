import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack, useNavigationContainerRef } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { Platform, StatusBar as RNStatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Toaster } from "sonner-native";

import { AnimatedSplash } from "@/components/shared/AnimatedSplash";
import { AuthGate } from "@/components/shared/AuthGate";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { LanguageSync } from "@/components/shared/LanguageSync";
import { LocationSync } from "@/components/shared/LocationSync";
import { LoginPrompt } from "@/components/shared/LoginPrompt";
import { OnboardingGate } from "@/components/shared/OnboardingGate";
import { PushNotifications } from "@/components/shared/PushNotifications";
import {
  initSentry,
  navigationIntegration,
  setSentryUser,
  wrapRoot,
} from "@/lib/monitoring/sentry";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { useAuthPromptStore, useAuthStore } from "@/lib/store";
import {
  syncLayoutDirection,
  useLanguageStore,
} from "@/lib/store/useLanguageStore";
import i18n from "@/lib/i18n";
import { colors } from "@/lib/theme";
import "../global.css";

// The native splash stays up until `AnimatedSplash` has drawn its first frame
// over it, then fades — see that component for the hand-over.
//
// Caught, not awaited: this rejects if the splash has already been dismissed
// (a fast resume, or a Fast Refresh that re-runs this module), and an
// unhandled rejection at module scope is reported as a crash by Sentry for
// something entirely harmless.
SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 300, fade: true });

// Runs once at module load, before any component mounts — Sentry has to be
// initialised before the errors it should catch can happen.
initSentry();

function RootLayout() {
  const navigationRef = useNavigationContainerRef();

  // The saved language is read from AsyncStorage before anything renders, so
  // no screen paints in English first. If it needs the other layout direction
  // than the native side started with (first launch in Arabic, or a restart
  // that didn't complete), flip it and restart — the native splash stays up
  // throughout, so the customer sees one longer splash, not a flicker.
  const languageHydrated = useLanguageStore((s) => s.hydrated);
  const [restarting, setRestarting] = useState(false);
  useEffect(() => {
    if (!languageHydrated) return;
    // `syncLayoutDirection` is the external side effect (it flips the native
    // direction and schedules a reload); the state only holds the splash up
    // until that reload lands.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (syncLayoutDirection(useLanguageStore.getState().locale)) setRestarting(true);
  }, [languageHydrated]);

  // Lets Sentry attribute errors and transactions to a screen.
  useEffect(() => {
    if (navigationRef) {
      navigationIntegration.registerNavigationContainer(navigationRef);
    }
  }, [navigationRef]);

  // Tag events with the signed-in account (id only — no PII).
  useEffect(() => {
    const unsubscribe = useAuthStore.subscribe((state) => {
      setSentryUser(state.user?.id ?? null);
    });
    setSentryUser(useAuthStore.getState().user?.id ?? null);
    return unsubscribe;
  }, []);

  // Runs after the API client rejects a token and the private caches are
  // cleared. It does NOT navigate: the customer may well be on a public
  // screen, and throwing them onto a login route would discard whatever they
  // were reading over a token they never noticed expiring. Prompting in place
  // keeps them where they are and lets them carry on browsing if they'd
  // rather not sign in again yet.
  const handleUnauthorized = useCallback(() => {
    useAuthPromptStore
      .getState()
      .prompt(i18n.t("auth.prompt.sessionExpired"));
  }, []);

  // Ensure Android status bar is translucent with a transparent background
  // so app background/content renders edge-to-edge behind the status bar.
  useEffect(() => {
    if (Platform.OS === 'android') {
      RNStatusBar.setTranslucent(true);
      RNStatusBar.setBackgroundColor('transparent');
    }
  }, []);

  if (!languageHydrated || restarting) return null;

  return (
    // sonner-native renders through gesture-handler, so this wraps everything.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* Transparent status bar with dark icons for the app's light surface.
            Translucent floats above content edge-to-edge on Android and iOS. */}
        <StatusBar style="dark" />
        <ErrorBoundary>
          <QueryProvider onUnauthorized={handleUnauthorized}>
          {/* Hosts every bottom sheet. Inside the query provider so sheet
              content can read server state, and around the stack so a sheet
              draws above whichever screen opened it. */}
          <BottomSheetModalProvider>
            {/* Outside `AuthGate`: the welcome tour is shown before any
                question of who is signed in, and neither gate can see a route
                the other cares about. */}
            <OnboardingGate>
              <AuthGate>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    // One consistent push on both platforms: the iOS slide
                    // (Android's default is a fade-through that reads as a
                    // reload), over the app's own background so no black edge
                    // shows mid-transition.
                    animation: 'ios_from_right',
                    contentStyle: { backgroundColor: colors.surface.DEFAULT },
                  }}
                >
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="(auth)" />
                  {/* Shown once per install, by `OnboardingGate`. Fades rather
                      than sliding in: it arrives under the splash, and a slide
                      from the right would announce a push that never happened. */}
                  <Stack.Screen
                    name="onboarding"
                    options={{
                      animation: "fade",
                      // Its own brand field, so the fade never flashes the
                      // app's white surface behind it.
                      contentStyle: { backgroundColor: colors.brand[500] },
                    }}
                  />
                  <Stack.Screen
                    name="checkout"
                    options={{ presentation: "modal", headerShown: false }}
                  />
                  <Stack.Screen
                    name="order"
                    options={{ presentation: "modal", headerShown: false }}
                  />
                  <Stack.Screen name="subscriptions" />
                  <Stack.Screen name="subscriptions/[id]" />
                  <Stack.Screen name="deliveries" />
                  {/* One meal: status, live car route, what's in it. */}
                  <Stack.Screen name="deliveries/[id]" />
                  <Stack.Screen name="schedule" />
                  <Stack.Screen name="payments" />
                  <Stack.Screen name="profile" />
                  {/* `orders.tsx` + `orders/[id].tsx` rather than an `orders/`
                      folder with an `index`: the flat file keeps the generated
                      route literal a stable `/orders`, which the folder form
                      flip-flops to `/orders/index` on incremental type generation. */}
                  <Stack.Screen name="orders" />
                  <Stack.Screen name="orders/[id]" />
                  <Stack.Screen name="plan/[id]" />
                  <Stack.Screen name="food/[id]" />
                  <Stack.Screen name="packages" />
                  <Stack.Screen name="package/[id]" />
                  {/* One kitchen video and its comments. The list itself is the
                      Media tab, `(tabs)/media`. */}
                  <Stack.Screen name="media/[id]" />
                  {/* Choosing where food goes — full screen, because a map in a
                      sheet fights the sheet's own drag gesture. */}
                  <Stack.Screen
                    name="location-picker"
                    options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
                  />
                </Stack>
              </AuthGate>
            </OnboardingGate>

            {/* Sign-in happens in a sheet over whatever the customer was doing,
                so a gated tap never costs them their place. */}
            <LoginPrompt />

            {/* A location set while signed out is saved to the account as
                soon as there is one. */}
            <LocationSync />

            {/* Refetches content and saves the choice to the account when
                the language changes. */}
            <LanguageSync />

            {/* Delivery pushes: registers this device once signed in, turns
                a push into fresh data + an in-app toast, and opens the
                order or meal a tapped notification is about. */}
            <PushNotifications />
          </BottomSheetModalProvider>

          {/* Global mutation feedback. Matches the web app's `sonner` usage so
              success/error copy reads the same on both platforms. After the
              sheet host, so a toast fired from inside a sheet is not drawn
              under its backdrop. */}
          <Toaster
            position="top-center"
            offset={60}
            toastOptions={{
              style: { backgroundColor: colors.surface.DEFAULT },
              titleStyle: { color: colors.text.primary },
              descriptionStyle: { color: colors.text.secondary },
            }}
          />

          {/* Last, so it covers everything — sheets and toasts included —
              until the app is ready, then fades away. Inside the query
              provider: it waits for the persisted cache to restore. */}
          <AnimatedSplash />
        </QueryProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);
}

// `Sentry.wrap` adds touch/navigation breadcrumbs and native crash context.
// A passthrough when Sentry is disabled (no DSN, or a dev build).
export default wrapRoot(RootLayout);
