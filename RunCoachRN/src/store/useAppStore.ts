import { create } from 'zustand';
import { StorageService } from '../services/StorageService';
import { generatePlan, profileToPlanInput } from '../services/TrainingPlanGenerator';
import { analyze, applyAdjustments } from '../services/AdaptationEngine';
import { NotificationService } from '../services/NotificationService';
import { WorkoutType } from '../types/enums';
import type {
  GPSPoint, MilestoneId, MorningCheckin, Race, RunFeedback, Shoe,
  TrainingPlan, UserProfile, WeightEntry, WorkoutDay, WorkoutSession,
} from '../types/models';

function makeId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface AppState {
  // Core data
  profile:  UserProfile | null;
  plan:     TrainingPlan | null;
  feedback: RunFeedback[];

  // Extended data
  shoes:            Shoe[];
  earnedMilestones: string[];
  morningCheckin:   MorningCheckin | null;
  weightEntries:    WeightEntry[];
  races:            Race[];

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

  // ── Shoes ────────────────────────────────────────────────
  addShoe:    (shoe: Omit<Shoe, 'id' | 'addedAt' | 'totalMiles'>) => Promise<void>;
  retireShoe: (id: string) => Promise<void>;
  logShoeRun: (id: string, miles: number) => Promise<void>;

  // ── Morning check-in ─────────────────────────────────────
  setMorningCheckin: (c: MorningCheckin) => Promise<void>;

  // ── Milestones ────────────────────────────────────────────
  earnMilestone: (id: MilestoneId) => Promise<void>;

  // ── Weight tracking ───────────────────────────────────────
  addWeightEntry:    (weight: number) => Promise<void>;
  deleteWeightEntry: (id: string) => Promise<void>;

  // ── Manual workouts ───────────────────────────────────────
  addManualWorkout: (type: WorkoutType, distanceMiles?: number, durationMinutes?: number) => Promise<string>;

  // ── Races ─────────────────────────────────────────────────
  addRace:    (race: Omit<Race, 'id' | 'createdAt'>) => Promise<void>;
  updateRace: (id: string, patch: Partial<Race>) => Promise<void>;
  deleteRace: (id: string) => Promise<void>;

  // ── Live session ─────────────────────────────────────────
  startSession:  (workoutId: string) => void;
  pauseSession:  () => void;
  resumeSession: () => void;
  tickSession:   () => void;
  updateSessionGPS: (point: GPSPoint, distanceMiles: number, pace?: number) => void;
  endSession:    () => WorkoutSession | null;

  // ── Persistence ──────────────────────────────────────────
  loadFromStorage:  () => Promise<void>;
  clearAllData:     () => Promise<void>;
  resetProgress:    () => Promise<void>;
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
  profile:          null,
  plan:             null,
  feedback:         [],
  shoes:            [],
  earnedMilestones: [],
  morningCheckin:   null,
  weightEntries:    [],
  races:            [],
  session:          null,
  isLoaded:         false,

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
    NotificationService.scheduleWeeklySummary(plan).catch(() => {});
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
    if (patch.isCompleted) NotificationService.scheduleWeeklySummary(updated).catch(() => {});
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

  // ── Shoes ─────────────────────────────────────────────────
  addShoe: async (shoeData) => {
    const shoe: Shoe = {
      ...shoeData,
      id:         makeId(),
      addedAt:    new Date().toISOString(),
      totalMiles: 0,
    };
    const shoes = [...get().shoes, shoe];
    set({ shoes });
    await StorageService.saveShoes(shoes);
  },

  retireShoe: async (id) => {
    const shoes = get().shoes.map(s =>
      s.id === id ? { ...s, retired: true, retiredAt: new Date().toISOString() } : s,
    );
    set({ shoes });
    await StorageService.saveShoes(shoes);
  },

  logShoeRun: async (id, miles) => {
    const shoes = get().shoes.map(s =>
      s.id === id ? { ...s, totalMiles: s.totalMiles + miles } : s,
    );
    set({ shoes });
    await StorageService.saveShoes(shoes);
  },

  // ── Morning check-in ──────────────────────────────────────
  setMorningCheckin: async (c) => {
    set({ morningCheckin: c });
    await StorageService.saveMorningCheckin(c);
  },

  // ── Milestones ────────────────────────────────────────────
  earnMilestone: async (id) => {
    const { earnedMilestones } = get();
    if (earnedMilestones.includes(id)) return;
    const updated = [...earnedMilestones, id];
    set({ earnedMilestones: updated });
    await StorageService.saveMilestones(updated);
  },

  // ── Weight tracking ───────────────────────────────────────
  addWeightEntry: async (weight) => {
    const today = new Date().toISOString().slice(0, 10);
    const entry: WeightEntry = {
      id:        makeId(),
      date:      today,
      weight,
      timestamp: Date.now(),
    };
    // Replace any existing entry for today
    const existing = get().weightEntries.filter(e => e.date !== today);
    const entries = [...existing, entry].sort((a, b) => a.timestamp - b.timestamp);
    set({ weightEntries: entries });
    await StorageService.saveWeightEntries(entries);
  },

  deleteWeightEntry: async (id) => {
    const entries = get().weightEntries.filter(e => e.id !== id);
    set({ weightEntries: entries });
    await StorageService.saveWeightEntries(entries);
  },

  // ── Races ─────────────────────────────────────────────────
  addRace: async (raceData) => {
    const race: Race = { ...raceData, id: makeId(), createdAt: new Date().toISOString() };
    const races = [...get().races, race].sort((a, b) => a.date.localeCompare(b.date));
    set({ races });
    await StorageService.saveRaces(races);
  },

  updateRace: async (id, patch) => {
    const races = get().races.map(r => r.id === id ? { ...r, ...patch } : r)
      .sort((a, b) => a.date.localeCompare(b.date));
    set({ races });
    await StorageService.saveRaces(races);
  },

  deleteRace: async (id) => {
    const races = get().races.filter(r => r.id !== id);
    set({ races });
    await StorageService.saveRaces(races);
  },

  // ── Manual workouts ───────────────────────────────────────
  addManualWorkout: async (type, distanceMiles, durationMinutes) => {
    const { plan } = get();
    if (!plan) return '';
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const id = makeId();
    const manual: WorkoutDay = {
      id,
      date:                todayStr,
      weekNumber:          currentWeekNumber(plan),
      dayOfWeek:           today.getDay(),
      workoutType:         type,
      distanceMiles,
      durationMinutes,
      workoutDescription:  '',
      coachingNotes:       '',
      phase:               plan.workoutDays[0]?.phase ?? ('base' as any),
      isCompleted:         false,
      isSkipped:           false,
      isManual:            true,
    };
    const updated: TrainingPlan = {
      ...plan,
      workoutDays: [...plan.workoutDays, manual],
    };
    set({ plan: updated });
    await StorageService.savePlan(updated);
    return id;
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
    const [profile, plan, feedback, shoes, milestones, checkin, weightEntries, races] = await Promise.all([
      StorageService.loadProfile(),
      StorageService.loadPlan(),
      StorageService.loadFeedback(),
      StorageService.loadShoes(),
      StorageService.loadMilestones(),
      StorageService.loadMorningCheckin(),
      StorageService.loadWeightEntries(),
      StorageService.loadRaces(),
    ]);
    set({
      profile:          profile       ?? null,
      plan:             plan          ?? null,
      feedback:         feedback      ?? [],
      shoes:            shoes         ?? [],
      earnedMilestones: milestones    ?? [],
      morningCheckin:   checkin       ?? null,
      weightEntries:    weightEntries ?? [],
      races:            races         ?? [],
      isLoaded: true,
    });
  },

  clearAllData: async () => {
    await StorageService.clearAll();
    set({ profile: null, plan: null, feedback: [], shoes: [], earnedMilestones: [], morningCheckin: null, weightEntries: [], races: [], session: null });
  },

  resetProgress: async () => {
    const { plan } = get();
    if (!plan) return;
    const reset: TrainingPlan = {
      ...plan,
      workoutDays: plan.workoutDays.map(w => ({
        ...w,
        isCompleted:           false,
        isSkipped:             false,
        completedAt:           undefined,
        actualDurationSeconds: undefined,
        actualDistanceMiles:   undefined,
        route:                 undefined,
        checkinRPE:            undefined,
        checkinNotes:          undefined,
      })),
    };
    set({ plan: reset, feedback: [], session: null });
    await StorageService.savePlan(reset);
    await StorageService.saveFeedback([]);
  },
}));

// ── Selectors (use these in components) ──────────────────

export const selectElapsedSeconds = (session: WorkoutSession | null): number => {
  if (!session) return 0;
  const running = Date.now() - session.startedAt - session.totalPausedMs;
  return Math.floor(running / 1000);
};
