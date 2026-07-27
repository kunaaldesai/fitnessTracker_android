import { router } from 'expo-router';
import { ArrowLeft, HeartPulse, Scale, ShieldCheck, UserRound } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AppText,
  Card,
  Header,
  IconButton,
  InlineError,
  ListRow,
  LoadingState,
} from '@/components/fittrack/ui';
import { spacing } from '@/constants/fittrackTheme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useProfileData } from '@/context/ProfileDataContext';
import { profileSectionSummaries } from '@/utils/profilePresentation';

const SECTION_ICONS = {
  weight: Scale,
  health: HeartPulse,
  details: UserRound,
  account: ShieldCheck,
} as const;

export default function ProfileHubScreen() {
  const { colors, mode } = useAppTheme();
  const {
    profile,
    allWeightHistory,
    profileLoading,
    allWeightLoading,
    error,
    refreshProfileData,
  } = useProfileData();
  const summaries = profileSectionSummaries(profile, allWeightHistory);

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Profile"
        right={<IconButton icon={ArrowLeft} onPress={() => router.back()} label="Back" />}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {profileLoading && !profile ? <LoadingState label="Loading profile..." /> : null}
        <InlineError message={error} />

        {profile ? (
          <>
            <Card style={styles.identityCard}>
              <View style={[styles.avatar, { backgroundColor: `${colors.primary}18` }]}>
                <AppText color={colors.primary} style={styles.avatarText}>
                  {(profile.user.display_name || profile.user.email || 'A').slice(0, 1).toUpperCase()}
                </AppText>
              </View>
              <View style={styles.identityCopy}>
                <AppText variant="subheading" numberOfLines={2}>
                  {profile.user.display_name || 'Athlete'}
                </AppText>
                <AppText variant="caption" muted numberOfLines={2}>{profile.user.email || 'Signed in'}</AppText>
              </View>
            </Card>

            <Card style={styles.sectionList}>
              {(Object.keys(summaries) as (keyof typeof summaries)[]).map((key, index, keys) => {
                const summary = summaries[key];
                const value = key === 'account' ? `${mode === 'dark' ? 'Dark' : 'Light'} theme` : summary.value;
                return (
                  <ListRow
                    key={key}
                    icon={SECTION_ICONS[key]}
                    title={summary.title}
                    value={value}
                    meta={summary.meta}
                    grouped
                    showDivider={index < keys.length - 1}
                    onPress={() => router.push(`/profile/${key}`)}
                    accessibilityLabel={`${summary.title}. ${value}. ${summary.meta}`}
                  />
                );
              })}
            </Card>
          </>
        ) : null}

        {!profileLoading && !profile ? (
          <Card style={styles.retryCard}>
            <AppText variant="subheading">Profile unavailable</AppText>
            <AppText variant="caption" muted>Pull your profile data again without leaving this screen.</AppText>
            <ListRow
              title={allWeightLoading ? 'Refreshing' : 'Refresh profile'}
              showChevron={false}
              onPress={allWeightLoading ? undefined : refreshProfileData}
            />
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingBottom: 80,
    gap: spacing.lg,
  },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sectionList: {
    padding: 0,
    overflow: 'hidden',
  },
  retryCard: {
    gap: spacing.md,
  },
});
