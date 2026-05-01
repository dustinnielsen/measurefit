import React, { useState } from 'react';
import {
  SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../src/store/useAppStore';
import { WorkoutType, WORKOUT_LABELS, WORKOUT_EMOJIS } from '../src/types/enums';
import { Colors, CommonStyles, Radius, Spacing, Typography } from '../src/theme';
import { PrimaryButton } from '../src/components/ui/Buttons';

const WORKOUT_OPTIONS: { type: WorkoutType; description: string }[] = [
  { type: WorkoutType.Walk,      description: 'Easy-paced walk, GPS tracked' },
  { type: WorkoutType.Easy,      description: 'Conversational pace run' },
  { type: WorkoutType.Long,      description: 'Steady long distance run' },
  { type: WorkoutType.Tempo,     description: 'Comfortably hard sustained effort' },
  { type: WorkoutType.Intervals, description: 'Hard reps with recovery jogs' },
  { type: WorkoutType.Strides,   description: 'Easy run with short fast bursts' },
  { type: WorkoutType.Strength,  description: 'Runner-specific strength work' },
  { type: WorkoutType.Mobility,  description: 'Flexibility and movement routine' },
];

export default function LogWorkoutScreen() {
  const { addManualWorkout } = useAppStore();
  const plan = useAppStore(s => s.plan);
  const [selected, setSelected] = useState<WorkoutType | null>(null);
  const [loading, setLoading] = useState(false);

  if (!plan) {
    return (
      <SafeAreaView style={CommonStyles.screenBg}>
        <View style={[CommonStyles.flex1, CommonStyles.center, { padding: Spacing.xl }]}>
          <Text style={[Typography.subhead, { color: Colors.textSecondary, textAlign: 'center' }]}>
            Complete onboarding first to log workouts.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  async function handleStart() {
    if (!selected) return;
    setLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const id = await addManualWorkout(selected);
    setLoading(false);
    router.replace(`/workout/${id}` as any);
  }

  return (
    <SafeAreaView style={CommonStyles.screenBg}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[CommonStyles.rowBetween, { marginBottom: Spacing.xl }]}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Text style={[Typography.headline, { color: Colors.accent }]}>✕</Text>
          </TouchableOpacity>
          <Text style={[Typography.title3, { color: Colors.textPrimary }]}>Log a Workout</Text>
          <View style={{ width: 32 }} />
        </View>

        <Text style={[Typography.subhead, { color: Colors.textSecondary, marginBottom: Spacing.lg }]}>
          Choose a workout type to start tracking.
        </Text>

        {WORKOUT_OPTIONS.map(({ type, description }) => {
          const isSelected = selected === type;
          return (
            <TouchableOpacity
              key={type}
              style={[styles.option, isSelected && styles.optionSelected]}
              onPress={() => setSelected(type)}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 32 }}>{WORKOUT_EMOJIS[type]}</Text>
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <Text style={[Typography.headline, { color: isSelected ? Colors.accent : Colors.textPrimary }]}>
                  {WORKOUT_LABELS[type]}
                </Text>
                <Text style={[Typography.caption1, { color: Colors.textSecondary, marginTop: 2 }]}>
                  {description}
                </Text>
              </View>
              {isSelected && (
                <Text style={{ color: Colors.accent, fontSize: 20 }}>✓</Text>
              )}
            </TouchableOpacity>
          );
        })}

        <PrimaryButton
          label={loading ? 'Opening...' : 'Start Workout'}
          onPress={handleStart}
          style={{ marginTop: Spacing.xl }}
          disabled={!selected || loading}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll:  { padding: Spacing.xl, paddingBottom: Spacing['4xl'] },

  option: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, marginBottom: Spacing.sm,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  optionSelected: {
    borderColor: Colors.accent, backgroundColor: Colors.accent + '10',
  },
});
