import { GoogleSignin, isCancelledResponse, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, InlineError } from '@/components/fittrack/ui';
import { spacing } from '@/constants/fittrackTheme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useAuth } from '@/context/AuthContext';

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
  const { configured, signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
    setBusy(true);
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
      setBusy(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <AppText variant="title">Sign in to FitTrack</AppText>
          <AppText muted>Use your Google account to continue.</AppText>
        </View>

        <InlineError message={error} />
        {!configured ? (
          <InlineError message="Missing Firebase client config. Copy .env.example to .env and fill in the public Firebase values." />
        ) : null}

        <Pressable
          accessibilityLabel="Continue with Google"
          accessibilityRole="button"
          disabled={busy}
          onPress={submitGoogle}
          style={({ pressed }) => [
            styles.googleButton,
            { borderColor: colors.border, backgroundColor: colors.surfaceAlt, opacity: busy ? 0.55 : pressed ? 0.76 : 1 },
          ]}>
          <View style={[styles.googleMark, { backgroundColor: colors.surface }]}>
            <AppText color={colors.text} style={styles.googleMarkText}>
              G
            </AppText>
          </View>
          <AppText color={colors.text} style={styles.googleButtonText}>
            {busy ? 'Opening Google...' : 'Continue with Google'}
          </AppText>
        </Pressable>
      </Card>
    </View>
  );
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
  },
  googleButton: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  googleButtonText: {
    fontWeight: '800',
  },
  googleMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleMarkText: {
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 16,
  },
});
