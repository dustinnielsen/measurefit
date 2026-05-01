import { WorkoutType } from '../types/enums';

// MET values (Metabolic Equivalent of Task)
const METS: Record<WorkoutType, number> = {
  [WorkoutType.Walk]:      3.5,
  [WorkoutType.Easy]:      8.0,
  [WorkoutType.Long]:      8.5,
  [WorkoutType.Strides]:   9.0,
  [WorkoutType.Tempo]:    10.0,
  [WorkoutType.Intervals]: 12.0,
  [WorkoutType.Strength]:   5.0,
  [WorkoutType.Mobility]:   2.5,
  [WorkoutType.Rest]:       1.0,
};

// weightLbs: user's weight in lbs, durationSeconds: workout duration
export function estimateCalories(
  type: WorkoutType,
  durationSeconds: number,
  weightLbs: number,
): number {
  const met       = METS[type] ?? 5.0;
  const weightKg  = weightLbs / 2.20462;
  const hours     = durationSeconds / 3600;
  return Math.round(met * weightKg * hours);
}

export function caloriesPerMile(type: WorkoutType, weightLbs: number): number {
  // Simplified: calories ≈ 0.63 × weight_lbs per mile for running, 0.30 for walking
  if (type === WorkoutType.Walk) return Math.round(0.30 * weightLbs);
  return Math.round(0.63 * weightLbs);
}
