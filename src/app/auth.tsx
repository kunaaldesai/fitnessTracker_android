import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, InlineError, PillButton, TextField } from '@/components/fittrack/ui';
import { spacing } from '@/constants/fittrackTheme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useAuth } from '@/context/AuthContext';

WebBrowser.maybeCompleteAuthSession();

const googleClientIds = {
  clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || undefined,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
};

const platformGoogleClientId =
  Platform.OS === 'ios'
    ? googleClientIds.iosClientId || googleClientIds.clientId
    : Platform.OS === 'android'
      ? googleClientIds.androidClientId || googleClientIds.clientId
      : googleClientIds.webClientId || googleClientIds.clientId;

export default function AuthScreen() {
  const { colors } = useAppTheme();
  const { configured, signInWithEmail, signInWithGoogle, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const googleAuthConfigured = Boolean(platformGoogleClientId || googleClientIds.webClientId);
  const [googleRequest, , promptGoogleAsync] = Google.useIdTokenAuthRequest(
    {
      ...googleClientIds,
      clientId: platformGoogleClientId || googleClientIds.webClientId || 'missing-google-client-id',
      selectAccount: true,
    },
    { scheme: 'fittrack', path: 'auth' },
  );

  async function submit() {
    setError('');
    if (!configured) {
      setError('Firebase Auth is not configured. Add the Expo public Firebase values from .env.example.');
      return;
    }
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to authenticate right now.');
    } finally {
      setBusy(false);
    }
  }

  async function submitGoogle() {
    setError('');
    if (!configured) {
      setError('Firebase Auth is not configured. Add the Expo public Firebase values from .env.example.');
      return;
    }
    if (!googleAuthConfigured) {
      setError('Google sign-in needs EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID or EXPO_PUBLIC_GOOGLE_CLIENT_ID in .env.');
      return;
    }
    if (!googleRequest) {
      setError('Google sign-in is still loading.');
      return;
    }
    setBusy(true);
    try {
      const result = await promptGoogleAsync();
      if (result.type === 'cancel' || result.type === 'dismiss') return;
      if (result.type !== 'success') {
        throw new Error(result.type === 'error' ? result.error?.message || 'Google sign-in failed.' : 'Google sign-in failed.');
      }
      const idToken = result.params.id_token || result.authentication?.idToken || null;
      const accessToken = result.params.access_token || result.authentication?.accessToken || null;
      await signInWithGoogle(idToken, accessToken);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to authenticate with Google right now.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <AppText variant="title">{mode === 'signin' ? 'Log in' : 'Create your account'}</AppText>
          <Pressable onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            <AppText color={colors.primary} style={{ fontWeight: '700' }}>
              {mode === 'signin' ? 'Need an account?' : 'Already have one?'}
            </AppText>
          </Pressable>
        </View>

        <InlineError message={error} />
        {!configured ? (
          <InlineError message="Missing Firebase client config. Copy .env.example to .env and fill in the public Firebase values." />
        ) : null}

        <Pressable
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
            Continue with Google
          </AppText>
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <AppText variant="caption" muted>
            or
          </AppText>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="you@example.com"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType={mode === 'signin' ? 'password' : 'newPassword'}
          placeholder="Password"
        />
        {mode === 'signup' ? (
          <TextField
            label="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            textContentType="newPassword"
            placeholder="Confirm password"
          />
        ) : null}

        <PillButton onPress={submit} disabled={busy}>
          {busy ? 'Working...' : mode === 'signin' ? 'Log In' : 'Create Account'}
        </PillButton>
      </Card>
    </KeyboardAvoidingView>
  );
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
  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
});
