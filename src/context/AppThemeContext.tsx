import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { fittrackColors, FittrackMode } from '@/constants/fittrackTheme';

type AppThemeContextValue = {
  mode: FittrackMode;
  colors: typeof fittrackColors.light;
  toggleMode: () => void;
};

const STORAGE_KEY = 'fittrack-theme-mode';
const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preferredMode, setPreferredMode] = useState<FittrackMode | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark') {
        setPreferredMode(stored);
      }
    });
  }, []);

  const mode: FittrackMode = preferredMode || (systemScheme === 'dark' ? 'dark' : 'light');

  const value = useMemo<AppThemeContextValue>(
    () => ({
      mode,
      colors: fittrackColors[mode],
      toggleMode: () => {
        setPreferredMode((current) => {
          const next: FittrackMode = (current || mode) === 'dark' ? 'light' : 'dark';
          AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
          return next;
        });
      },
    }),
    [mode],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const value = useContext(AppThemeContext);
  if (!value) {
    throw new Error('useAppTheme must be used inside AppThemeProvider.');
  }
  return value;
}
