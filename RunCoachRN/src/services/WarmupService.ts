import { WorkoutType } from '../types/enums';

export interface WarmupStep {
  name:        string;
  detail:      string;
  duration:    string;
}

export interface WarmupRoutine {
  title:         string;
  totalMinutes:  number;
  steps:         WarmupStep[];
  cooldownSteps: WarmupStep[];
}

const MOBILITY_STEPS: WarmupStep[] = [
  { name: 'Leg Swings',    detail: 'Forward & lateral, 10 each leg',  duration: '1 min' },
  { name: 'Hip Circles',   detail: 'Hands on hips, 8 each direction', duration: '1 min' },
  { name: 'Ankle Rolls',   detail: '10 circles each ankle',           duration: '30 sec' },
  { name: 'Arm Circles',   detail: 'Small to large, 10 each way',     duration: '30 sec' },
];

const EASY_COOLDOWN: WarmupStep[] = [
  { name: 'Walk it out',     detail: '5 min easy walk to flush legs',    duration: '5 min' },
  { name: 'Calf Stretch',    detail: 'Wall stretch, 30 sec each leg',    duration: '1 min' },
  { name: 'Quad Stretch',    detail: 'Standing, 30 sec each leg',        duration: '1 min' },
  { name: 'Hip Flexor',      detail: 'Lunge stretch, 30 sec each side',  duration: '1 min' },
];

const HARD_COOLDOWN: WarmupStep[] = [
  { name: 'Easy Jog',        detail: '10 min very easy to flush lactic acid', duration: '10 min' },
  { name: 'Calf Stretch',    detail: 'Wall stretch, 45 sec each leg',          duration: '1.5 min' },
  { name: 'Hamstring Stretch', detail: 'Seated reach, 45 sec each side',       duration: '1.5 min' },
  { name: 'Glute Stretch',   detail: 'Figure-4 stretch, 45 sec each',          duration: '1.5 min' },
  { name: 'Deep Breathing',  detail: '5 slow deep breaths, exhale fully',      duration: '1 min' },
];

export function getWarmupRoutine(type: WorkoutType, energyLevel?: number): WarmupRoutine {
  const low = energyLevel != null && energyLevel <= 1;

  switch (type) {
    case WorkoutType.Easy:
      return {
        title:        'Easy Run Warm-Up',
        totalMinutes: 5,
        steps: [
          { name: 'Brisk Walk',   detail: 'Start with a 3 min brisk walk',            duration: '3 min' },
          { name: 'Leg Swings',   detail: '10 forward swings each leg',                duration: '1 min' },
          { name: 'Easy Shuffle', detail: 'Very slow jog for 1 min before settling in', duration: '1 min' },
        ],
        cooldownSteps: EASY_COOLDOWN,
      };

    case WorkoutType.Long:
      return {
        title:        'Long Run Warm-Up',
        totalMinutes: 10,
        steps: [
          { name: 'Easy Jog',      detail: '8 min at effort 3/10 — just moving',       duration: '8 min' },
          ...MOBILITY_STEPS.slice(0, 2),
        ],
        cooldownSteps: EASY_COOLDOWN,
      };

    case WorkoutType.Tempo:
      return {
        title:        'Tempo Run Warm-Up',
        totalMinutes: low ? 20 : 15,
        steps: [
          { name: 'Easy Jog',      detail: `${low ? 12 : 10} min easy — get the blood moving`,  duration: `${low ? 12 : 10} min` },
          ...MOBILITY_STEPS,
          { name: 'Accelerations', detail: '4 × 20 sec pickups with 40 sec walk recovery',       duration: '4 min' },
        ],
        cooldownSteps: HARD_COOLDOWN,
      };

    case WorkoutType.Intervals:
      return {
        title:        'Interval Warm-Up',
        totalMinutes: 20,
        steps: [
          { name: 'Easy Jog',      detail: '12 min easy — don\'t rush this',    duration: '12 min' },
          ...MOBILITY_STEPS,
          { name: 'Strides',       detail: '4 × 20 sec strides, 40 sec walk',   duration: '4 min' },
        ],
        cooldownSteps: HARD_COOLDOWN,
      };

    case WorkoutType.Strides:
      return {
        title:        'Strides Warm-Up',
        totalMinutes: 8,
        steps: [
          { name: 'Easy Jog',      detail: '5 min easy jog',                    duration: '5 min' },
          ...MOBILITY_STEPS.slice(0, 2),
          { name: 'Build-Up',      detail: '1 × 30 sec gradual acceleration',   duration: '1 min' },
        ],
        cooldownSteps: EASY_COOLDOWN,
      };

    case WorkoutType.Strength:
      return {
        title:        'Strength Warm-Up',
        totalMinutes: 6,
        steps: [
          { name: 'Jump Rope / Skip',  detail: '2 min light cardio activation', duration: '2 min' },
          ...MOBILITY_STEPS,
        ],
        cooldownSteps: [
          { name: 'Static Stretching', detail: 'Full body — hold each 30 sec', duration: '5 min' },
          { name: 'Foam Rolling',      detail: 'IT band, quads, calves',        duration: '5 min' },
        ],
      };

    case WorkoutType.Mobility:
      return {
        title:        'Mobility Session',
        totalMinutes: 3,
        steps: [
          { name: 'Light Walk',    detail: '2–3 min to warm up tissue',          duration: '3 min' },
        ],
        cooldownSteps: [
          { name: 'Child\'s Pose', detail: 'Relax and breathe, 1 min',           duration: '1 min' },
        ],
      };

    default:
      return {
        title:        'Rest Day',
        totalMinutes: 0,
        steps:        [],
        cooldownSteps: [],
      };
  }
}

export function nutritionNudge(
  type: WorkoutType,
  distanceMiles?: number,
): string | null {
  switch (type) {
    case WorkoutType.Long:
      if ((distanceMiles ?? 0) >= 10) {
        return '🍌  Fuel up 2 hrs before — oats, banana, or toast. Bring a gel for runs over 60 min.';
      }
      return '🍞  Eat a light carb-based snack 1–2 hrs before. Stay hydrated.';
    case WorkoutType.Tempo:
      return '🍝  Carb-load the night before. Have a light snack 90 min pre-run. Avoid high fiber.';
    case WorkoutType.Intervals:
      return '⚡️  Easy to digest carbs 2 hrs out. Nothing heavy — your gut will thank you at rep 5.';
    case WorkoutType.Easy:
      return '💧  Stay hydrated. Easy runs are fine fasted but eat within 30 min after for recovery.';
    case WorkoutType.Strength:
      return '🥩  Protein focus today — aim for 20–30 g within 30 min post-workout to support adaptation.';
    case WorkoutType.Rest:
      return '🥗  Rest day nutrition tip: prioritize protein + greens to support muscle repair.';
    default:
      return null;
  }
}
