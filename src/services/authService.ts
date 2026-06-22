import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { getApps, initializeApp } from 'firebase/app';
import type { Auth, Persistence, User } from 'firebase/auth';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  initializeAuth,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { Platform } from 'react-native';

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

type KeyValueStorage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const secureAuthStorage: KeyValueStorage = {
  async getItem(key: string) {
    const secureValue = await SecureStore.getItemAsync(key, secureStoreOptions);
    if (secureValue !== null) return secureValue;

    const legacyValue = await AsyncStorage.getItem(key);
    if (legacyValue !== null) {
      try {
        await SecureStore.setItemAsync(key, legacyValue, secureStoreOptions);
        await AsyncStorage.removeItem(key);
      } catch {
        await AsyncStorage.removeItem(key).catch(() => undefined);
        return null;
      }
    }
    return legacyValue;
  },
  async setItem(key: string, value: string) {
    await SecureStore.setItemAsync(key, value, secureStoreOptions);
    await AsyncStorage.removeItem(key).catch(() => undefined);
  },
  async removeItem(key: string) {
    await SecureStore.deleteItemAsync(key, secureStoreOptions);
    await AsyncStorage.removeItem(key).catch(() => undefined);
  },
};

function getAuthStorage(): KeyValueStorage {
  return Platform.OS === 'web' ? AsyncStorage : secureAuthStorage;
}

function createJsonPersistence(storage: KeyValueStorage): Persistence {
  class JsonPersistence {
    static type = 'LOCAL' as const;
    readonly type = 'LOCAL' as const;

    async _isAvailable() {
      try {
        if (Platform.OS !== 'web' && !(await SecureStore.isAvailableAsync())) {
          return false;
        }
        await storage.setItem('__sak', '1');
        await storage.removeItem('__sak');
        return true;
      } catch {
        return false;
      }
    }

    _set(key: string, value: unknown) {
      return storage.setItem(key, JSON.stringify(value));
    }

    async _get<T>(key: string): Promise<T | null> {
      const item = await storage.getItem(key);
      return item ? (JSON.parse(item) as T) : null;
    }

    _remove(key: string) {
      return storage.removeItem(key);
    }

    _addListener() {}

    _removeListener() {}
  }

  return JsonPersistence as unknown as Persistence;
}

function createAuthInstance(): Auth | null {
  if (!isFirebaseConfigured) return null;
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  try {
    return initializeAuth(app, {
      persistence: createJsonPersistence(getAuthStorage()),
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

export async function signInWithGoogleCredential(idToken: string | null, accessToken?: string | null) {
  if (!firebaseAuth) throw new Error('Firebase Auth is not configured.');
  if (!idToken && !accessToken) throw new Error('Google did not return a usable sign-in token.');
  const credential = GoogleAuthProvider.credential(idToken, accessToken);
  return signInWithCredential(firebaseAuth, credential);
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
  if (code.includes('operation-not-allowed')) return 'This sign-in method is not enabled in Firebase Auth.';
  if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) return 'Google sign-in was cancelled.';
  if (code.includes('account-exists-with-different-credential')) {
    return 'An account already exists with the same email using another sign-in method.';
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Unable to authenticate right now.';
}

export type { User as FirebaseUser };
