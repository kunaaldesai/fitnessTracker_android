import { GoogleSignin, isCancelledResponse, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { LockKeyhole } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { PageTransition } from '@/components/fittrack/PageTransition';
import { AppText, InlineError } from '@/components/fittrack/ui';
import { spacing } from '@/constants/fittrackTheme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useAuth } from '@/context/AuthContext';

const appIcon = require('@/assets/images/logmaxxing-icon.png');
const PRIVACY_POLICY_URL = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || 'https://fitness-tracker-39bca.web.app/privacy-policy.md';
const NONCE_CHARACTERS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._';

const googleClientIds = {
  clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || undefined,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
};

const googleWebClientId = googleClientIds.webClientId || googleClientIds.clientId;
const googleNativeClientConfigured = Platform.select({
  ios: Boolean(googleClientIds.iosClientId),
  android: Boolean(googleWebClientId),
  default: Boolean(googleWebClientId),
});

let googleConfigurationError = '';
if (googleNativeClientConfigured) {
  try {
    GoogleSignin.configure({
      webClientId: googleWebClientId,
      iosClientId: googleClientIds.iosClientId,
      offlineAccess: false,
      scopes: ['profile', 'email'],
    });
  } catch {
    googleConfigurationError = 'Google sign-in needs a native development build. Run npm run ios again after the native config update.';
  }
}

export default function AuthScreen() {
  const { colors } = useAppTheme();
  const { configured, signInWithApple, signInWithGoogle } = useAuth();
  const [busyProvider, setBusyProvider] = useState<'apple' | 'google' | null>(null);
  const [error, setError] = useState('');
  const [appleAvailable, setAppleAvailable] = useState(false);
  const busy = busyProvider !== null;
  const canUseAppleSignIn = Platform.OS === 'ios' && appleAvailable;

  useEffect(() => {
    let mounted = true;

    if (Platform.OS !== 'ios') return () => undefined;

    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (mounted) setAppleAvailable(available);
      })
      .catch(() => {
        if (mounted) setAppleAvailable(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function submitGoogle() {
    setError('');
    if (!configured) {
      setError('Firebase Auth is not configured. Add the Expo public Firebase values from .env.example.');
      return;
    }
    if (!googleNativeClientConfigured) {
      setError('Google sign-in needs native OAuth client IDs in .env.');
      return;
    }
    if (googleConfigurationError) {
      setError(googleConfigurationError);
      return;
    }
    setBusyProvider('google');
    try {
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }
      const response = await GoogleSignin.signIn();
      if (isCancelledResponse(response)) return;
      if (!isSuccessResponse(response)) throw new Error('Google sign-in failed.');

      const tokens = await GoogleSignin.getTokens();
      const idToken = response.data.idToken || tokens.idToken;
      if (!idToken) throw new Error('Google did not return a sign-in token.');

      await signInWithGoogle(idToken, tokens.accessToken);
    } catch (nextError) {
      setError(mapGoogleSignInError(nextError));
    } finally {
      setBusyProvider(null);
    }
  }

  async function submitApple() {
    setError('');
    if (!configured) {
      setError('Firebase Auth is not configured. Add the Expo public Firebase values from .env.example.');
      return;
    }
    if (!canUseAppleSignIn) {
      setError('Apple sign-in is only available on supported iOS devices.');
      return;
    }
    setBusyProvider('apple');
    try {
      const rawNonce = await createAppleNonce();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
        nonce: hashedNonce,
      });

      await signInWithApple(credential.identityToken, rawNonce, formatAppleDisplayName(credential.fullName));
    } catch (nextError) {
      setError(mapAppleSignInError(nextError));
    } finally {
      setBusyProvider(null);
    }
  }

  async function openPrivacyPolicy() {
    const supported = await Linking.canOpenURL(PRIVACY_POLICY_URL).catch(() => false);
    if (!supported) {
      setError('Unable to open the privacy policy right now.');
      return;
    }
    await Linking.openURL(PRIVACY_POLICY_URL);
  }

  return (
    <PageTransition>
      <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <View style={styles.brandBlock}>
            <Image source={appIcon} style={[styles.brandImage, { shadowColor: colors.shadow }]} />
            <AppText variant="title" style={styles.wordmark}>
              Logmaxxing
            </AppText>
            <AppText muted style={styles.tagline}>
              Your training, organized.
            </AppText>
          </View>
        </View>

        <View style={[styles.authPanel, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow }]}>
          <View style={[styles.authPanelAccent, { backgroundColor: colors.primary }]} />
          <View style={styles.authHeader}>
            <AppText variant="heading" style={styles.authTitle}>
              Sign in
            </AppText>
          </View>

          <InlineError message={error} />
          {!configured ? (
            <InlineError message="Missing Firebase client config. Copy .env.example to .env and fill in the public Firebase values." />
          ) : null}

          <View style={styles.providerStack}>
            <Pressable
              accessibilityLabel="Continue with Google"
              accessibilityRole="button"
              disabled={busy}
              onPress={submitGoogle}
              style={({ pressed }) => [
                styles.googleButton,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceAlt,
                  shadowColor: colors.shadow,
                  opacity: busy ? 0.55 : pressed ? 0.78 : 1,
                },
              ]}>
              <GoogleLogo size={22} />
              <AppText color={colors.text} style={styles.googleButtonText}>
                {busyProvider === 'google' ? 'Opening Google...' : 'Continue with Google'}
              </AppText>
            </Pressable>

            {canUseAppleSignIn ? (
              <AppleAuthentication.AppleAuthenticationButton
                accessibilityLabel="Continue with Apple"
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                cornerRadius={18}
                onPress={busy ? () => undefined : submitApple}
                pointerEvents={busy ? 'none' : 'auto'}
                style={[styles.appleButton, { opacity: busy ? 0.55 : 1 }]}
              />
            ) : null}
          </View>

          <View style={styles.privacyStack}>
            <View style={styles.privacyRow}>
              <LockKeyhole size={14} color={colors.muted} strokeWidth={2.3} />
              <AppText variant="caption" muted style={styles.privacyText}>
                Secure sign-in powered by {canUseAppleSignIn ? 'Firebase' : 'Google'}
              </AppText>
            </View>
            <Pressable accessibilityRole="link" onPress={openPrivacyPolicy} hitSlop={8}>
              <AppText variant="caption" color={colors.primary} style={styles.privacyLink}>
                Privacy Policy
              </AppText>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </PageTransition>
  );
}

function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <Path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <Path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <Path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </Svg>
  );
}

async function createAppleNonce(length = 32) {
  const bytes = await Crypto.getRandomBytesAsync(length);
  return Array.from(bytes, (byte) => NONCE_CHARACTERS[byte % NONCE_CHARACTERS.length]).join('');
}

function formatAppleDisplayName(fullName: AppleAuthentication.AppleAuthenticationCredential['fullName']) {
  if (!fullName) return null;
  try {
    const formattedName = AppleAuthentication.formatFullName(fullName).trim();
    if (formattedName) return formattedName;
  } catch {
    // Fall back to manual formatting when native name formatting is unavailable.
  }
  return [fullName.givenName, fullName.familyName].filter(Boolean).join(' ').trim() || null;
}

function mapGoogleSignInError(error: unknown) {
  if (isErrorWithCode(error)) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) return 'Google sign-in was cancelled.';
    if (error.code === statusCodes.IN_PROGRESS) return 'Google sign-in is already in progress.';
    if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return 'Google Play Services is not available on this device.';
    if (error.code === statusCodes.NULL_PRESENTER) return 'Google sign-in is not ready yet. Try again after the app finishes loading.';
  }
  return error instanceof Error ? error.message : 'Unable to authenticate with Google right now.';
}

function mapAppleSignInError(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (code === 'ERR_REQUEST_CANCELED' || code.includes('canceled') || code.includes('cancelled')) {
    return 'Apple sign-in was cancelled.';
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Unable to authenticate with Apple right now.';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: spacing.xl,
  },
  brandBlock: {
    alignItems: 'center',
    gap: spacing.md,
  },
  brandImage: {
    width: 116,
    height: 116,
    borderRadius: 26,
    shadowOpacity: 0.24,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  wordmark: {
    marginTop: spacing.xs,
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'AvenirNext-DemiBold', android: 'sans-serif-medium' }),
    fontSize: 35,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: 0,
  },
  tagline: {
    maxWidth: 240,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
  },
  authPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 28,
    gap: spacing.lg,
    padding: spacing.xl,
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 7,
  },
  authPanelAccent: {
    alignSelf: 'center',
    width: 46,
    height: 4,
    borderRadius: 999,
    opacity: 0.75,
  },
  authHeader: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  authTitle: {
    textAlign: 'center',
    fontSize: 24,
    lineHeight: 29,
  },
  providerStack: {
    gap: spacing.md,
  },
  appleButton: {
    width: '100%',
    height: 56,
  },
  googleButton: {
    minHeight: 56,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  googleButtonText: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
  },
  privacyStack: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  privacyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  privacyText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  privacyLink: {
    fontWeight: '800',
    textAlign: 'center',
  },
});
