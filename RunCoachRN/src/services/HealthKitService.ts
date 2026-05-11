import { Platform } from 'react-native';
import { WorkoutType } from '../types/enums';

// Lazy import — only available on iOS device builds
let HKWorkoutActivityType: any;
let HKQuantityTypeIdentifier: any;
let HKUnit: any;
let HealthKit: any;

if (Platform.OS === 'ios') {
  try {
    const hk = require('@kingstinct/react-native-healthkit');
    HKWorkoutActivityType    = hk.HKWorkoutActivityType;
    HKQuantityTypeIdentifier = hk.HKQuantityTypeIdentifier;
    HKUnit                   = hk.HKUnit;
    HealthKit                = hk.default ?? hk;
  } catch {}
}

// ── Permission request ────────────────────────────────────────
export async function requestHealthKitPermissions(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !HealthKit) return false;
  try {
    await HealthKit.requestAuthorization(
      // Read types
      [HKQuantityTypeIdentifier.restingHeartRate, HKQuantityTypeIdentifier.heartRate],
      // Write types
      [
        HKQuantityTypeIdentifier.activeEnergyBurned,
        HKQuantityTypeIdentifier.distanceWalkingRunning,
      ],
    );
    return true;
  } catch {
    return false;
  }
}

// ── Map Cinder workout type → HealthKit activity type ─────────
function toHKActivityType(type: WorkoutType): number {
  if (!HKWorkoutActivityType) return 37; // running fallback
  switch (type) {
    case WorkoutType.Walk:      return HKWorkoutActivityType.walking;
    case WorkoutType.Easy:
    case WorkoutType.Long:
    case WorkoutType.Tempo:
    case WorkoutType.Strides:
    case WorkoutType.Intervals: return HKWorkoutActivityType.running;
    case WorkoutType.Strength:  return HKWorkoutActivityType.traditionalStrengthTraining;
    case WorkoutType.Mobility:  return HKWorkoutActivityType.flexibility;
    default:                    return HKWorkoutActivityType.running;
  }
}

// ── Save workout to Apple Health ──────────────────────────────
export async function saveWorkoutToHealthKit(params: {
  workoutType:    WorkoutType;
  startDate:      Date;
  endDate:        Date;
  distanceMiles?: number;
  calories?:      number;
}): Promise<boolean> {
  if (Platform.OS !== 'ios' || !HealthKit) return false;

  try {
    await requestHealthKitPermissions();

    const { workoutType, startDate, endDate, distanceMiles, calories } = params;
    const activityType = toHKActivityType(workoutType);

    const samples: any[] = [];

    if (distanceMiles && distanceMiles > 0) {
      samples.push({
        quantityType: HKQuantityTypeIdentifier.distanceWalkingRunning,
        unit:         'mi',
        quantity:     distanceMiles,
        startDate,
        endDate,
      });
    }

    if (calories && calories > 0) {
      samples.push({
        quantityType: HKQuantityTypeIdentifier.activeEnergyBurned,
        unit:         'kcal',
        quantity:     calories,
        startDate,
        endDate,
      });
    }

    await HealthKit.saveWorkout({
      workoutActivityType: activityType,
      startDate,
      endDate,
      totalEnergyBurned:    calories    ? { unit: 'kcal', quantity: calories }    : undefined,
      totalDistance:        distanceMiles ? { unit: 'mi', quantity: distanceMiles } : undefined,
      quantitySamples:      samples,
    });

    return true;
  } catch (e) {
    console.warn('HealthKit saveWorkout error:', e);
    return false;
  }
}

// ── Read resting heart rate (most recent) ─────────────────────
export async function getRestingHeartRate(): Promise<number | null> {
  if (Platform.OS !== 'ios' || !HealthKit) return null;

  try {
    await requestHealthKitPermissions();

    const results = await HealthKit.queryQuantitySamples(
      HKQuantityTypeIdentifier.restingHeartRate,
      {
        unit:  'count/min',
        from:  new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // last 7 days
        to:    new Date(),
        limit: 1,
        ascending: false,
      }
    );

    if (results && results.length > 0) {
      return Math.round(results[0].quantity);
    }
    return null;
  } catch {
    return null;
  }
}
