import {
  CompletionStatus, EnergyLevel, PainLevel, SignalLevel, SleepQuality,
  WorkoutType, completionWeight, isHardWorkout, isRunWorkout, painRank,
} from '../types/enums';
import type {
  AdaptationMessage, AdaptationResult, AdaptationSignals,
  FatigueLevel, PerformanceLevel, RunFeedback, WorkoutAdjustment, WorkoutDay,
} from '../types/models';

function makeId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// MARK: - Entry point

export function analyze(
  recentFeedback: RunFeedback[],
  upcomingWorkouts: WorkoutDay[],
): AdaptationResult {
  const signals = computeSignals(recentFeedback);
  const signalLevel = overallLevel(signals);
  const adjustments = generateAdjustments(signals, signalLevel, upcomingWorkouts);
  const messages = buildMessages(signals, signalLevel, adjustments);
  return {
    signalLevel,
    signals,
    adjustments,
    messages,
    requiresMedicalAttention: signals.worstPain === PainLevel.Sharp,
  };
}

// MARK: - Apply adjustments

export function applyAdjustments(
  adjustments: WorkoutAdjustment[],
  workouts: WorkoutDay[],
): WorkoutDay[] {
  return workouts.map(w => {
    const adj = adjustments.find(a => a.workoutDayId === w.id);
    if (!adj) return w;
    return {
      ...w,
      ...(w.preAdaptType === undefined ? { preAdaptType: w.workoutType, preAdaptDistance: w.distanceMiles } : {}),
      workoutType: adj.newType,
      ...(adj.newDistanceMiles !== undefined ? { distanceMiles: adj.newDistanceMiles } : {}),
      workoutDescription: adj.newDescription,
      coachingNotes: adj.newCoachingNote,
      adaptationNote: adj.adaptationNote,
    };
  });
}

// MARK: - Signal computation

function computeSignals(feedback: RunFeedback[]): AdaptationSignals {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;

  const recent = feedback.filter(f => new Date(f.recordedAt).getTime() >= sevenDaysAgo);
  const last3 = feedback.filter(f => new Date(f.recordedAt).getTime() >= threeDaysAgo);

  return {
    worstPain: worstPain(last3),
    fatigue: fatigueLevel(recent),
    performance: performanceLevel(recent),
    completionRate: completionRate(recent),
  };
}

function worstPain(feedback: RunFeedback[]): PainLevel {
  if (feedback.length === 0) return PainLevel.None;
  return feedback.reduce((worst, f) =>
    painRank(f.painLevel) > painRank(worst) ? f.painLevel : worst,
    PainLevel.None
  );
}

function fatigueLevel(feedback: RunFeedback[]): FatigueLevel {
  let pts = 0;

  // Easy runs that felt hard
  const easyFeedback = feedback.filter(f => f.effortRating <= 6 && !isHardFeedback(f));
  for (const fb of easyFeedback) {
    if (fb.effortRating >= 8) pts += 2;
    else if (fb.effortRating >= 7) pts += 1;
  }

  pts += feedback.filter(f => f.energyLevel === EnergyLevel.Low).length;
  pts += feedback.filter(f => f.sleepQuality === SleepQuality.Poor).length;

  if (pts === 0) return 'fresh';
  if (pts === 1) return 'normal';
  if (pts <= 3) return 'tired';
  return 'high';
}

function isHardFeedback(f: RunFeedback): boolean {
  // Heuristic: effort >= 7 suggests a quality session
  return f.effortRating >= 7;
}

function performanceLevel(feedback: RunFeedback[]): PerformanceLevel {
  const lowEnergyCount = feedback.filter(f => f.energyLevel === EnergyLevel.Low).length;
  const hardEasyRuns = feedback.filter(f => !isHardFeedback(f) && f.effortRating >= 8).length;

  if (hardEasyRuns >= 2) return 'struggling';
  if (lowEnergyCount >= 3) return 'struggling';

  const highEnergyCount = feedback.filter(f => f.energyLevel === EnergyLevel.High).length;
  const goodSleepCount = feedback.filter(f => f.sleepQuality === SleepQuality.Good).length;
  const hardSessionsEasy = feedback.filter(f => isHardFeedback(f) && f.effortRating <= 6).length;

  if (hardSessionsEasy >= 1 && highEnergyCount >= 2 && goodSleepCount >= 2) return 'strong';
  return 'normal';
}

function completionRate(feedback: RunFeedback[]): number {
  if (feedback.length === 0) return 1.0;
  const total = feedback.map(f => completionWeight(f.completionStatus)).reduce((a, b) => a + b, 0);
  return total / feedback.length;
}

// MARK: - Signal level

function overallLevel(signals: AdaptationSignals): SignalLevel {
  switch (signals.worstPain) {
    case PainLevel.Sharp:    return SignalLevel.Danger;
    case PainLevel.Moderate: return SignalLevel.Concern;
    case PainLevel.Mild:
      return signals.fatigue === 'high' ? SignalLevel.Concern : SignalLevel.Caution;
    default: break;
  }

  if (signals.fatigue === 'high')  return SignalLevel.Concern;
  if (signals.fatigue === 'tired') return SignalLevel.Caution;
  if (signals.completionRate < 0.40) return SignalLevel.Caution;
  return SignalLevel.Ok;
}

// MARK: - Adjustment generation

function generateAdjustments(
  signals: AdaptationSignals,
  level: SignalLevel,
  upcoming: WorkoutDay[],
): WorkoutAdjustment[] {
  const adjustments: WorkoutAdjustment[] = [];
  const adjustedIds = new Set<string>();

  switch (level) {
    case SignalLevel.Danger: {
      for (const w of upcoming) {
        if (!isHardWorkout(w.workoutType) || adjustedIds.has(w.id)) continue;
        const newDist = (w.distanceMiles ?? 4) * 0.90;
        adjustments.push(makeAdjustment(w, WorkoutType.Easy, newDist,
          'Sharp pain reported',
          'Session replaced with easy run. Sharp pain is a stop signal. If pain persists beyond 2 days, see a doctor.'));
        adjustedIds.add(w.id);
      }
      const longRun = upcoming.find(w => w.workoutType === WorkoutType.Long && !adjustedIds.has(w.id));
      if (longRun) {
        const newDist = Math.max(2, (longRun.distanceMiles ?? 6) * 0.70);
        adjustments.push(makeAdjustment(longRun, WorkoutType.Easy, newDist,
          'Sharp pain reported',
          'Long run replaced with a shorter easy run. Your body needs to recover — the miles will be there when you are.'));
        adjustedIds.add(longRun.id);
      }
      break;
    }

    case SignalLevel.Concern: {
      for (const w of upcoming) {
        if (!isHardWorkout(w.workoutType) || adjustedIds.has(w.id)) continue;
        const reason = painRank(signals.worstPain) >= painRank(PainLevel.Moderate)
          ? 'Moderate pain reported' : 'High fatigue detected';
        const note = painRank(signals.worstPain) >= painRank(PainLevel.Moderate)
          ? 'Speed work removed due to reported pain. Easy running only until pain resolves.'
          : 'Quality session replaced with easy run. High fatigue means more intensity would deepen the hole.';
        adjustments.push(makeAdjustment(w, WorkoutType.Easy, w.distanceMiles, reason, note));
        adjustedIds.add(w.id);
      }
      const longRun = upcoming.find(w => w.workoutType === WorkoutType.Long && !adjustedIds.has(w.id));
      if (longRun) {
        const reduction = painRank(signals.worstPain) >= painRank(PainLevel.Moderate) ? 0.85 : 0.90;
        const newDist = Math.max(3, (longRun.distanceMiles ?? 6) * reduction);
        adjustments.push(makeAdjustment(longRun, WorkoutType.Long, newDist,
          painRank(signals.worstPain) >= painRank(PainLevel.Moderate) ? 'Moderate pain reported' : 'High fatigue detected',
          'Long run shortened. A slightly shorter run still builds aerobic base — a shorter run beats no run.'));
        adjustedIds.add(longRun.id);
      }
      break;
    }

    case SignalLevel.Caution: {
      for (const w of upcoming) {
        if (w.workoutType !== WorkoutType.Intervals || adjustedIds.has(w.id)) continue;
        const reason = signals.worstPain === PainLevel.Mild
          ? 'Mild pain reported' : 'Elevated fatigue detected';
        adjustments.push(makeAdjustment(w, WorkoutType.Tempo, w.distanceMiles, reason,
          'Interval session replaced with a tempo run. A controlled steady effort provides the stimulus without the impact of hard reps.'));
        adjustedIds.add(w.id);
      }
      break;
    }

    default: break;
  }

  return adjustments;
}

function makeAdjustment(
  workout: WorkoutDay,
  newType: WorkoutType,
  newDist: number | undefined,
  reason: string,
  coachNote: string,
): WorkoutAdjustment {
  const title = newDist
    ? `${WORKOUT_LABELS[newType]} — ${newDist.toFixed(1)} mi`
    : WORKOUT_LABELS[newType];
  return {
    id: makeId(),
    workoutDayId: workout.id,
    originalType: workout.workoutType,
    originalTitle: workout.workoutDescription,
    newType,
    newDistanceMiles: newDist,
    newTitle: title,
    newDescription: title,
    newCoachingNote: coachNote,
    adaptationNote: reason,
  };
}

// MARK: - Message generation

function buildMessages(
  signals: AdaptationSignals,
  level: SignalLevel,
  adjustments: WorkoutAdjustment[],
): AdaptationMessage[] {
  const msgs: AdaptationMessage[] = [];

  switch (level) {
    case SignalLevel.Danger:
      msgs.push({ id: makeId(), icon: 'exclamationmark.octagon.fill', isCritical: true,
        text: 'Sharp pain is a stop signal. All speed work has been removed from the next 7 days.' });
      msgs.push({ id: makeId(), icon: 'stethoscope', isCritical: true,
        text: 'If pain persists for more than 2 days, consult a doctor before resuming training.' });
      break;
    case SignalLevel.Concern:
      if (painRank(signals.worstPain) >= painRank(PainLevel.Moderate)) {
        msgs.push({ id: makeId(), icon: 'exclamationmark.triangle.fill', isCritical: true,
          text: 'Moderate pain detected. Speed work removed for the next 7 days.' });
      } else {
        msgs.push({ id: makeId(), icon: 'bolt.slash.fill', isCritical: false,
          text: 'High fatigue detected. Quality sessions replaced with easy running.' });
      }
      msgs.push({ id: makeId(), icon: 'bed.double.fill', isCritical: false,
        text: 'Prioritise sleep and nutrition this week. Adaptation happens during recovery.' });
      break;
    case SignalLevel.Caution:
      msgs.push({ id: makeId(), icon: 'arrow.down.circle.fill', isCritical: false,
        text: signals.worstPain === PainLevel.Mild
          ? 'Mild discomfort reported. Interval sessions downgraded to tempo runs.'
          : 'Elevated fatigue detected. Intervals replaced with tempo runs this week.' });
      break;
    case SignalLevel.Ok:
      if (signals.performance === 'strong') {
        msgs.push({ id: makeId(), icon: 'checkmark.seal.fill', isCritical: false,
          text: "You're adapting well. No adjustments needed — stay the course." });
      } else if (adjustments.length === 0) {
        msgs.push({ id: makeId(), icon: 'checkmark.circle.fill', isCritical: false,
          text: 'All signals look good. No changes to your plan.' });
      }
      break;
  }

  return msgs;
}

import { WORKOUT_LABELS } from '../types/enums';
