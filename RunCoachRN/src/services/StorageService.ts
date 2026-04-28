import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RunFeedback, TrainingPlan, UserProfile } from '../types/models';

const KEYS = {
  PROFILE: '@runcoach/profile',
  PLAN:    '@runcoach/plan',
  FEEDBACK:'@runcoach/feedback',
  STRAVA:  '@runcoach/strava_token',
} as const;

async function save<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

async function load<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export const StorageService = {
  saveProfile: (p: UserProfile)    => save(KEYS.PROFILE, p),
  loadProfile: ()                  => load<UserProfile>(KEYS.PROFILE),

  savePlan:    (p: TrainingPlan)   => save(KEYS.PLAN, p),
  loadPlan:    ()                  => load<TrainingPlan>(KEYS.PLAN),

  saveFeedback:(f: RunFeedback[])  => save(KEYS.FEEDBACK, f),
  loadFeedback:()                  => load<RunFeedback[]>(KEYS.FEEDBACK),

  clearAll:    ()                  => AsyncStorage.multiRemove(Object.values(KEYS)),
};
