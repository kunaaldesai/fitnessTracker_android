import { router } from 'expo-router';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import {
  FirebaseUser,
  getCurrentIdToken,
  isFirebaseConfigured,
  mapAuthError,
  signInWithGoogleCredential,
  signOut,
  subscribeToAuthState,
} from '@/services/authService';

type AuthContextValue = {
  user: FirebaseUser | null;
  loading: boolean;
  configured: boolean;
  signInWithGoogle: (idToken: string | null, accessToken?: string | null) => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return subscribeToAuthState((nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      configured: isFirebaseConfigured,
      signInWithGoogle: async (idToken, accessToken) => {
        try {
          await signInWithGoogleCredential(idToken, accessToken);
          router.replace('/(tabs)');
        } catch (error) {
          throw new Error(mapAuthError(error));
        }
      },
      logout: async () => {
        await signOut();
        router.replace('/auth');
      },
      getIdToken: () => getCurrentIdToken(),
    }),
    [loading, user],
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
