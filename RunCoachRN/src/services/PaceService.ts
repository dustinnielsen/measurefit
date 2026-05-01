import { RunningAbility, RunningGoal, WorkoutType } from '../types/enums';

export interface PaceZones {
  easy:     [string, string];
  long:     [string, string];
  tempo:    [string, string];
  interval: [string, string];
  race:     string | null;
}

// Estimated 5K-equivalent race pace (seconds/mile) per ability
const BASE_PACE: Record<RunningAbility, number> = {
  [RunningAbility.Beginner]:     690,  // ~11:30/mi  ≈ 35-min 5K
  [RunningAbility.Intermediate]: 510,  // ~8:30/mi   ≈ 26-min 5K
  [RunningAbility.Advanced]:     390,  // ~6:30/mi   ≈ 20-min 5K
};

// Adjustment: longer races = slower per-mile goal pace
const GOAL_FACTOR: Record<RunningGoal, number> = {
  [RunningGoal.FasterMile]:    0.88,
  [RunningGoal.GetFit]:        1.05,
  [RunningGoal.FiveK]:         1.00,
  [RunningGoal.TenK]:          1.06,
  [RunningGoal.HalfMarathon]:  1.12,
  [RunningGoal.Marathon]:      1.22,
};

function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function getPaceZones(ability: RunningAbility, goal: RunningGoal): PaceZones {
  const race = BASE_PACE[ability] * GOAL_FACTOR[goal];
  return {
    easy:     [fmt(race * 1.18), fmt(race * 1.32)],
    long:     [fmt(race * 1.20), fmt(race * 1.38)],
    tempo:    [fmt(race * 0.97), fmt(race * 1.05)],
    interval: [fmt(race * 0.88), fmt(race * 0.95)],
    race:     goal !== RunningGoal.GetFit ? fmt(race) : null,
  };
}

export function targetPaceForWorkout(
  type: WorkoutType,
  ability: RunningAbility,
  goal: RunningGoal,
): [string, string] | null {
  const zones = getPaceZones(ability, goal);
  switch (type) {
    case WorkoutType.Easy:      return zones.easy;
    case WorkoutType.Long:      return zones.long;
    case WorkoutType.Tempo:     return zones.tempo;
    case WorkoutType.Intervals: return zones.interval;
    case WorkoutType.Strides:   return zones.easy;
    default:                    return null;
  }
}

export function paceZoneLabel(type: WorkoutType): string {
  switch (type) {
    case WorkoutType.Easy:      return 'Easy pace';
    case WorkoutType.Long:      return 'Long run pace';
    case WorkoutType.Tempo:     return 'Tempo pace';
    case WorkoutType.Intervals: return 'Interval pace';
    case WorkoutType.Strides:   return 'Strides pace';
    default:                    return 'Pace';
  }
}
