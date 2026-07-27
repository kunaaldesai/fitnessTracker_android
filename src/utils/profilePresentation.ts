import type { ProfilePayload, WeightHistoryPayload } from '@/types/fitness';

import { formatNumber } from './fitnessMath';
import { formatWeight } from './weightTracking';

export type ProfileSectionKey = 'weight' | 'health' | 'details' | 'account';

export type ProfileSectionSummary = {
  key: ProfileSectionKey;
  title: string;
  value: string;
  meta: string;
};

export function profileSectionSummaries(
  profile: ProfilePayload | null,
  weightHistory: WeightHistoryPayload | null,
): Record<ProfileSectionKey, ProfileSectionSummary> {
  const missingCount = profile
    ? new Set(Object.values(profile.missing_fields || {}).flat()).size
    : 0;
  const latestWeight = weightHistory?.summary.latest_weight_lbs ?? profile?.profile.weight_lbs;

  return {
    weight: {
      key: 'weight',
      title: 'Weight',
      value: formatWeight(latestWeight, 'lb'),
      meta: weightHistory?.summary.latest_date_label || 'Trends, logs, and goals',
    },
    health: {
      key: 'health',
      title: 'Health & Nutrition',
      value: profile?.metrics.bmi ? `BMI ${formatNumber(profile.metrics.bmi, 1)}` : 'Needs details',
      meta: profile?.metrics.tdee ? `${formatNumber(profile.metrics.tdee)} cal TDEE` : 'BMI, metabolism, and calorie targets',
    },
    details: {
      key: 'details',
      title: 'Personal Details',
      value: missingCount ? `${missingCount} missing` : profile ? 'Complete' : 'Loading',
      meta: profile?.user.display_name || 'Health calculation inputs',
    },
    account: {
      key: 'account',
      title: 'Account & Appearance',
      value: profile?.user.email || 'Signed in',
      meta: 'Theme, privacy, and account controls',
    },
  };
}
