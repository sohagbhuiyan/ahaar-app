/**
 * Native Google Sign-In.
 *
 * The app never decides who the user is. It asks Google for an ID token issued
 * to the *Web* client (`webClientId`), and the API verifies that token and signs
 * the customer in (`POST /auth/google/token`).
 *
 *   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID      required: the audience the API checks
 *   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID      iOS: also feeds the URL scheme in app.config.ts
 *   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID  not read here: Android matches its OAuth
 *                                         client by package name + signing SHA-1,
 *                                         registered in Google Cloud
 *
 * Needs a build that contains the native module (a development build made
 * after the package was added, or a release build). Expo Go, older builds and
 * the web build don't have it, so there the Google buttons are hidden and the
 * rest of the app runs normally.
 */
import { Platform, TurboModuleRegistry } from 'react-native';

import type { ApiError } from '../api/types/common';

type GoogleSignInLib = typeof import('@react-native-google-signin/google-signin');

/**
 * Whether this binary contains the native module. Checked with the
 * non-throwing `TurboModuleRegistry.get` (it also covers the old architecture).
 * Importing the library at the top of the file instead throws
 * "'RNGoogleSignin' could not be found" as soon as the app loads, which takes
 * the whole app down in any binary built without it.
 */
const hasNativeModule = Platform.OS !== 'web' && TurboModuleRegistry.get('RNGoogleSignin') != null;

let lib: GoogleSignInLib | null = null;

/** Load the library on first use, and only when its native half exists. */
function googleSignIn(): GoogleSignInLib {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  lib ??= require('@react-native-google-signin/google-signin') as GoogleSignInLib;
  return lib;
}

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

/** Google sign-in can run in this build. */
export const googleSignInAvailable =
  hasNativeModule &&
  Boolean(WEB_CLIENT_ID) &&
  (Platform.OS !== 'ios' || Boolean(IOS_CLIENT_ID));

let configured = false;

function configure() {
  if (configured) return;
  googleSignIn().GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
    // An ID token is all the API needs; no server auth code, no extra scopes.
    offlineAccess: false,
  });
  configured = true;
}

/**
 * A Google step that failed on the device, for a reason worth telling the
 * customer. Shaped as an `ApiError` so `InlineError` and every other place
 * that shows API errors displays it as it is.
 */
export class GoogleSignInError extends Error implements ApiError {
  readonly status = 0;
  readonly code = 'unknown' as const;

  constructor(message: string) {
    super(message);
    this.name = 'GoogleSignInError';
  }
}

/**
 * Show Google's account picker.
 *
 * Resolves with the ID token, or `null` when the customer backs out. Backing
 * out isn't an error, so the screen shows nothing.
 */
export async function requestGoogleIdToken(): Promise<string | null> {
  if (!googleSignInAvailable) {
    throw new GoogleSignInError('Google sign-in is not available in this version of the app.');
  }

  configure();
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = googleSignIn();

  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    // Sign out of the previous Google session first, so the picker always
    // appears. Otherwise someone with two Google accounts is silently signed
    // in as whichever one they used last, with no way to choose.
    await GoogleSignin.signOut().catch(() => undefined);

    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null; // cancelled

    const idToken = response.data.idToken;
    if (!idToken) {
      // Only happens when webClientId is missing or wrong.
      throw new GoogleSignInError('Google sign-in is not set up correctly. Please use your email instead.');
    }
    return idToken;
  } catch (error) {
    if (error instanceof GoogleSignInError) throw error;

    if (isErrorWithCode(error)) {
      switch (error.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          return null;
        case statusCodes.IN_PROGRESS:
          throw new GoogleSignInError('Google sign-in is already open.');
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          throw new GoogleSignInError('Google Play services is missing or out of date on this device.');
      }
    }

    // DEVELOPER_ERROR (code 10) on Android is almost always a SHA-1 or package
    // name that isn't registered on the Android OAuth client.
    throw new GoogleSignInError("Couldn't sign in with Google. Please try again.");
  }
}

/**
 * Forget the Google session on this device, so the next "Continue with Google"
 * asks again. Called on sign-out; failures don't matter.
 */
export async function signOutOfGoogle(): Promise<void> {
  if (!googleSignInAvailable) return;
  configure();
  await googleSignIn().GoogleSignin.signOut().catch(() => undefined);
}
