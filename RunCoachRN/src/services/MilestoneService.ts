import type { Milestone, MilestoneId, TrainingPlan } from '../types/models';
import { WorkoutType } from '../types/enums';

export const MILESTONES: Record<MilestoneId, Milestone> = {
  first_run:      { id: 'first_run',      title: 'First Spark',       description: 'Completed your first run',          emoji: '🔥' },
  miles_10:       { id: 'miles_10',       title: '10 Miles In',       description: 'Logged 10 total miles',             emoji: '🏃' },
  miles_50:       { id: 'miles_50',       title: '50 Miles In',       description: 'Logged 50 total miles',             emoji: '🌟' },
  miles_100:      { id: 'miles_100',      title: 'Century Runner',    description: 'Logged 100 total miles',            emoji: '💯' },
  miles_250:      { id: 'miles_250',      title: '250 Miles Strong',  description: 'Logged 250 total miles',            emoji: '🏅' },
  miles_500:      { id: 'miles_500',      title: '500 Mile Club',     description: 'Logged 500 total miles',            emoji: '🏆' },
  streak_2:       { id: 'streak_2',       title: '2-Week Streak',     description: 'Trained consistently for 2 weeks',  emoji: '⚡️' },
  streak_4:       { id: 'streak_4',       title: '4-Week Streak',     description: 'Trained consistently for 4 weeks',  emoji: '🔥' },
  streak_8:       { id: 'streak_8',       title: '8-Week Streak',     description: 'Trained consistently for 8 weeks',  emoji: '🌠' },
  streak_12:      { id: 'streak_12',      title: '12-Week Streak',    description: 'Trained consistently for 12 weeks', emoji: '💎' },
  first_long_run: { id: 'first_long_run', title: 'Going Long',        description: 'Completed your first long run',     emoji: '🛣️' },
  plan_complete:  { id: 'plan_complete',  title: 'Plan Complete',     description: 'Finished your entire training plan', emoji: '🎉' },
};

export function checkNewMilestones(
  plan: TrainingPlan,
  earnedIds: string[],
): MilestoneId[] {
  const newly: MilestoneId[] = [];

  const completed = plan.workoutDays.filter(w => w.isCompleted);
  const totalMiles = completed.reduce(
    (s, w) => s + (w.actualDistanceMiles ?? w.distanceMiles ?? 0), 0,
  );
  const runs = completed.filter(
    w => w.workoutType !== WorkoutType.Rest &&
         w.workoutType !== WorkoutType.Strength &&
         w.workoutType !== WorkoutType.Mobility,
  );

  function check(id: MilestoneId, cond: boolean) {
    if (cond && !earnedIds.includes(id)) newly.push(id);
  }

  check('first_run',      runs.length >= 1);
  check('first_long_run', completed.some(w => w.workoutType === WorkoutType.Long));
  check('miles_10',       totalMiles >= 10);
  check('miles_50',       totalMiles >= 50);
  check('miles_100',      totalMiles >= 100);
  check('miles_250',      totalMiles >= 250);
  check('miles_500',      totalMiles >= 500);

  // Streak: consecutive weeks with ≥1 completed run
  const currentWeekNum = weekNumber(plan);
  let streak = 0;
  for (let w = currentWeekNum; w >= 1; w--) {
    const hasRun = plan.workoutDays
      .filter(d => d.weekNumber === w)
      .some(d => d.isCompleted && d.workoutType !== WorkoutType.Rest);
    if (!hasRun) break;
    streak++;
  }
  check('streak_2',  streak >= 2);
  check('streak_4',  streak >= 4);
  check('streak_8',  streak >= 8);
  check('streak_12', streak >= 12);

  check('plan_complete', plan.workoutDays.every(
    w => w.isCompleted || w.isSkipped || w.workoutType === WorkoutType.Rest,
  ));

  return newly;
}

function weekNumber(plan: TrainingPlan): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(plan.startDate); start.setHours(0, 0, 0, 0);
  const days  = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, Math.min(plan.totalWeeks, Math.floor(days / 7) + 1));
}

export function emberScore(
  sleepQuality: 1 | 2 | 3,
  energyLevel: 1 | 2 | 3,
  stressLevel: 1 | 2 | 3,
): number {
  // Range: 7–21 → normalize to 0–100
  const raw = sleepQuality * 3 + energyLevel * 2 + (4 - stressLevel) * 2;
  return Math.round(((raw - 7) / 14) * 100);
}

export function emberScoreLabel(score: number): string {
  if (score >= 80) return 'Ready to fly';
  if (score >= 60) return 'Good to go';
  if (score >= 40) return 'Take it easy';
  return 'Rest up';
}

export function emberScoreColor(score: number): string {
  if (score >= 80) return '#30D158'; // green
  if (score >= 60) return '#FF9F0A'; // amber
  if (score >= 40) return '#FF9F0A'; // amber
  return '#FF453A'; // red
}

export function predictRaceTime(
  goalDistanceLabel: string,
  bestMileage: number,
  bestPaceMinPerMile: number,
): string | null {
  if (bestPaceMinPerMile <= 0 || bestMileage <= 0) return null;

  // Riegel formula: T2 = T1 × (D2/D1)^1.06
  const goalDistances: Record<string, number> = {
    FiveK: 3.107, TenK: 6.214, HalfMarathon: 13.1, Marathon: 26.2, FasterMile: 1,
    Ultra50: 50, Ultra100: 100,
  };
  const target = goalDistances[goalDistanceLabel];
  if (!target) return null;

  const t1 = bestMileage * bestPaceMinPerMile;   // best effort time in minutes
  const t2 = t1 * Math.pow(target / bestMileage, 1.06);

  const hours = Math.floor(t2 / 60);
  const mins  = Math.floor(t2 % 60);
  const secs  = Math.round((t2 - Math.floor(t2)) * 60);

  if (hours > 0) return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}
