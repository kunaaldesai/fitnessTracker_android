import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { fitnessApi } from '@/services/fitnessApi';
import type { ProfilePayload, WeightHistoryPayload } from '@/types/fitness';

import { useAuth } from './AuthContext';

type ProfileDataContextValue = {
  profile: ProfilePayload | null;
  allWeightHistory: WeightHistoryPayload | null;
  profileLoading: boolean;
  allWeightLoading: boolean;
  error: string;
  refreshProfile: () => Promise<ProfilePayload | null>;
  refreshAllWeightHistory: () => Promise<WeightHistoryPayload | null>;
  refreshProfileData: () => Promise<void>;
  applyProfile: (profile: ProfilePayload) => void;
  applyAllWeightHistory: (history: WeightHistoryPayload) => void;
};

const ProfileDataContext = createContext<ProfileDataContextValue | null>(null);

export function ProfileDataProvider({ children }: PropsWithChildren) {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [allWeightHistory, setAllWeightHistory] = useState<WeightHistoryPayload | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [allWeightLoading, setAllWeightLoading] = useState(false);
  const [error, setError] = useState('');
  const profileRequest = useRef<Promise<ProfilePayload | null> | null>(null);
  const weightRequest = useRef<Promise<WeightHistoryPayload | null> | null>(null);

  const refreshProfile = useCallback(() => {
    if (profileRequest.current) return profileRequest.current;
    setProfileLoading(true);
    setError('');
    const request = fitnessApi.getProfile()
      .then((response) => {
        if (response.status !== 'ok') {
          setError(response.error || 'Unable to load profile.');
          return null;
        }
        setProfile(response);
        return response;
      })
      .catch(() => {
        setError('Unable to load profile.');
        return null;
      })
      .finally(() => {
        profileRequest.current = null;
        setProfileLoading(false);
      });
    profileRequest.current = request;
    return request;
  }, []);

  const refreshAllWeightHistory = useCallback(() => {
    if (weightRequest.current) return weightRequest.current;
    setAllWeightLoading(true);
    const request = fitnessApi.getWeightHistory({ range: 'all' })
      .then((response) => {
        if (response.status !== 'ok') return null;
        setAllWeightHistory(response);
        return response;
      })
      .catch(() => null)
      .finally(() => {
        weightRequest.current = null;
        setAllWeightLoading(false);
      });
    weightRequest.current = request;
    return request;
  }, []);

  const refreshProfileData = useCallback(async () => {
    await Promise.all([refreshProfile(), refreshAllWeightHistory()]);
  }, [refreshAllWeightHistory, refreshProfile]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const timer = setTimeout(() => {
        setProfile(null);
        setAllWeightHistory(null);
        setError('');
      }, 0);
      return () => clearTimeout(timer);
    }
    refreshProfileData();
    return undefined;
  }, [authLoading, refreshProfileData, user]);

  const value = useMemo<ProfileDataContextValue>(() => ({
    profile,
    allWeightHistory,
    profileLoading,
    allWeightLoading,
    error,
    refreshProfile,
    refreshAllWeightHistory,
    refreshProfileData,
    applyProfile: setProfile,
    applyAllWeightHistory: setAllWeightHistory,
  }), [
    allWeightHistory,
    allWeightLoading,
    error,
    profile,
    profileLoading,
    refreshAllWeightHistory,
    refreshProfile,
    refreshProfileData,
  ]);

  return <ProfileDataContext.Provider value={value}>{children}</ProfileDataContext.Provider>;
}

export function useProfileData() {
  const value = useContext(ProfileDataContext);
  if (!value) throw new Error('useProfileData must be used inside ProfileDataProvider.');
  return value;
}
