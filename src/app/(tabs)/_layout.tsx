import { Redirect, Tabs } from 'expo-router';
import { BarChart3, Dumbbell, Trophy } from 'lucide-react-native';
import { ActivityIndicator, Platform, View } from 'react-native';

import { useAppTheme } from '@/context/AppThemeContext';
import { useAuth } from '@/context/AuthContext';

export default function FitTrackTabs() {
  const { user, loading } = useAuth();
  const { colors, mode } = useAppTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!user) return <Redirect href="/auth" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: mode === 'dark' ? 'rgba(28,28,30,0.96)' : 'rgba(242,242,247,0.96)',
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 84 : 70,
          paddingTop: 7,
          paddingBottom: Platform.OS === 'ios' ? 26 : 10,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Workout',
          tabBarIcon: ({ color, focused }) => <Dumbbell size={24} color={color} fill={focused ? color : 'none'} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color, focused }) => <BarChart3 size={24} color={color} fill={focused ? color : 'none'} />,
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: 'Records',
          tabBarIcon: ({ color, focused }) => <Trophy size={24} color={color} fill={focused ? color : 'none'} />,
        }}
      />
    </Tabs>
  );
}
