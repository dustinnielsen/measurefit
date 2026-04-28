/**
 * HealthKit service — stubbed until the app is built with EAS + Apple Developer account.
 *
 * All methods are safe to call now. `isAvailable()` returns false so the UI
 * shows "Connect Apple Health (requires full build)" instead of crashing.
 * When the entitlement is live, swap this file for the real implementation
 * using react-native-health or expo-health.
 */

export interface HKWorkoutSample {
  startDate: Date;
  endDate: Date;
  distanceMeters: number;
  activeCalories?: number;
  heartRateSamples?: number[];
}

export interface HKHealthData {
  restingHeartRate?: number;
  heartRateVariability?: number;
  sleepHours?: number;
  stepCount?: number;
}

const UNAVAILABLE_MSG =
  'Apple Health requires the full RunCoach build (EAS + Apple Developer account). ' +
  'All other features work normally.';

export const HealthKitService = {
  /** Always false in Expo Go — becomes true once EAS build with entitlement is live. */
  isAvailable(): boolean {
    return false;
  },

  /** Shows a clear message rather than crashing. */
  async requestPermissions(): Promise<boolean> {
    console.log('[HealthKit] ' + UNAVAILABLE_MSG);
    return false;
  },

  /** Save a completed workout run to Apple Health. No-op when unavailable. */
  async saveWorkout(_sample: HKWorkoutSample): Promise<void> {
    if (!this.isAvailable()) return;
    // TODO: implement with react-native-health once EAS build is live
    // await AppleHealthKit.saveWorkout({ ... })
  },

  /** Read today's health summary. Returns null when unavailable. */
  async readTodayHealth(): Promise<HKHealthData | null> {
    if (!this.isAvailable()) return null;
    // TODO: implement with react-native-health once EAS build is live
    return null;
  },

  /** Human-readable status string for the Settings screen. */
  statusMessage(): string {
    return this.isAvailable()
      ? 'Connected to Apple Health'
      : 'Available in the full app build';
  },
};
