import React, { useRef } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import { WORKOUT_LABELS, WorkoutType } from '../../types/enums';
import type { WorkoutDay } from '../../types/models';

const WORKOUT_EMOJIS: Partial<Record<WorkoutType, string>> = {
  [WorkoutType.Easy]: '🏃', [WorkoutType.Long]: '🛣️', [WorkoutType.Tempo]: '⏱️',
  [WorkoutType.Intervals]: '⚡️', [WorkoutType.Strides]: '💨',
  [WorkoutType.Strength]: '🏋️', [WorkoutType.Mobility]: '🧘',
};

interface Props {
  workout: WorkoutDay;
  weekNumber: number;
  totalWeeks: number;
}

export function useShareWorkout() {
  const ref = useRef<ViewShot>(null);

  async function share() {
    try {
      const uri = await (ref.current as any).capture();
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) { Alert.alert('Sharing not available on this device'); return; }
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your run' });
    } catch {
      Alert.alert('Could not capture share card');
    }
  }

  return { ref, share };
}

export function WorkoutShareCard({ workout, weekNumber, totalWeeks, innerRef }: Props & { innerRef: any }) {
  const miles  = (workout.actualDistanceMiles ?? workout.distanceMiles ?? 0).toFixed(1);
  const emoji  = WORKOUT_EMOJIS[workout.workoutType] ?? '🏃';
  const label  = WORKOUT_LABELS[workout.workoutType];
  const date   = new Date(workout.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <ViewShot ref={innerRef} options={{ format: 'png', quality: 1 }} style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.appName}>RunCoach</Text>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <Text style={styles.type}>{label}</Text>
      <Text style={styles.miles}>{miles} mi</Text>
      <Text style={styles.date}>{date}</Text>
      <View style={styles.footer}>
        <Text style={styles.footerText}>Week {weekNumber} of {totalWeeks}</Text>
        <Text style={styles.footerDot}>·</Text>
        <Text style={styles.footerText}>✅ Completed</Text>
      </View>
    </ViewShot>
  );
}

const styles = StyleSheet.create({
  card:       { width: 340, backgroundColor: Colors.accent, borderRadius: Radius.xl, padding: Spacing.xl, paddingBottom: Spacing.xxl },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  appName:    { ...Typography.label, color: 'rgba(255,255,255,0.75)', letterSpacing: 2 },
  emoji:      { fontSize: 36 },
  type:       { ...Typography.title3, color: 'rgba(255,255,255,0.85)', marginBottom: 4 },
  miles:      { fontSize: 64, fontWeight: '800', color: '#fff', lineHeight: 72 },
  date:       { ...Typography.subhead, color: 'rgba(255,255,255,0.75)', marginTop: Spacing.sm },
  footer:     { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xl, paddingTop: Spacing.lg, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  footerText: { ...Typography.caption1, color: 'rgba(255,255,255,0.8)' },
  footerDot:  { ...Typography.caption1, color: 'rgba(255,255,255,0.4)' },
});
