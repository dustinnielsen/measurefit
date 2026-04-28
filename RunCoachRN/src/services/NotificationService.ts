import * as Notifications from 'expo-notifications';
import type { TrainingPlan } from '../types/models';
import { currentWeekNumber, weeklyMileage, workoutsForWeek } from '../store/useAppStore';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export const NotificationService = {
  async requestPermissions(): Promise<boolean> {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  },

  async scheduleWeeklySummary(plan: TrainingPlan): Promise<void> {
    // Cancel any existing weekly summary notifications
    await Notifications.cancelAllScheduledNotificationsAsync();

    const granted = await NotificationService.requestPermissions();
    if (!granted) return;

    const weekNum   = currentWeekNumber(plan);
    const workouts  = workoutsForWeek(plan, weekNum);
    const completed = workouts.filter(w => w.isCompleted);
    const doneMiles = completed.reduce((s, w) => s + (w.actualDistanceMiles ?? w.distanceMiles ?? 0), 0);
    const nextWeek  = weekNum + 1;
    const nextMiles = nextWeek <= plan.totalWeeks ? weeklyMileage(plan, nextWeek) : 0;

    const body = doneMiles > 0
      ? `You ran ${doneMiles.toFixed(1)} mi this week. ${nextMiles > 0 ? `Week ${nextWeek} target: ${nextMiles.toFixed(0)} mi.` : 'Final week — race day incoming! 🏁'}`
      : `Week ${weekNum} is wrapping up. Log any missed runs before Sunday ends.`;

    // Schedule for next Sunday at 7pm
    const now = new Date();
    const nextSunday = new Date(now);
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
    nextSunday.setDate(now.getDate() + daysUntilSunday);
    nextSunday.setHours(19, 0, 0, 0);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Week ${weekNum} recap 🏃`,
        body,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: nextSunday,
      },
    });

    // Also schedule Monday morning workout reminder
    const nextMonday = new Date(nextSunday);
    nextMonday.setDate(nextSunday.getDate() + 1);
    nextMonday.setHours(7, 0, 0, 0);

    if (nextMiles > 0) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Week ${nextWeek} starts today 💪`,
          body: `${nextMiles.toFixed(0)} miles on the plan. Let's go.`,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: nextMonday,
        },
      });
    }
  },

  async cancelAll(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },
};
