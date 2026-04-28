import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppStore, currentWeekNumber, weeklyMileage, workoutsForWeek } from '../../src/store/useAppStore';
import { Colors, CommonStyles, Radius, Spacing, Typography } from '../../src/theme';
import { Card } from '../../src/components/ui/Card';
import { SimpleBarChart, type BarData } from '../../src/components/ui/SimpleBarChart';
import { WORKOUT_LABELS, WorkoutType } from '../../src/types/enums';

export default function ProgressTab() {
  const plan     = useAppStore(s => s.plan);
  const feedback = useAppStore(s => s.feedback);

  if (!plan) {
    return (
      <SafeAreaView style={CommonStyles.screenBg}>
        <View style={[CommonStyles.flex1, CommonStyles.center, { padding: Spacing.xl }]}>
          <Text style={{ fontSize: 48 }}>📊</Text>
          <Text style={[Typography.headline, { color: Colors.textPrimary, marginTop: Spacing.md }]}>
            No data yet
          </Text>
          <Text style={[Typography.subhead, { color: Colors.textSecondary, marginTop: 4, textAlign: 'center' }]}>
            Complete onboarding to start tracking progress.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentWeek = currentWeekNumber(plan);

  // Last 8 weeks of bar chart data
  const chartData: BarData[] = [];
  const startWeek = Math.max(1, currentWeek - 7);
  for (let w = startWeek; w <= currentWeek; w++) {
    const workouts = workoutsForWeek(plan, w);
    const done     = workouts.filter(x => x.isCompleted).reduce((s, x) => s + (x.actualDistanceMiles ?? x.distanceMiles ?? 0), 0);
    const target   = weeklyMileage(plan, w);
    chartData.push({ label: `W${w}`, value: done, target, color: Colors.accent });
  }

  // Totals
  const allCompleted = plan.workoutDays.filter(w => w.isCompleted);
  const totalMiles   = allCompleted.reduce((s, w) => s + (w.actualDistanceMiles ?? w.distanceMiles ?? 0), 0);
  const totalRuns    = allCompleted.filter(w => w.workoutType !== WorkoutType.Rest && w.workoutType !== WorkoutType.Strength && w.workoutType !== WorkoutType.Mobility).length;

  // Streak: consecutive weeks back from current with ≥1 completed
  let streak = 0;
  for (let w = currentWeek; w >= 1; w--) {
    const hasAny = workoutsForWeek(plan, w).some(x => x.isCompleted);
    if (!hasAny) break;
    streak++;
  }

  // Workout type breakdown
  const typeCounts = allCompleted.reduce<Record<string, number>>((acc, w) => {
    if (w.workoutType === WorkoutType.Rest) return acc;
    acc[w.workoutType] = (acc[w.workoutType] ?? 0) + 1;
    return acc;
  }, {});
  const typeEntries = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);

  // Recent (last 10 completed)
  const recent = [...allCompleted]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  return (
    <SafeAreaView style={CommonStyles.screenBg}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[Typography.title2, { color: Colors.textPrimary, marginBottom: Spacing.xl }]}>
          Progress
        </Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard value={totalMiles.toFixed(0)} label="Total Miles" emoji="🏃" />
          <StatCard value={String(totalRuns)}      label="Workouts"    emoji="✅" />
          <StatCard value={`${streak}w`}           label="Streak"      emoji="🔥" />
        </View>

        {/* Chart */}
        <Card style={{ marginTop: Spacing.lg }}>
          <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: Spacing.md }]}>
            WEEKLY MILEAGE
          </Text>
          {chartData.length > 0
            ? <SimpleBarChart data={chartData} height={140} showTarget />
            : <Text style={[Typography.subhead, { color: Colors.textTertiary, textAlign: 'center', padding: Spacing.xl }]}>
                Complete your first workout to see data.
              </Text>
          }
          <Text style={[Typography.caption2, { color: Colors.textTertiary, marginTop: Spacing.sm }]}>
            Grey bar = below 80% of target  ·  Dashed line = target
          </Text>
        </Card>

        {/* Breakdown */}
        {typeEntries.length > 0 && (
          <Card style={{ marginTop: Spacing.lg }}>
            <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: Spacing.md }]}>
              WORKOUT BREAKDOWN
            </Text>
            {typeEntries.map(([type, count]) => (
              <View key={type} style={[CommonStyles.rowBetween, { paddingVertical: 6 }]}>
                <Text style={[Typography.subhead, { color: Colors.textPrimary }]}>
                  {WORKOUT_EMOJIS[type as WorkoutType] ?? '🏃'}  {WORKOUT_LABELS[type as WorkoutType] ?? type}
                </Text>
                <Text style={[Typography.subhead, { color: Colors.textSecondary, fontWeight: '600' }]}>{count}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Recent activity */}
        {recent.length > 0 && (
          <Card style={{ marginTop: Spacing.lg }}>
            <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: Spacing.md }]}>
              RECENT ACTIVITY
            </Text>
            {recent.map((w, i) => (
              <View key={w.id}>
                <View style={[CommonStyles.row, { paddingVertical: Spacing.sm, gap: Spacing.md }]}>
                  <Text style={{ fontSize: 22 }}>{WORKOUT_EMOJIS[w.workoutType] ?? '🏃'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[Typography.subhead, { fontWeight: '600', color: Colors.textPrimary }]}>
                      {WORKOUT_LABELS[w.workoutType]}
                    </Text>
                    <Text style={[Typography.caption1, { color: Colors.textSecondary }]}>
                      {new Date(w.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  {(w.actualDistanceMiles ?? w.distanceMiles) != null && (
                    <Text style={[Typography.subhead, { color: Colors.textSecondary }]}>
                      {(w.actualDistanceMiles ?? w.distanceMiles)!.toFixed(1)} mi
                    </Text>
                  )}
                </View>
                {i < recent.length - 1 && <View style={CommonStyles.divider} />}
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ value, label, emoji }: { value: string; label: string; emoji: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={{ fontSize: 24 }}>{emoji}</Text>
      <Text style={[Typography.title2, { color: Colors.textPrimary, marginTop: 4 }]}>{value}</Text>
      <Text style={[Typography.caption1, { color: Colors.textSecondary, textAlign: 'center' }]}>{label}</Text>
    </View>
  );
}

const WORKOUT_EMOJIS: Partial<Record<WorkoutType, string>> = {
  [WorkoutType.Easy]: '🏃', [WorkoutType.Long]: '🛣️', [WorkoutType.Tempo]: '⏱️',
  [WorkoutType.Intervals]: '⚡️', [WorkoutType.Strides]: '💨',
  [WorkoutType.Strength]: '🏋️', [WorkoutType.Mobility]: '🧘',
};

const styles = StyleSheet.create({
  scroll:   { padding: Spacing.xl, paddingBottom: Spacing['4xl'] },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', gap: 2 },
});
