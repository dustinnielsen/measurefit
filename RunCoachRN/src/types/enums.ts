export enum RunningAbility {
  Beginner = 'beginner',
  Intermediate = 'intermediate',
  Advanced = 'advanced',
}

export enum RunningGoal {
  GetFit = 'getFit',
  FiveK = 'fiveK',
  TenK = 'tenK',
  HalfMarathon = 'halfMarathon',
  Marathon = 'marathon',
  FasterMile = 'fasterMile',
  Ultra50 = 'ultra50',
  Ultra100 = 'ultra100',
}

export enum TrainingStyle {
  Conservative = 'conservative',
  Balanced = 'balanced',
  Aggressive = 'aggressive',
}

export enum WorkoutType {
  Easy = 'easy',
  Long = 'long',
  Tempo = 'tempo',
  Intervals = 'intervals',
  Strides = 'strides',
  Rest = 'rest',
  Strength = 'strength',
  Mobility = 'mobility',
  Walk = 'walk',
}

export enum InjuryType {
  None = 'none',
  Knee = 'knee',
  ITBand = 'itBand',
  ShinSplints = 'shinSplints',
  PlantarFasciitis = 'plantarFasciitis',
  Hip = 'hip',
  Back = 'back',
  Hamstring = 'hamstring',
  Other = 'other',
}

export enum TrainingPhase {
  Base = 'base',
  Build = 'build',
  Peak = 'peak',
  Taper = 'taper',
  Deload = 'deload',
}

export enum InjuryRisk {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

export enum ExperienceLevel {
  Beginner = 'beginner',
  Intermediate = 'intermediate',
  Advanced = 'advanced',
}

export enum CompletionStatus {
  Completed = 'completed',
  Partial = 'partial',
  Skipped = 'skipped',
}

export enum PainLevel {
  None = 'none',
  Mild = 'mild',
  Moderate = 'moderate',
  Sharp = 'sharp',
}

export enum EnergyLevel {
  Low = 'low',
  Normal = 'normal',
  High = 'high',
}

export enum SleepQuality {
  Poor = 'poor',
  Ok = 'ok',
  Good = 'good',
}

export enum SignalLevel {
  Ok = 'ok',
  Caution = 'caution',
  Concern = 'concern',
  Danger = 'danger',
}

// MARK: - Label / display helpers

export const ABILITY_LABELS: Record<RunningAbility, string> = {
  [RunningAbility.Beginner]: 'Beginner',
  [RunningAbility.Intermediate]: 'Intermediate',
  [RunningAbility.Advanced]: 'Advanced',
};

export const ABILITY_DESCRIPTIONS: Record<RunningAbility, string> = {
  [RunningAbility.Beginner]: 'Running less than 6 months or under 15 mi/week',
  [RunningAbility.Intermediate]: '1–3 years of consistent running, 15–35 mi/week',
  [RunningAbility.Advanced]: '3+ years, racing regularly, 35+ mi/week',
};

export const GOAL_LABELS: Record<RunningGoal, string> = {
  [RunningGoal.GetFit]: 'Get Fit',
  [RunningGoal.FiveK]: 'Run a 5K',
  [RunningGoal.TenK]: 'Run a 10K',
  [RunningGoal.HalfMarathon]: 'Half Marathon',
  [RunningGoal.Marathon]: 'Marathon',
  [RunningGoal.FasterMile]: 'Faster Mile',
  [RunningGoal.Ultra50]: '50-Mile Ultra',
  [RunningGoal.Ultra100]: '100-Mile Ultra',
};

export const GOAL_EMOJIS: Record<RunningGoal, string> = {
  [RunningGoal.GetFit]: '💪',
  [RunningGoal.FiveK]: '🏁',
  [RunningGoal.TenK]: '🎽',
  [RunningGoal.HalfMarathon]: '🏅',
  [RunningGoal.Marathon]: '🏆',
  [RunningGoal.FasterMile]: '⚡️',
  [RunningGoal.Ultra50]: '🌄',
  [RunningGoal.Ultra100]: '🦅',
};

export const WORKOUT_LABELS: Record<WorkoutType, string> = {
  [WorkoutType.Easy]: 'Easy Run',
  [WorkoutType.Long]: 'Long Run',
  [WorkoutType.Tempo]: 'Tempo Run',
  [WorkoutType.Intervals]: 'Intervals',
  [WorkoutType.Strides]: 'Easy + Strides',
  [WorkoutType.Rest]: 'Rest',
  [WorkoutType.Strength]: 'Strength',
  [WorkoutType.Mobility]: 'Mobility',
  [WorkoutType.Walk]: 'Walk',
};

export const WORKOUT_EMOJIS: Record<WorkoutType, string> = {
  [WorkoutType.Easy]: '🏃',
  [WorkoutType.Long]: '🛣️',
  [WorkoutType.Tempo]: '⏱️',
  [WorkoutType.Intervals]: '⚡️',
  [WorkoutType.Strides]: '💨',
  [WorkoutType.Rest]: '😴',
  [WorkoutType.Strength]: '🏋️',
  [WorkoutType.Mobility]: '🧘',
  [WorkoutType.Walk]: '🚶',
};

export const PHASE_LABELS: Record<TrainingPhase, string> = {
  [TrainingPhase.Base]: 'Base',
  [TrainingPhase.Build]: 'Build',
  [TrainingPhase.Peak]: 'Peak',
  [TrainingPhase.Taper]: 'Taper',
  [TrainingPhase.Deload]: 'Recovery',
};

export const INJURY_LABELS: Record<InjuryType, string> = {
  [InjuryType.None]: 'None',
  [InjuryType.Knee]: 'Knee',
  [InjuryType.ITBand]: 'IT Band',
  [InjuryType.ShinSplints]: 'Shin Splints',
  [InjuryType.PlantarFasciitis]: 'Plantar Fasciitis',
  [InjuryType.Hip]: 'Hip',
  [InjuryType.Back]: 'Back',
  [InjuryType.Hamstring]: 'Hamstring',
  [InjuryType.Other]: 'Other',
};

export const TRAINING_STYLE_LABELS: Record<TrainingStyle, string> = {
  [TrainingStyle.Conservative]: 'Conservative',
  [TrainingStyle.Balanced]: 'Balanced',
  [TrainingStyle.Aggressive]: 'Aggressive',
};

export const TRAINING_STYLE_DESCRIPTIONS: Record<TrainingStyle, string> = {
  [TrainingStyle.Conservative]: 'Safety first. Slower progression, more rest. Best for injury-prone runners.',
  [TrainingStyle.Balanced]: 'Standard approach. Steady progress with adequate recovery.',
  [TrainingStyle.Aggressive]: 'Push your limits. Faster progression for experienced, healthy runners.',
};

// MARK: - Type helpers

export function isHardWorkout(type: WorkoutType): boolean {
  return type === WorkoutType.Tempo || type === WorkoutType.Intervals;
}

export function isRunWorkout(type: WorkoutType): boolean {
  return [WorkoutType.Easy, WorkoutType.Long, WorkoutType.Tempo,
          WorkoutType.Intervals, WorkoutType.Strides, WorkoutType.Walk].includes(type);
}

export function painRank(level: PainLevel): number {
  const ranks: Record<PainLevel, number> = {
    [PainLevel.None]: 0,
    [PainLevel.Mild]: 1,
    [PainLevel.Moderate]: 2,
    [PainLevel.Sharp]: 3,
  };
  return ranks[level];
}

export function completionWeight(status: CompletionStatus): number {
  const weights: Record<CompletionStatus, number> = {
    [CompletionStatus.Completed]: 1.0,
    [CompletionStatus.Partial]: 0.5,
    [CompletionStatus.Skipped]: 0.0,
  };
  return weights[status];
}

export function goalPeakMileageRange(goal: RunningGoal): [number, number] {
  const ranges: Record<RunningGoal, [number, number]> = {
    [RunningGoal.GetFit]: [20, 30],
    [RunningGoal.FiveK]: [20, 30],
    [RunningGoal.TenK]: [25, 35],
    [RunningGoal.HalfMarathon]: [35, 45],
    [RunningGoal.Marathon]: [45, 55],
    [RunningGoal.FasterMile]: [20, 30],
    [RunningGoal.Ultra50]:  [55, 70],
    [RunningGoal.Ultra100]: [65, 80],
  };
  return ranges[goal];
}

export function goalMaxLongRunMiles(goal: RunningGoal): number {
  const max: Record<RunningGoal, number> = {
    [RunningGoal.GetFit]: 10,
    [RunningGoal.FiveK]: 8,
    [RunningGoal.TenK]: 10,
    [RunningGoal.HalfMarathon]: 14,
    [RunningGoal.Marathon]: 22,
    [RunningGoal.FasterMile]: 8,
    [RunningGoal.Ultra50]:  32,
    [RunningGoal.Ultra100]: 40,
  };
  return max[goal];
}

export function goalNeedsTaper(goal: RunningGoal): boolean {
  return [RunningGoal.HalfMarathon, RunningGoal.Marathon,
          RunningGoal.Ultra50, RunningGoal.Ultra100].includes(goal);
}

export function isUltraGoal(goal: RunningGoal): boolean {
  return goal === RunningGoal.Ultra50 || goal === RunningGoal.Ultra100;
}

export function injuryRiskMaxIncrease(risk: InjuryRisk, base: number): number {
  const factors: Record<InjuryRisk, number> = {
    [InjuryRisk.Low]: 1.10,
    [InjuryRisk.Medium]: 1.07,
    [InjuryRisk.High]: 1.05,
  };
  return base * factors[risk];
}

export function experienceUsesPaceZones(level: ExperienceLevel): boolean {
  return level !== ExperienceLevel.Beginner;
}
