import { router } from 'expo-router';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  FirebaseUser,
  getCurrentIdToken,
  isFirebaseConfigured,
  mapAuthError,
  signInWithAppleCredential,
  signInWithGoogleCredential,
  signOut,
  subscribeToAuthState,
} from '@/services/authService';

type AuthContextValue = {
  user: FirebaseUser | null;
  loading: boolean;
  configured: boolean;
  signInWithGoogle: (idToken: string | null, accessToken?: string | null) => Promise<void>;
  signInWithApple: (idToken: string | null, rawNonce: string, displayName?: string | null) => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string>;
  loginEntrancePending: boolean;
  completeLoginEntrance: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginEntrancePending, setLoginEntrancePending] = useState(false);

  useEffect(() => {
    return subscribeToAuthState((nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  const completeLoginEntrance = useCallback(() => {
    setLoginEntrancePending(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      configured: isFirebaseConfigured,
      loginEntrancePending,
      signInWithGoogle: async (idToken, accessToken) => {
        try {
          await signInWithGoogleCredential(idToken, accessToken);
          setLoginEntrancePending(true);
          router.replace('/(tabs)');
        } catch (error) {
          throw new Error(mapAuthError(error));
        }
      },
      signInWithApple: async (idToken, rawNonce, displayName) => {
        try {
          await signInWithAppleCredential(idToken, rawNonce, displayName);
          setLoginEntrancePending(true);
          router.replace('/(tabs)');
        } catch (error) {
          throw new Error(mapAuthError(error));
        }
      },
      logout: async () => {
        setLoginEntrancePending(false);
        await signOut();
        router.replace('/auth');
      },
      getIdToken: () => getCurrentIdToken(),
      completeLoginEntrance,
    }),
    [completeLoginEntrance, loading, loginEntrancePending, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return value;
}
