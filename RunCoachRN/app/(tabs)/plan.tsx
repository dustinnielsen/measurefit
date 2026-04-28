import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useAppStore, currentWeekNumber, workoutsForWeek, weeklyMileage } from '../../src/store/useAppStore';
import { workoutColor, Colors, CommonStyles, Radius, Spacing, Typography } from '../../src/theme';
import { Card } from '../../src/components/ui/Card';
import { PHASE_LABELS, WORKOUT_LABELS, WorkoutType } from '../../src/types/enums';
import { workoutIsToday, workoutIsPast } from '../../src/types/models';
import type { WorkoutDay } from '../../src/types/models';

export default function PlanTab() {
  const plan = useAppStore(s => s.plan);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  if (!plan) {
    return (
      <SafeAreaView style={CommonStyles.screenBg}>
        <View style={[CommonStyles.flex1, CommonStyles.center, { padding: Spacing.xl }]}>
          <Text style={{ fontSize: 48 }}>📅</Text>
          <Text style={[Typography.headline, { color: Colors.textPrimary, marginTop: Spacing.md }]}>No plan yet</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentWeek = currentWeekNumber(plan);
  const displayWeek = selectedWeek ?? currentWeek;
  const workouts    = workoutsForWeek(plan, displayWeek);
  const miles       = weeklyMileage(plan, displayWeek);
  const phase       = workouts.find(w => w.workoutType !== WorkoutType.Rest)?.phase;

  return (
    <SafeAreaView style={CommonStyles.screenBg}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[Typography.title2, { color: Colors.textPrimary, marginBottom: Spacing.xl }]}>
          Training Plan
        </Text>

        {/* Week selector */}
        <View style={styles.weekRow}>
          <TouchableOpacity onPress={() => setSelectedWeek(Math.max(1, displayWeek - 1))}
            disabled={displayWeek <= 1} style={styles.weekArrow}>
            <Text style={[styles.weekArrowText, displayWeek <= 1 && { opacity: 0.3 }]}>‹</Text>
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={[Typography.headline, { color: Colors.textPrimary }]}>
              Week {displayWeek} of {plan.totalWeeks}
            </Text>
            {phase && (
              <Text style={[Typography.caption1, { color: Colors.textSecondary }]}>
                {PHASE_LABELS[phase]}  ·  {miles.toFixed(0)} mi
                {displayWeek % 4 === 0 ? '  ·  Recovery week' : ''}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={() => setSelectedWeek(Math.min(plan.totalWeeks, displayWeek + 1))}
            disabled={displayWeek >= plan.totalWeeks} style={styles.weekArrow}>
            <Text style={[styles.weekArrowText, displayWeek >= plan.totalWeeks && { opacity: 0.3 }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Workout list */}
        {workouts.map(w => <WorkoutRow key={w.id} workout={w} />)}

        {/* Jump to current */}
        {selectedWeek !== null && selectedWeek !== currentWeek && (
          <TouchableOpacity onPress={() => setSelectedWeek(null)} style={styles.jumpBtn}>
            <Text style={[Typography.subhead, { color: Colors.accent }]}>Jump to current week</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function WorkoutRow({ workout }: { workout: WorkoutDay }) {
  const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const color = workoutColor(workout.workoutType);
  const isToday = workoutIsToday(workout);
  const isPast  = workoutIsPast(workout);
  const date    = new Date(workout.date);

  return (
    <TouchableOpacity
      style={[styles.row, isToday && styles.rowToday]}
      onPress={() => router.push(`/workout/${workout.id}`)}
      activeOpacity={0.8}
    >
      {/* Day column */}
      <View style={styles.dayCol}>
        <Text style={[Typography.caption2, { color: Colors.textSecondary }]}>
          {DAY_NAMES[workout.dayOfWeek]}
        </Text>
        <Text style={[Typography.subhead, { fontWeight: '600', color: Colors.textPrimary }]}>
          {date.getDate()}
        </Text>
      </View>

      {/* Color dot */}
      <View style={[styles.dot, { backgroundColor: color }]} />

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text style={[Typography.subhead, { fontWeight: '600', color: Colors.textPrimary }]}>
          {WORKOUT_LABELS[workout.workoutType]}
          {workout.adaptationNote ? '  🔄' : ''}
        </Text>
        <Text style={[Typography.caption1, { color: Colors.textSecondary }]}>
          {workout.distanceMiles != null
            ? `${workout.distanceMiles.toFixed(1)} mi`
            : workout.durationMinutes != null
            ? `${workout.durationMinutes} min`
            : ''}
        </Text>
      </View>

      {/* Status */}
      <Text style={{ fontSize: 18 }}>
        {workout.isCompleted ? '✅'
          : workout.isSkipped  ? '⏭️'
          : isToday            ? '👟'
          : isPast             ? '⚠️'
          : '○'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scroll:   { padding: Spacing.xl, paddingBottom: Spacing['4xl'] },
  weekRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xl, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg },
  weekArrow:{ padding: Spacing.sm },
  weekArrowText: { fontSize: 28, color: Colors.textPrimary, fontWeight: '300' },
  row:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.md, marginBottom: Spacing.sm },
  rowToday: { borderWidth: 1.5, borderColor: Colors.accent },
  dayCol:   { width: 36, alignItems: 'center' },
  dot:      { width: 10, height: 10, borderRadius: 5 },
  jumpBtn:  { alignItems: 'center', marginTop: Spacing.lg, padding: Spacing.md },
});
