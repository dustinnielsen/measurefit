import {
  ExperienceLevel, InjuryRisk, RunningGoal, TrainingPhase, TrainingStyle,
  WorkoutType, experienceUsesPaceZones, goalMaxLongRunMiles,
  goalNeedsTaper, goalPeakMileageRange, injuryRiskMaxIncrease, isHardWorkout,
} from '../types/enums';
import type { PlanInput, TrainingPlan, WorkoutDay } from '../types/models';

function makeId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// MARK: - Entry point

export function generatePlan(input: PlanInput, startingOn?: Date): TrainingPlan {
  const startDate = nextMonday(startingOn ?? new Date());
  const totalWeeks = computeTotalWeeks(input);
  const volumes = computeWeeklyVolumes(input, totalWeeks);
  const days = buildAllWorkoutDays(input, startDate, volumes, totalWeeks);
  const peak = Math.max(...volumes);

  return {
    id: makeId(),
    generatedAt: new Date().toISOString(),
    startDate: startDate.toISOString(),
    totalWeeks,
    peakWeeklyMileage: peak,
    workoutDays: days,
  };
}

// MARK: - Week count

function computeTotalWeeks(input: PlanInput): number {
  if (input.goalDate && goalNeedsTaper(input.goal)) {
    const ms = input.goalDate.getTime() - new Date().getTime();
    const weeks = Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
    return Math.max(8, Math.min(24, weeks));
  }
  switch (input.goal) {
    case RunningGoal.GetFit:       return 12;
    case RunningGoal.FiveK:        return 8;
    case RunningGoal.TenK:         return 10;
    case RunningGoal.HalfMarathon: return 16;
    case RunningGoal.Marathon:     return 20;
    case RunningGoal.FasterMile:   return 10;
    default:                       return 12;
  }
}

// MARK: - Weekly volume progression

function computeWeeklyVolumes(input: PlanInput, totalWeeks: number): number[] {
  const [peakLow, peakHigh] = goalPeakMileageRange(input.goal);
  const targetPeak = (peakLow + peakHigh) / 2;
  const styleMultiplier = input.trainingStyle === TrainingStyle.Aggressive ? 1.1
    : input.trainingStyle === TrainingStyle.Conservative ? 0.9 : 1.0;
  const peak = Math.min(targetPeak * styleMultiplier, peakHigh);

  const start = Math.max(input.weeklyMileage, 10);
  const taperWeeks = goalNeedsTaper(input.goal) ? (input.goal === RunningGoal.Marathon ? 3 : 2) : 0;
  const buildWeeks = totalWeeks - taperWeeks;

  const volumes: number[] = [];
  let current = start;
  let lastBuild = start;

  for (let w = 1; w <= totalWeeks; w++) {
    if (w > buildWeeks) {
      // Taper
      const taperW = w - buildWeeks;
      const factor = taperW === 1 ? 0.75 : 0.60;
      volumes.push(Math.round(lastBuild * factor));
      continue;
    }

    if (w % 4 === 0) {
      // Deload week
      volumes.push(Math.round(current * 0.80));
      lastBuild = current;
      // Next week resumes from pre-deload level (handled at start of next iteration)
    } else {
      if (w > 1 && (w - 1) % 4 === 0) {
        // Week after deload — resume from lastBuild
        current = lastBuild;
      }
      const maxAllowed = injuryRiskMaxIncrease(input.injuryRisk, current);
      current = Math.min(maxAllowed, peak);
      volumes.push(Math.round(current));
    }
  }

  return volumes;
}

// MARK: - Day slot assignment

interface SlotAssignment {
  longRun: number;   // dayOfWeek offset 0–6
  quality: number;
  easy: number[];
  strength: number[];
}

function assignSlots(input: PlanInput): SlotAssignment {
  const { daysPerWeek, preferredLongRunDay: longRun, strengthDaysPerWeek } = input;
  const clampedDays = Math.max(3, Math.min(5, daysPerWeek));

  const taken = new Set<number>([longRun]);
  const quality = bestQualitySlot(longRun, taken);
  taken.add(quality);

  const easyCount = clampedDays - 2; // total run days minus long + quality
  const easySlots = bestEasySlots(longRun, quality, taken, easyCount);
  easySlots.forEach(s => taken.add(s));

  const strengthSlots: number[] = [];
  for (let d = 0; d < 7 && strengthSlots.length < strengthDaysPerWeek; d++) {
    if (!taken.has(d)) { strengthSlots.push(d); taken.add(d); }
  }

  return { longRun, quality, easy: easySlots, strength: strengthSlots };
}

function bestQualitySlot(longRun: number, taken: Set<number>): number {
  // Prefer 2-3 days before long run
  const candidates = [
    { offset: (longRun - 2 + 7) % 7, score: 100 },
    { offset: (longRun - 3 + 7) % 7, score: 80 },
    { offset: (longRun + 2) % 7, score: 50 },
    { offset: (longRun + 3) % 7, score: 40 },
  ];
  for (const c of candidates.sort((a, b) => b.score - a.score)) {
    if (!taken.has(c.offset)) return c.offset;
  }
  // Fallback: any non-adjacent slot
  for (let d = 0; d < 7; d++) {
    if (!taken.has(d) && Math.abs(d - longRun) >= 2) return d;
  }
  for (let d = 0; d < 7; d++) {
    if (!taken.has(d)) return d;
  }
  return (longRun + 1) % 7;
}

function bestEasySlots(longRun: number, quality: number, taken: Set<number>, count: number): number[] {
  if (count <= 0) return [];
  // Priority: day-before-long (shakeout), day-after-long (recovery), others
  const prioritized = [
    (longRun - 1 + 7) % 7,
    (longRun + 1) % 7,
  ];
  const result: number[] = [];
  for (const d of prioritized) {
    if (result.length >= count) break;
    if (!taken.has(d)) result.push(d);
  }
  for (let d = 0; d < 7 && result.length < count; d++) {
    if (!taken.has(d) && !result.includes(d)) result.push(d);
  }
  return result;
}

// MARK: - Build all workout days

function buildAllWorkoutDays(
  input: PlanInput,
  startDate: Date,
  volumes: number[],
  totalWeeks: number,
): WorkoutDay[] {
  const slots = assignSlots(input);
  const days: WorkoutDay[] = [];
  const usePaceZones = experienceUsesPaceZones(input.experienceLevel);
  const maxLongRun = goalMaxLongRunMiles(input.goal);

  for (let w = 1; w <= totalWeeks; w++) {
    const weekMiles = volumes[w - 1];
    const isDeload = w % 4 === 0;
    const phase = computePhase(w, totalWeeks, input.goal);
    const weekStart = addDays(startDate, (w - 1) * 7);

    // Long run: ~30% of weekly volume, capped
    const longDist = Math.min(maxLongRun, Math.round(weekMiles * 0.30 * 2) / 2);
    // Quality: ~20% of weekly volume
    const qualDist = Math.round(weekMiles * 0.20 * 2) / 2;
    // Easy: remaining split across easy days
    const easyTotal = weekMiles - longDist - (isDeload ? 0 : qualDist);
    const easyDist = slots.easy.length > 0
      ? Math.round((easyTotal / slots.easy.length) * 2) / 2
      : 0;

    // Long run day
    const longDate = addDays(weekStart, slots.longRun);
    days.push(makeLongRunDay(input, longDate, w, slots.longRun, longDist, phase, usePaceZones));

    // Quality day (skip in deload and first 4 beginner weeks)
    const skipQuality = isDeload || (input.experienceLevel === ExperienceLevel.Beginner && w <= 4);
    if (!skipQuality) {
      const qualDate = addDays(weekStart, slots.quality);
      days.push(makeQualityDay(input, qualDate, w, slots.quality, qualDist, phase, usePaceZones));
    }

    // Easy days
    for (const slot of slots.easy) {
      const easyDate = addDays(weekStart, slot);
      days.push(makeEasyDay(input, easyDate, w, slot, easyDist, phase, usePaceZones));
    }

    // Strength days
    for (const slot of slots.strength) {
      const strDate = addDays(weekStart, slot);
      days.push(makeStrengthDay(strDate, w, slot, phase));
    }

    // Fill remaining days as rest
    const scheduledSlots = new Set([
      slots.longRun,
      ...slots.easy,
      ...slots.strength,
      ...(skipQuality ? [] : [slots.quality]),
    ]);
    for (let d = 0; d < 7; d++) {
      if (!scheduledSlots.has(d)) {
        days.push(makeRestDay(addDays(weekStart, d), w, d, phase));
      }
    }
  }

  return days.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// MARK: - Phase computation

function computePhase(week: number, totalWeeks: number, goal: RunningGoal): TrainingPhase {
  if (week % 4 === 0) return TrainingPhase.Deload;
  const taperWeeks = goalNeedsTaper(goal) ? (goal === RunningGoal.Marathon ? 3 : 2) : 0;
  if (week > totalWeeks - taperWeeks) return TrainingPhase.Taper;
  const buildStart = Math.ceil(totalWeeks * 0.35);
  const peakStart = Math.ceil(totalWeeks * 0.70);
  if (week < buildStart) return TrainingPhase.Base;
  if (week < peakStart) return TrainingPhase.Build;
  return TrainingPhase.Peak;
}

// MARK: - Day factories

function makeLongRunDay(
  input: PlanInput, date: Date, week: number, dow: number,
  dist: number, phase: TrainingPhase, usePaceZones: boolean,
): WorkoutDay {
  const effort = usePaceZones
    ? 'Zone 2 — 70–75% max HR. Conversational the whole way.'
    : 'Effort 5–6/10. You should be able to hold a conversation throughout.';
  return {
    id: makeId(),
    date: date.toISOString(),
    weekNumber: week,
    dayOfWeek: dow,
    workoutType: WorkoutType.Long,
    distanceMiles: dist,
    workoutDescription: `${dist.toFixed(1)}-mile long run at easy aerobic pace`,
    coachingNotes: `The long run is the cornerstone of your training. ${effort} Don't go faster — the goal is time on feet, not speed.`,
    phase,
    isCompleted: false,
    isSkipped: false,
  };
}

function makeQualityDay(
  input: PlanInput, date: Date, week: number, dow: number,
  dist: number, phase: TrainingPhase, usePaceZones: boolean,
): WorkoutDay {
  // Alternate between intervals and tempo based on week
  const useIntervals = week % 2 === 1;
  const type = useIntervals ? WorkoutType.Intervals : WorkoutType.Tempo;

  let description: string;
  let notes: string;

  if (type === WorkoutType.Intervals) {
    const reps = phase === TrainingPhase.Base ? 4 : phase === TrainingPhase.Build ? 6 : 8;
    const repDist = input.goal === RunningGoal.Marathon ? '1 mile' : '800m';
    const paceNote = usePaceZones ? 'Zone 4–5' : 'effort 9/10';
    description = `15 min easy warm-up → ${reps}×${repDist} @ ${paceNote} / 2 min recovery jog → 10 min easy cool-down`;
    notes = `Interval sessions build speed and raise your lactate threshold. Run the reps hard — ${paceNote}. The recovery jog is part of the session; keep moving.`;
  } else {
    const tempoMins = phase === TrainingPhase.Base ? 20 : phase === TrainingPhase.Build ? 25 : 30;
    const paceNote = usePaceZones ? 'Zone 3–4' : 'effort 7–8/10';
    description = `15 min easy warm-up → ${tempoMins} min tempo @ ${paceNote} → 10 min easy cool-down`;
    notes = `Tempo running trains your body to sustain a hard but controlled pace. ${paceNote} — comfortably hard. If you can't speak more than 3–4 words, slow down slightly.`;
  }

  return {
    id: makeId(),
    date: date.toISOString(),
    weekNumber: week,
    dayOfWeek: dow,
    workoutType: type,
    distanceMiles: dist,
    workoutDescription: description,
    coachingNotes: notes,
    phase,
    isCompleted: false,
    isSkipped: false,
  };
}

function makeEasyDay(
  input: PlanInput, date: Date, week: number, dow: number,
  dist: number, phase: TrainingPhase, usePaceZones: boolean,
): WorkoutDay {
  const paceNote = usePaceZones ? 'Zone 2 (70–75% max HR)' : 'effort 4–5/10';
  return {
    id: makeId(),
    date: date.toISOString(),
    weekNumber: week,
    dayOfWeek: dow,
    workoutType: WorkoutType.Easy,
    distanceMiles: dist,
    workoutDescription: `${dist.toFixed(1)}-mile easy run at conversational pace`,
    coachingNotes: `Easy runs build your aerobic base without accumulating fatigue. Stay at ${paceNote}. If in doubt, go slower.`,
    phase,
    isCompleted: false,
    isSkipped: false,
  };
}

function makeStrengthDay(date: Date, week: number, dow: number, phase: TrainingPhase): WorkoutDay {
  return {
    id: makeId(),
    date: date.toISOString(),
    weekNumber: week,
    dayOfWeek: dow,
    workoutType: WorkoutType.Strength,
    durationMinutes: 30,
    workoutDescription: 'Runner-specific strength circuit: single-leg squats, hip bridges, calf raises, deadbugs',
    coachingNotes: 'Strength training reduces injury risk and improves running economy. Focus on single-leg movements and hip stability.',
    phase,
    isCompleted: false,
    isSkipped: false,
  };
}

function makeRestDay(date: Date, week: number, dow: number, phase: TrainingPhase): WorkoutDay {
  return {
    id: makeId(),
    date: date.toISOString(),
    weekNumber: week,
    dayOfWeek: dow,
    workoutType: WorkoutType.Rest,
    workoutDescription: 'Complete rest or gentle walk',
    coachingNotes: 'Rest days are when your body adapts to the training stress. Prioritise sleep, hydration, and nutrition.',
    phase,
    isCompleted: false,
    isSkipped: false,
  };
}

// MARK: - Date utilities

function nextMonday(from: Date): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=Sun, 1=Mon
  const daysUntil = dow === 1 ? 7 : (8 - dow) % 7 || 7;
  d.setDate(d.getDate() + daysUntil);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// MARK: - Profile → PlanInput bridge

import { RunningAbility } from '../types/enums';
import type { UserProfile } from '../types/models';

export function profileToPlanInput(profile: UserProfile): PlanInput {
  const expMap: Record<RunningAbility, ExperienceLevel> = {
    [RunningAbility.Beginner]: ExperienceLevel.Beginner,
    [RunningAbility.Intermediate]: ExperienceLevel.Intermediate,
    [RunningAbility.Advanced]: ExperienceLevel.Advanced,
  };

  return {
    age: profile.age,
    ability: profile.ability,
    experienceLevel: expMap[profile.ability],
    weeklyMileage: profile.weeklyMileage,
    longestRecentRun: profile.longestRecentRun,
    goal: profile.goal,
    goalDate: profile.goalDate ? new Date(profile.goalDate) : undefined,
    daysPerWeek: Math.max(3, Math.min(5, profile.runningDaysPerWeek)),
    preferredLongRunDay: profile.preferredLongRunDay,
    strengthDaysPerWeek: Math.max(0, Math.min(3, profile.strengthDaysPerWeek)),
    injuries: profile.injuries,
    trainingStyle: profile.trainingStyle,
    injuryRisk: profile.injuryRisk,
  };
}
