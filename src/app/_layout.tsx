import { Stack, useNavigationContainerRef } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Toaster } from "sonner-native";

import { AuthGate } from "@/components/shared/AuthGate";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { LoginPrompt } from "@/components/shared/LoginPrompt";
import {
  initSentry,
  navigationIntegration,
  setSentryUser,
  wrapRoot,
} from "@/lib/monitoring/sentry";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { useAuthPromptStore, useAuthStore } from "@/lib/store";
import { colors } from "@/lib/theme";
import "../global.css";

SplashScreen.preventAutoHideAsync();

// Runs once at module load, before any component mounts — Sentry has to be
// initialised before the errors it should catch can happen.
initSentry();

function RootLayout() {
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

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
      .prompt("to pick up where you left off — your session expired");
  }, []);

  return (
    // sonner-native renders through gesture-handler, so this wraps everything.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <QueryProvider onUnauthorized={handleUnauthorized}>
          <AuthGate>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="(auth)" />
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
            </Stack>
          </AuthGate>

          {/* Sign-in happens in a sheet over whatever the customer was doing,
              so a gated tap never costs them their place. */}
          <LoginPrompt />

          {/* Global mutation feedback. Matches the web app's `sonner` usage so
              success/error copy reads the same on both platforms. */}
          <Toaster
            position="top-center"
            offset={60}
            toastOptions={{
              style: { backgroundColor: colors.surface.DEFAULT },
              titleStyle: { color: colors.text.primary },
              descriptionStyle: { color: colors.text.secondary },
            }}
          />
        </QueryProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

// `Sentry.wrap` adds touch/navigation breadcrumbs and native crash context.
// A passthrough when Sentry is disabled (no DSN, or a dev build).
export default wrapRoot(RootLayout);
