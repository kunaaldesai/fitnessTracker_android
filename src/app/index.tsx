import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAppTheme } from '@/context/AppThemeContext';
import { useAuth } from '@/context/AuthContext';

export default function IndexRoute() {
  const { user, loading } = useAuth();
  const { colors } = useAppTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <Redirect href={user ? '/(tabs)' : '/auth'} />;
}
