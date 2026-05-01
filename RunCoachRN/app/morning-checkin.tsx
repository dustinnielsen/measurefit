import React, { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, SafeAreaView, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../src/store/useAppStore';
import { Colors, CommonStyles, Radius, Spacing, Typography } from '../src/theme';
import { Card } from '../src/components/ui/Card';
import { PrimaryButton } from '../src/components/ui/Buttons';
import { emberScore, emberScoreLabel, emberScoreColor } from '../src/services/MilestoneService';
import type { MorningCheckin } from '../src/types/models';

type Level = 1 | 2 | 3;

const SLEEP_OPTIONS: { value: Level; label: string; emoji: string }[] = [
  { value: 1, label: 'Poor',  emoji: '😴' },
  { value: 2, label: 'OK',    emoji: '😐' },
  { value: 3, label: 'Great', emoji: '😊' },
];

const ENERGY_OPTIONS: { value: Level; label: string; emoji: string }[] = [
  { value: 1, label: 'Low',    emoji: '🪫' },
  { value: 2, label: 'Normal', emoji: '⚡️' },
  { value: 3, label: 'High',   emoji: '🔥' },
];

const STRESS_OPTIONS: { value: Level; label: string; emoji: string }[] = [
  { value: 1, label: 'Low',  emoji: '😌' },
  { value: 2, label: 'Med',  emoji: '😤' },
  { value: 3, label: 'High', emoji: '😰' },
];

export default function MorningCheckinScreen() {
  const { setMorningCheckin, addWeightEntry } = useAppStore();
  const existing  = useAppStore(s => s.morningCheckin);
  const profile   = useAppStore(s => s.profile);
  const weightUnit = profile?.weightUnit ?? 'lbs';

  const todayDate = new Date().toISOString().slice(0, 10);
  const todayCheckin = existing?.date === todayDate ? existing : null;

  const [sleep,       setSleep]       = useState<Level>(todayCheckin?.sleepQuality ?? 2);
  const [energy,      setEnergy]      = useState<Level>(todayCheckin?.energyLevel  ?? 2);
  const [stress,      setStress]      = useState<Level>(todayCheckin?.stressLevel  ?? 2);
  const [weightInput, setWeightInput] = useState('');

  const score = emberScore(sleep, energy, stress);
  const label = emberScoreLabel(score);
  const color = emberScoreColor(score);

  async function handleSave() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const checkin: MorningCheckin = {
      date: todayDate,
      sleepQuality: sleep,
      energyLevel:  energy,
      stressLevel:  stress,
    };
    await setMorningCheckin(checkin);

    if (weightInput.trim()) {
      const parsed = parseFloat(weightInput);
      if (!isNaN(parsed) && parsed > 0) {
        const inLbs = weightUnit === 'kg' ? parsed * 2.20462 : parsed;
        await addWeightEntry(inLbs);
      }
    }

    router.back();
  }

  return (
    <SafeAreaView style={CommonStyles.screenBg}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[CommonStyles.rowBetween, { marginBottom: Spacing.xl }]}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Text style={[Typography.headline, { color: Colors.accent }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[Typography.title3, { color: Colors.textPrimary }]}>Morning Check-In</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Score preview */}
        <View style={[styles.scoreCard, { borderColor: color + '50' }]}>
          <View style={[styles.scoreBadge, { backgroundColor: color + '18', borderColor: color + '40' }]}>
            <Text style={[Typography.largeTitle, { color }]}>{score}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: Spacing.lg }}>
            <Text style={[Typography.label, { color: Colors.textSecondary }]}>CINDER SCORE</Text>
            <Text style={[Typography.title3, { color, marginTop: 2 }]}>{label}</Text>
            <Text style={[Typography.caption1, { color: Colors.textSecondary, marginTop: 4 }]}>
              {scoreAdvice(score)}
            </Text>
          </View>
        </View>

        {/* Sleep quality */}
        <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: Spacing.sm }]}>
          SLEEP QUALITY
        </Text>
        <View style={styles.optionRow}>
          {SLEEP_OPTIONS.map(opt => (
            <OptionButton
              key={opt.value}
              emoji={opt.emoji}
              label={opt.label}
              selected={sleep === opt.value}
              onPress={() => setSleep(opt.value)}
            />
          ))}
        </View>

        {/* Energy level */}
        <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: Spacing.sm, marginTop: Spacing.xl }]}>
          ENERGY LEVEL
        </Text>
        <View style={styles.optionRow}>
          {ENERGY_OPTIONS.map(opt => (
            <OptionButton
              key={opt.value}
              emoji={opt.emoji}
              label={opt.label}
              selected={energy === opt.value}
              onPress={() => setEnergy(opt.value)}
            />
          ))}
        </View>

        {/* Stress level */}
        <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: Spacing.sm, marginTop: Spacing.xl }]}>
          STRESS LEVEL
        </Text>
        <View style={styles.optionRow}>
          {STRESS_OPTIONS.map(opt => (
            <OptionButton
              key={opt.value}
              emoji={opt.emoji}
              label={opt.label}
              selected={stress === opt.value}
              onPress={() => setStress(opt.value)}
            />
          ))}
        </View>

        {/* Weight log */}
        <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: Spacing.sm, marginTop: Spacing.xl }]}>
          WEIGHT (optional)
        </Text>
        <View style={styles.weightRow}>
          <TextInput
            style={styles.weightInput}
            value={weightInput}
            onChangeText={setWeightInput}
            placeholder={`Enter weight in ${weightUnit}`}
            placeholderTextColor={Colors.textTertiary}
            keyboardType="decimal-pad"
            returnKeyType="done"
          />
          <View style={styles.weightUnit}>
            <Text style={[Typography.subhead, { color: Colors.textSecondary, fontWeight: '600' }]}>{weightUnit}</Text>
          </View>
        </View>

        {/* Workout recommendation */}
        <Card style={styles.recCard}>
          <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: Spacing.sm }]}>
            TODAY'S RECOMMENDATION
          </Text>
          <Text style={[Typography.subhead, { color: Colors.textPrimary }]}>
            {workoutRecommendation(score)}
          </Text>
        </Card>

        <PrimaryButton label="Save Check-In" onPress={handleSave} style={{ marginTop: Spacing.lg }} />

        <Text style={[Typography.caption1, { color: Colors.textTertiary, textAlign: 'center', marginTop: Spacing.lg }]}>
          Check in each morning for accurate Cinder Score and workout adjustments.
        </Text>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function OptionButton({ emoji, label, selected, onPress }: {
  emoji: string; label: string; selected: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.optionBtn, selected && styles.optionBtnSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={{ fontSize: 28 }}>{emoji}</Text>
      <Text style={[Typography.caption1, {
        color: selected ? Colors.accent : Colors.textSecondary,
        fontWeight: selected ? '700' : '400',
        marginTop: 4,
      }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function scoreAdvice(score: number): string {
  if (score >= 80) return 'You\'re in the zone. Hit your workout with confidence.';
  if (score >= 60) return 'Feeling decent. Stick to the plan and listen to your body.';
  if (score >= 40) return 'Low energy day. Keep it easy — an easy run still counts.';
  return 'Recovery day. Consider swapping to easy or rest if planned hard.';
}

function workoutRecommendation(score: number): string {
  if (score >= 80) return '✅  Full effort — your body is primed. Nail your quality session.';
  if (score >= 60) return '👟  Complete as planned. Ease in and see how you feel after the warmup.';
  if (score >= 40) return '🐢  Dial back intensity 10–20%. Easy effort, easy pace. Progress still counts.';
  return '😴  Consider a rest or light mobility session. Pushing through fatigue leads to injury.';
}

const styles = StyleSheet.create({
  scroll:    { padding: Spacing.xl, paddingBottom: Spacing['4xl'] },

  scoreCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.xl, borderWidth: 1.5 },
  scoreBadge:{ width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },

  optionRow: { flexDirection: 'row', gap: Spacing.sm },
  optionBtn: { flex: 1, alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingVertical: Spacing.lg, borderWidth: 1.5, borderColor: Colors.border },
  optionBtnSelected: { borderColor: Colors.accent, backgroundColor: Colors.accent + '12' },

  recCard:      { marginTop: Spacing.xl },
  weightRow:    { flexDirection: 'row', gap: Spacing.sm },
  weightInput:  { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, color: Colors.textPrimary, fontSize: 17 },
  weightUnit:   { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: Spacing.md, justifyContent: 'center' },
});
