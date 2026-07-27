import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { useAppTheme } from '@/context/AppThemeContext';

export default function ProfileLayout() {
  const { colors } = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        gestureEnabled: true,
        animation: Platform.OS === 'ios' ? 'ios_from_right' : 'slide_from_right',
      }}
    />
  );
}
