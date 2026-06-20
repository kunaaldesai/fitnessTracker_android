import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth/react-native';
import {
  createUserWithEmailAndPassword,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth/react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId,
);

function createAuthInstance(): Auth | null {
  if (!isFirebaseConfigured) return null;
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
}

export const firebaseAuth = createAuthInstance();

export function subscribeToAuthState(callback: (user: User | null) => void) {
  if (!firebaseAuth) {
    callback(null);
    return () => undefined;
  }
  return onAuthStateChanged(firebaseAuth, callback);
}

export async function signIn(email: string, password: string) {
  if (!firebaseAuth) throw new Error('Firebase Auth is not configured.');
  return signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
}

export async function signUp(email: string, password: string) {
  if (!firebaseAuth) throw new Error('Firebase Auth is not configured.');
  return createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
}

export async function signOut() {
  if (!firebaseAuth) return;
  await firebaseSignOut(firebaseAuth);
}

export async function getCurrentIdToken(forceRefresh = false): Promise<string> {
  const user = firebaseAuth?.currentUser;
  if (!user) throw new Error('You need to sign in again.');
  return user.getIdToken(forceRefresh);
}

export function mapAuthError(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'Email or password is incorrect.';
  }
  if (code.includes('email-already-in-use')) return 'An account already exists for that email.';
  if (code.includes('weak-password')) return 'Password must be at least 6 characters.';
  if (code.includes('invalid-email')) return 'Enter a valid email address.';
  if (error instanceof Error && error.message) return error.message;
  return 'Unable to authenticate right now.';
}

export type { User as FirebaseUser };
