import {
  CompletionStatus, EnergyLevel, ExperienceLevel, InjuryRisk, InjuryType,
  PainLevel, RunningAbility, RunningGoal, SignalLevel, SleepQuality,
  TrainingPhase, TrainingStyle, WorkoutType,
} from './enums';

// MARK: - Core domain models

export interface UserProfile {
  id: string;
  age: number;
  ability: RunningAbility;
  weeklyMileage: number;
  longestRecentRun: number;
  goal: RunningGoal;
  goalDate?: string; // ISO date string
  runningDaysPerWeek: number;
  specificRunDays?: number[];  // [0=Sun…6=Sat] — explicit day picks; overrides auto-assignment
  preferredLongRunDay: number; // 0=Sun…6=Sat
  strengthDaysPerWeek: number;
  injuries: InjuryType[];
  trainingStyle: TrainingStyle;
  injuryRisk: InjuryRisk;
  createdAt: string;
  updatedAt: string;
  // Weight tracking
  weightUnit?: 'lbs' | 'kg';
  goalWeight?: number; // stored in lbs internally
  // Profile
  displayName?: string;
  avatarUri?: string;    // local file URI from image picker
}

// MARK: - Weight tracking

export interface WeightEntry {
  id: string;
  date: string;      // YYYY-MM-DD
  weight: number;    // always stored in lbs internally
  timestamp: number; // Date.now()
}

// MARK: - Races

export interface Race {
  id: string;
  name: string;
  date: string;            // YYYY-MM-DD
  distanceLabel: string;   // '5K', '10K', 'Half Marathon', 'Marathon', 'Other'
  customDistance?: string; // when distanceLabel is 'Other'
  city?: string;
  state?: string;
  bibNumber?: string;
  isCompleted: boolean;
  finishTimeSecs?: number; // actual finish time in seconds
  notes?: string;
  createdAt: string;
}

export interface TrainingPlan {
  id: string;
  generatedAt: string;
  startDate: string; // ISO date
  totalWeeks: number;
  peakWeeklyMileage: number;
  workoutDays: WorkoutDay[];
}

export interface WorkoutDay {
  id: string;
  date: string; // ISO date string
  weekNumber: number;
  dayOfWeek: number; // 0=Sun…6=Sat
  workoutType: WorkoutType;
  distanceMiles?: number;
  durationMinutes?: number;
  workoutDescription: string;
  coachingNotes: string;
  phase: TrainingPhase;
  isCompleted: boolean;
  isSkipped: boolean;
  completedAt?: string;
  userNotes?: string;
  // Adaptation fields
  adaptationNote?: string;
  preAdaptType?: WorkoutType;
  preAdaptDistance?: number;
  // GPS / actual performance
  route?: GPSPoint[];
  actualDistanceMiles?: number;
  actualDurationSeconds?: number;
  averagePaceMinPerMile?: number;
  estimatedCalories?: number;
  // Manual/ad-hoc workout (not part of generated plan)
  isManual?: boolean;
}

export interface GPSPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
  altitude?: number;
}

export interface RunFeedback {
  id: string;
  workoutDayId: string;
  recordedAt: string;
  completionStatus: CompletionStatus;
  effortRating: number; // 1–10
  painLevel: PainLevel;
  energyLevel: EnergyLevel;
  sleepQuality: SleepQuality;
}

// MARK: - Live workout session

export interface WorkoutSession {
  workoutId: string;
  startedAt: number; // Date.now()
  pausedAt?: number;
  totalPausedMs: number;
  gpsPoints: GPSPoint[];
  distanceMiles: number;
  currentPaceMinPerMile?: number;
  isActive: boolean;
}

// MARK: - Shoe tracker

export interface Shoe {
  id: string;
  brand: string;
  name: string;
  totalMiles: number;
  addedAt: string;       // ISO date
  retired: boolean;
  retiredAt?: string;
  alertMiles: number;    // warn when totalMiles exceeds this
}

// MARK: - Morning check-in / Ember Score

export interface MorningCheckin {
  date: string;          // YYYY-MM-DD
  sleepQuality: 1 | 2 | 3;   // 1=poor 2=ok 3=great
  energyLevel: 1 | 2 | 3;    // 1=low  2=normal 3=high
  stressLevel: 1 | 2 | 3;    // 1=low  2=med  3=high
}

// MARK: - Milestones

export type MilestoneId =
  | 'first_run'
  | 'miles_10' | 'miles_50' | 'miles_100' | 'miles_250' | 'miles_500'
  | 'streak_2' | 'streak_4' | 'streak_8' | 'streak_12'
  | 'first_long_run'
  | 'plan_complete';

export interface Milestone {
  id: MilestoneId;
  title: string;
  description: string;
  emoji: string;
}

// MARK: - Plan generation types

export interface PlanInput {
  age: number;
  ability: RunningAbility;
  experienceLevel: ExperienceLevel;
  weeklyMileage: number;
  longestRecentRun: number;
  goal: RunningGoal;
  goalDate?: Date;
  daysPerWeek: number;
  specificRunDays?: number[];
  preferredLongRunDay: number;
  strengthDaysPerWeek: number;
  injuries: InjuryType[];
  trainingStyle: TrainingStyle;
  injuryRisk: InjuryRisk;
}

// MARK: - Adaptation types

export interface AdaptationSignals {
  worstPain: PainLevel;
  fatigue: FatigueLevel;
  performance: PerformanceLevel;
  completionRate: number;
}

export type FatigueLevel = 'fresh' | 'normal' | 'tired' | 'high';
export type PerformanceLevel = 'struggling' | 'normal' | 'strong';

export interface WorkoutAdjustment {
  id: string;
  workoutDayId: string;
  originalType: WorkoutType;
  originalTitle: string;
  newType: WorkoutType;
  newDistanceMiles?: number;
  newTitle: string;
  newDescription: string;
  newCoachingNote: string;
  adaptationNote: string;
}

export interface AdaptationMessage {
  id: string;
  icon: string;
  text: string;
  isCritical: boolean;
}

export interface AdaptationResult {
  signalLevel: SignalLevel;
  signals: AdaptationSignals;
  adjustments: WorkoutAdjustment[];
  messages: AdaptationMessage[];
  requiresMedicalAttention: boolean;
}

// MARK: - Derived workout structure (for display)

export interface WorkoutStructure {
  warmup: string;
  mainSet: string;
  cooldown: string;
  effortCue: string;
}

export function deriveWorkoutStructure(workout: WorkoutDay): WorkoutStructure {
  const distStr = workout.distanceMiles
    ? `${workout.distanceMiles.toFixed(1)} mi`
    : 'easy miles';

  switch (workout.workoutType) {
    case WorkoutType.Easy:
      return {
        warmup: '5 min brisk walk to loosen up',
        mainSet: workout.workoutDescription || `Run ${distStr} at a fully conversational pace`,
        cooldown: '5 min walk + gentle leg swings and calf stretches',
        effortCue: 'Effort 4–5 / 10  ·  You should be able to speak in full sentences',
      };
    case WorkoutType.Long:
      return {
        warmup: '10 min easy jog — settle into a relaxed rhythm',
        mainSet: workout.workoutDescription || 'Steady long run at easy aerobic pace',
        cooldown: '10 min easy jog to flush out the legs',
        effortCue: 'Effort 5–6 / 10  ·  Comfortable but not easy',
      };
    case WorkoutType.Tempo:
      return {
        warmup: '15 min easy jog + 4×20 sec accelerations',
        mainSet: workout.workoutDescription || 'Sustained tempo effort — comfortably hard',
        cooldown: '10 min easy jog + rolling out quads and calves',
        effortCue: 'Effort 7–8 / 10  ·  Comfortably hard — broken sentences only',
      };
    case WorkoutType.Intervals:
      return {
        warmup: '15 min easy jog + 4×20 sec strides',
        mainSet: workout.workoutDescription || 'Interval reps at hard effort with recovery jog between',
        cooldown: '10–15 min easy jog + dynamic stretching',
        effortCue: 'Effort 9 / 10 on reps  ·  Recovery jogs at effort 3–4',
      };
    case WorkoutType.Strides:
      return {
        warmup: 'Easy run portion at conversation pace',
        mainSet: workout.workoutDescription || '4–6 × 20 sec strides — smooth acceleration, relaxed form',
        cooldown: 'Walk / easy jog to finish',
        effortCue: 'Strides at effort 8 / 10  ·  Fast but relaxed — not a sprint',
      };
    case WorkoutType.Strength:
      return {
        warmup: '5 min dynamic warm-up: leg swings, hip circles, arm circles',
        mainSet: workout.workoutDescription || 'Runner-specific strength circuit',
        cooldown: '5–10 min static stretching targeting hips, hamstrings, calves',
        effortCue: 'Move with control  ·  Quality over quantity on every rep',
      };
    case WorkoutType.Mobility:
      return {
        warmup: '2–3 min light movement to increase circulation',
        mainSet: workout.workoutDescription || 'Full-body mobility routine targeting running muscles',
        cooldown: 'Relax in any tight areas and breathe deeply',
        effortCue: 'Gentle effort  ·  Never force range of motion',
      };
    case WorkoutType.Walk:
      return {
        warmup: '',
        mainSet: workout.workoutDescription || `Walk ${distStr} at a comfortable pace — enjoy the fresh air.`,
        cooldown: '2–3 min gentle stretching for calves and hip flexors',
        effortCue: 'Effort 2–3 / 10  ·  Conversational and relaxed',
      };
    case WorkoutType.Rest:
      return {
        warmup: '',
        mainSet: 'Rest day. Prioritise sleep, hydration, and a nutritious meal.',
        cooldown: '',
        effortCue: 'Recovery is where fitness is built',
      };
  }
}

// MARK: - Helpers on WorkoutDay

export function workoutIsToday(w: WorkoutDay): boolean {
  const today = new Date();
  const d = new Date(w.date);
  return d.getFullYear() === today.getFullYear() &&
         d.getMonth() === today.getMonth() &&
         d.getDate() === today.getDate();
}

export function workoutIsPast(w: WorkoutDay): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(w.date) < today;
}

export function workoutSummaryLine(w: WorkoutDay): string {
  if (w.actualDistanceMiles) return `${w.actualDistanceMiles.toFixed(1)} mi`;
  if (w.distanceMiles) return `${w.distanceMiles.toFixed(1)} mi`;
  if (w.durationMinutes) return `${w.durationMinutes} min`;
  return WORKOUT_LABELS[w.workoutType] ?? w.workoutType;
}

// circular import workaround
import { WORKOUT_LABELS } from './enums';
