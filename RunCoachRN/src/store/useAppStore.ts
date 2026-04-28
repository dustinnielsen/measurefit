import { create } from 'zustand';
import { StorageService } from '../services/StorageService';
import { generatePlan, profileToPlanInput } from '../services/TrainingPlanGenerator';
import { analyze, applyAdjustments } from '../services/AdaptationEngine';
import type {
  GPSPoint, RunFeedback, TrainingPlan, UserProfile, WorkoutDay, WorkoutSession,
} from '../types/models';

function makeId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface AppState {
  // Core data
  profile:  UserProfile | null;
  plan:     TrainingPlan | null;
  feedback: RunFeedback[];

  // Live workout session
  session: WorkoutSession | null;

  // Loading flag
  isLoaded: boolean;

  // ── Profile ──────────────────────────────────────────────
  setProfile: (p: UserProfile) => Promise<void>;

  // ── Plan ─────────────────────────────────────────────────
  generateAndSavePlan: () => Promise<void>;
  updateWorkout: (id: string, patch: Partial<WorkoutDay>) => Promise<void>;

  // ── Feedback + adaptation ────────────────────────────────
  addFeedback: (f: RunFeedback) => Promise<void>;

  // ── Live session ─────────────────────────────────────────
  startSession:  (workoutId: string) => void;
  pauseSession:  () => void;
  resumeSession: () => void;
  tickSession:   () => void;               // call every second from a timer
  updateSessionGPS: (point: GPSPoint, distanceMiles: number, pace?: number) => void;
  endSession:    () => WorkoutSession | null;

  // ── Persistence ──────────────────────────────────────────
  loadFromStorage: () => Promise<void>;
  clearAllData:    () => Promise<void>;
}

// ── Computed helpers ──────────────────────────────────────

export function currentWeekNumber(plan: TrainingPlan): number {
  const today = new Date(); today.setHours(0,0,0,0);
  const start = new Date(plan.startDate); start.setHours(0,0,0,0);
  const days  = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, Math.min(plan.totalWeeks, Math.floor(days / 7) + 1));
}

export function workoutsForWeek(plan: TrainingPlan, week: number): WorkoutDay[] {
  return plan.workoutDays
    .filter(w => w.weekNumber === week)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

export function todayWorkout(plan: TrainingPlan): WorkoutDay | null {
  const today = new Date();
  return plan.workoutDays.find(w => {
    const d = new Date(w.date);
    return d.getFullYear() === today.getFullYear() &&
           d.getMonth()    === today.getMonth()    &&
           d.getDate()     === today.getDate();
  }) ?? null;
}

export function weeklyMileage(plan: TrainingPlan, week: number): number {
  return workoutsForWeek(plan, week)
    .reduce((sum, w) => sum + (w.distanceMiles ?? 0), 0);
}

export function completedMilesThisWeek(plan: TrainingPlan): number {
  const week = currentWeekNumber(plan);
  return workoutsForWeek(plan, week)
    .filter(w => w.isCompleted)
    .reduce((sum, w) => sum + (w.actualDistanceMiles ?? w.distanceMiles ?? 0), 0);
}

// ── Store ─────────────────────────────────────────────────

export const useAppStore = create<AppState>((set, get) => ({
  profile:  null,
  plan:     null,
  feedback: [],
  session:  null,
  isLoaded: false,

  // ── Profile ───────────────────────────────────────────────
  setProfile: async (p) => {
    set({ profile: p });
    await StorageService.saveProfile(p);
  },

  // ── Plan ──────────────────────────────────────────────────
  generateAndSavePlan: async () => {
    const { profile } = get();
    if (!profile) return;
    const input = profileToPlanInput(profile);
    const plan  = generatePlan(input);
    set({ plan });
    await StorageService.savePlan(plan);
  },

  updateWorkout: async (id, patch) => {
    const { plan } = get();
    if (!plan) return;
    const updated: TrainingPlan = {
      ...plan,
      workoutDays: plan.workoutDays.map(w => w.id === id ? { ...w, ...patch } : w),
    };
    set({ plan: updated });
    await StorageService.savePlan(updated);
  },

  // ── Feedback + adaptation ─────────────────────────────────
  addFeedback: async (fb) => {
    const { feedback, plan } = get();
    const newFeedback = [...feedback, fb];
    set({ feedback: newFeedback });
    await StorageService.saveFeedback(newFeedback);

    if (!plan) return;

    // Run adaptation on next 7 days of uncompleted workouts
    const now = new Date(); now.setHours(0,0,0,0);
    const horizon = new Date(now); horizon.setDate(horizon.getDate() + 7);
    const upcoming = plan.workoutDays.filter(w => {
      const d = new Date(w.date);
      return d >= now && d <= horizon && !w.isCompleted && !w.isSkipped;
    });

    const result = analyze(newFeedback, upcoming);
    if (result.adjustments.length === 0) return;

    const adapted = applyAdjustments(result.adjustments, plan.workoutDays);
    const updatedPlan: TrainingPlan = { ...plan, workoutDays: adapted };
    set({ plan: updatedPlan });
    await StorageService.savePlan(updatedPlan);
  },

  // ── Live session ──────────────────────────────────────────
  startSession: (workoutId) => {
    set({
      session: {
        workoutId,
        startedAt:      Date.now(),
        totalPausedMs:  0,
        gpsPoints:      [],
        distanceMiles:  0,
        isActive:       true,
      },
    });
  },

  pauseSession: () => {
    const { session } = get();
    if (!session || !session.isActive) return;
    set({ session: { ...session, isActive: false, pausedAt: Date.now() } });
  },

  resumeSession: () => {
    const { session } = get();
    if (!session || session.isActive) return;
    const extraPause = session.pausedAt ? Date.now() - session.pausedAt : 0;
    set({
      session: {
        ...session,
        isActive:      true,
        pausedAt:      undefined,
        totalPausedMs: session.totalPausedMs + extraPause,
      },
    });
  },

  tickSession: () => {
    // No-op: elapsed time is computed from startedAt on the fly
  },

  updateSessionGPS: (point, distanceMiles, pace) => {
    const { session } = get();
    if (!session) return;
    set({
      session: {
        ...session,
        gpsPoints:            [...session.gpsPoints, point],
        distanceMiles,
        currentPaceMinPerMile: pace,
      },
    });
  },

  endSession: () => {
    const { session } = get();
    set({ session: null });
    return session;
  },

  // ── Persistence ───────────────────────────────────────────
  loadFromStorage: async () => {
    const [profile, plan, feedback] = await Promise.all([
      StorageService.loadProfile(),
      StorageService.loadPlan(),
      StorageService.loadFeedback(),
    ]);
    set({
      profile:  profile  ?? null,
      plan:     plan     ?? null,
      feedback: feedback ?? [],
      isLoaded: true,
    });
  },

  clearAllData: async () => {
    await StorageService.clearAll();
    set({ profile: null, plan: null, feedback: [], session: null });
  },
}));

// ── Selectors (use these in components) ──────────────────

export const selectElapsedSeconds = (session: WorkoutSession | null): number => {
  if (!session) return 0;
  const running = Date.now() - session.startedAt - session.totalPausedMs;
  return Math.floor(running / 1000);
};
