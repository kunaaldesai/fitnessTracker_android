import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, InlineError, PillButton, TextField } from '@/components/fittrack/ui';
import { spacing } from '@/constants/fittrackTheme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useAuth } from '@/context/AuthContext';

export default function AuthScreen() {
  const { colors } = useAppTheme();
  const { configured, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
});
