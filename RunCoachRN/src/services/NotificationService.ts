import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { TrainingPlan, WorkoutDay } from '../types/models';
import { WORKOUT_LABELS, WORKOUT_EMOJIS } from '../types/enums';

// How notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const DAILY_REMINDER_ID = 'daily-workout-reminder';
const DEFAULT_HOUR      = 7;   // 7 AM
const DEFAULT_MINUTE    = 0;

// ── Permission ────────────────────────────────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') return true;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ── Schedule daily workout reminder ──────────────────────────
export async function scheduleDailyWorkoutReminder(
  plan: TrainingPlan | null,
  hour: number = DEFAULT_HOUR,
  minute: number = DEFAULT_MINUTE,
): Promise<void> {
  await cancelDailyReminder();

  const granted = await requestNotificationPermission();
  if (!granted || !plan) return;

  const today = new Date();
  const todayWorkout = plan.workoutDays.find(w => {
    const d = new Date(w.date);
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth()    === today.getMonth() &&
      d.getDate()     === today.getDate()
    );
  });

  const { title, body } = buildNotificationContent(todayWorkout);

  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_ID,
    content: { title, body, sound: false },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

function buildNotificationContent(workout: WorkoutDay | undefined): { title: string; body: string } {
  if (!workout) {
    return {
      title: '🔥 Cinder',
      body:  'Rest day — recovery is training too.',
    };
  }

  const emoji = WORKOUT_EMOJIS[workout.workoutType] ?? '🏃';
  const label = WORKOUT_LABELS[workout.workoutType] ?? workout.workoutType;
  const miles = workout.distanceMiles ? ` · ${workout.distanceMiles.toFixed(1)} mi` : '';

  return {
    title: `${emoji} Today: ${label}${miles}`,
    body:  workout.coachNote ?? 'Tap to start your workout.',
  };
}

// ── Cancel ────────────────────────────────────────────────────
export async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});
}

// ── One-off notifications (milestones etc.) ───────────────────
export async function sendLocalNotification(title: string, body: string): Promise<void> {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: false },
    trigger:  null,
  });
}
