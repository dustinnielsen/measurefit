import React, { useState } from 'react';
import {
  SafeAreaView, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAppStore } from '../../src/store/useAppStore';
import { Colors, CommonStyles, Radius, Spacing, Typography } from '../../src/theme';
import { Card } from '../../src/components/ui/Card';
import { PrimaryButton, GhostButton } from '../../src/components/ui/Buttons';
import {
  WORKOUT_EMOJIS, WORKOUT_LABELS, WorkoutType, isRunWorkout,
} from '../../src/types/enums';

const ALL_TYPES: WorkoutType[] = [
  WorkoutType.Easy, WorkoutType.Long, WorkoutType.Tempo,
  WorkoutType.Intervals, WorkoutType.Strides,
  WorkoutType.Strength, WorkoutType.Mobility, WorkoutType.Rest,
];

export default function EditWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const plan = useAppStore(s => s.plan);
  const { updateWorkout } = useAppStore();

  const workout = plan?.workoutDays.find(w => w.id === id);

  const [type, setType]         = useState<WorkoutType>(workout?.workoutType ?? WorkoutType.Easy);
  const [distance, setDistance] = useState(workout?.distanceMiles?.toString() ?? '');
  const [duration, setDuration] = useState(workout?.durationMinutes?.toString() ?? '');
  const [saving, setSaving]     = useState(false);

  if (!workout) {
    return (
      <SafeAreaView style={CommonStyles.screenBg}>
        <Text style={{ padding: 24, color: Colors.textSecondary }}>Workout not found.</Text>
      </SafeAreaView>
    );
  }

  async function save() {
    setSaving(true);
    const distVal = parseFloat(distance);
    const durVal  = parseInt(duration, 10);
    await updateWorkout(workout!.id, {
      workoutType:     type,
      distanceMiles:   isRunWorkout(type) && !isNaN(distVal) && distVal > 0 ? distVal : undefined,
      durationMinutes: !isNaN(durVal) && durVal > 0 ? durVal : undefined,
    });
    setSaving(false);
    router.back();
  }

  return (
    <SafeAreaView style={CommonStyles.screenBg}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: Spacing.lg }}>
          <Text style={[Typography.subhead, { color: Colors.accent }]}>← Back</Text>
        </TouchableOpacity>

        <Text style={[Typography.title2, { color: Colors.textPrimary }]}>Edit Day</Text>
        <Text style={[Typography.subhead, { color: Colors.textSecondary, marginTop: 4, marginBottom: Spacing.xl }]}>
          {new Date(workout.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>

        {/* Workout type picker */}
        <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: Spacing.sm }]}>WORKOUT TYPE</Text>
        <View style={styles.typeGrid}>
          {ALL_TYPES.map(t => {
            const selected = t === type;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.typeBtn, selected && styles.typeBtnSelected]}
                onPress={() => setType(t)}
                activeOpacity={0.7}
              >
                <Text style={styles.typeEmoji}>{WORKOUT_EMOJIS[t]}</Text>
                <Text style={[styles.typeLabel, selected && { color: Colors.textPrimary, fontWeight: '600' }]}>
                  {WORKOUT_LABELS[t]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Distance — only for run types */}
        {isRunWorkout(type) && (
          <Card style={{ marginTop: Spacing.xl }}>
            <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: Spacing.sm }]}>
              TARGET DISTANCE (optional)
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={distance}
                onChangeText={setDistance}
                placeholder="e.g. 5.0"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="decimal-pad"
              />
              <Text style={[Typography.subhead, { color: Colors.textSecondary, marginLeft: Spacing.sm }]}>mi</Text>
            </View>
          </Card>
        )}

        {/* Duration */}
        {type !== WorkoutType.Rest && (
          <Card style={{ marginTop: Spacing.md }}>
            <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: Spacing.sm }]}>
              TARGET DURATION (optional)
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={duration}
                onChangeText={setDuration}
                placeholder="e.g. 45"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="number-pad"
              />
              <Text style={[Typography.subhead, { color: Colors.textSecondary, marginLeft: Spacing.sm }]}>min</Text>
            </View>
          </Card>
        )}

        <PrimaryButton
          label="Save Changes"
          onPress={save}
          loading={saving}
          style={{ marginTop: Spacing.xl }}
        />
        <GhostButton label="Cancel" onPress={() => router.back()} style={{ marginTop: Spacing.sm }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll:           { padding: Spacing.xl, paddingBottom: Spacing['4xl'] },
  typeGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  typeBtn:          { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.separator },
  typeBtnSelected:  { borderColor: Colors.accent, backgroundColor: Colors.accent + '15' },
  typeEmoji:        { fontSize: 16 },
  typeLabel:        { ...Typography.footnote, color: Colors.textSecondary },
  inputRow:         { flexDirection: 'row', alignItems: 'center' },
  input:            { flex: 1, ...Typography.body, color: Colors.textPrimary, borderBottomWidth: 1, borderBottomColor: Colors.separator, paddingVertical: Spacing.sm },
});
