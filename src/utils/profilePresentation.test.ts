import { describe, expect, it } from 'vitest';

import type { ProfilePayload, WeightHistoryPayload } from '@/types/fitness';

import { profileSectionSummaries } from './profilePresentation';

describe('profile section summaries', () => {
  it('maps profile and weight data into concise hub summaries', () => {
    const profile = {
      user: { uid: 'user', email: 'athlete@example.com', display_name: 'Athlete' },
      profile: { weight_lbs: 180 },
      metrics: { bmi: 24.2, tdee: 2450 },
      missing_fields: {},
    } as unknown as ProfilePayload;
    const weightHistory = {
      summary: { latest_weight_lbs: 178.5, latest_date_label: 'Jul 26' },
    } as WeightHistoryPayload;

    const summaries = profileSectionSummaries(profile, weightHistory);

    expect(summaries.weight).toMatchObject({ value: '178.5 lb', meta: 'Jul 26' });
    expect(summaries.health).toMatchObject({ value: 'BMI 24.2', meta: '2,450 cal TDEE' });
    expect(summaries.details).toMatchObject({ value: 'Complete', meta: 'Athlete' });
    expect(summaries.account.value).toBe('athlete@example.com');
  });

  it('reports distinct missing profile inputs', () => {
    const profile = {
      user: { uid: 'user' },
      profile: {},
      metrics: {},
      missing_fields: { bmi: ['height_feet', 'weight_lbs'], bmr: ['height_feet', 'date_of_birth'] },
    } as unknown as ProfilePayload;

    expect(profileSectionSummaries(profile, null).details.value).toBe('3 missing');
  });
});
