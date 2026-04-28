import React, { useState } from 'react';
import {
  SafeAreaView, ScrollView, StyleSheet, Text,
  TouchableOpacity, View, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAppStore } from '../../src/store/useAppStore';
import { Colors, CommonStyles, Radius, Spacing, Typography } from '../../src/theme';
import { Card } from '../../src/components/ui/Card';
import { PrimaryButton } from '../../src/components/ui/Buttons';
import {
  CompletionStatus, EnergyLevel, PainLevel, SleepQuality,
  SignalLevel,
} from '../../src/types/enums';
import type { RunFeedback } from '../../src/types/models';

function makeId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

export default function CheckIn() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { addFeedback } = useAppStore();

  const [completion, setCompletion] = useState<CompletionStatus>(CompletionStatus.Completed);
  const [effort,     setEffort]     = useState(5);
  const [pain,       setPain]       = useState<PainLevel>(PainLevel.None);
  const [energy,     setEnergy]     = useState<EnergyLevel>(EnergyLevel.Normal);
  const [sleep,      setSleep]      = useState<SleepQuality>(SleepQuality.Ok);
  const [loading,    setLoading]    = useState(false);
  const [result,     setResult]     = useState<{ level: SignalLevel; messages: string[] } | null>(null);

  async function submit() {
    setLoading(true);
    const fb: RunFeedback = {
      id: makeId(),
      workoutDayId: id!,
      recordedAt:   new Date().toISOString(),
      completionStatus: completion,
      effortRating: effort,
      painLevel:    pain,
      energyLevel:  energy,
      sleepQuality: sleep,
    };
    await addFeedback(fb);

    // Show result summary
    const level = pain === PainLevel.Sharp ? SignalLevel.Danger
      : pain === PainLevel.Moderate        ? SignalLevel.Concern
      : effort >= 8 || energy === EnergyLevel.Low ? SignalLevel.Caution
      : SignalLevel.Ok;

    const msgs: string[] = [];
    if (level === SignalLevel.Danger)  msgs.push('Sharp pain detected — speed work removed this week.');
    if (level === SignalLevel.Concern) msgs.push('Plan adjusted to allow more recovery.');
    if (level === SignalLevel.Caution) msgs.push('Intervals downgraded to tempo this week.');
    if (level === SignalLevel.Ok)      msgs.push('All good — no changes to your plan.');

    setLoading(false);
    setResult({ level, messages: msgs });
  }

  if (result) {
    return <ResultScreen level={result.level} messages={result.messages} />;
  }

  return (
    <SafeAreaView style={CommonStyles.screenBg}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[Typography.title2, { color: Colors.textPrimary, marginBottom: 4 }]}>
          How did it go?
        </Text>
        <Text style={[Typography.subhead, { color: Colors.textSecondary, marginBottom: Spacing.xl }]}>
          Your answers adjust this week's remaining sessions.
        </Text>

        {/* Completion */}
        <SectionLabel title="Did you complete the workout?" />
        <ChipRow
          options={[
            { label: '✅  Yes', value: CompletionStatus.Completed },
            { label: '⚡  Partial', value: CompletionStatus.Partial },
            { label: '✗  No', value: CompletionStatus.Skipped },
          ]}
          value={completion} onChange={setCompletion}
        />

        {/* Effort */}
        <SectionLabel title={`Effort level   ${effort} / 10`} />
        <EffortSelector value={effort} onChange={setEffort} />

        {/* Pain */}
        <SectionLabel title="Any pain or discomfort?" />
        <ChipRow
          options={[
            { label: '😊  None',    value: PainLevel.None },
            { label: '😬  Mild',    value: PainLevel.Mild },
            { label: '😣  Moderate',value: PainLevel.Moderate },
            { label: '🛑  Sharp',   value: PainLevel.Sharp },
          ]}
          value={pain} onChange={setPain}
        />

        {/* Energy */}
        <SectionLabel title="Energy level today" />
        <ChipRow
          options={[
            { label: '🪫  Low',    value: EnergyLevel.Low },
            { label: '⚡  Normal', value: EnergyLevel.Normal },
            { label: '🔋  High',   value: EnergyLevel.High },
          ]}
          value={energy} onChange={setEnergy}
        />

        {/* Sleep */}
        <SectionLabel title="Sleep last night" />
        <ChipRow
          options={[
            { label: '😫  Poor', value: SleepQuality.Poor },
            { label: '😐  OK',   value: SleepQuality.Ok },
            { label: '😴  Good', value: SleepQuality.Good },
          ]}
          value={sleep} onChange={setSleep}
        />

        <PrimaryButton
          label={loading ? 'Saving…' : 'Save Check-In'}
          onPress={submit}
          loading={loading}
          style={{ marginTop: Spacing.xl }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Result screen ─────────────────────────────────────────

function ResultScreen({ level, messages }: { level: SignalLevel; messages: string[] }) {
  const config: Record<SignalLevel, { emoji: string; title: string; color: string }> = {
    [SignalLevel.Ok]:      { emoji: '✅', title: 'Looking good',  color: Colors.success },
    [SignalLevel.Caution]: { emoji: '⚠️', title: 'Taking it easy', color: Colors.warning },
    [SignalLevel.Concern]: { emoji: '🔶', title: 'Plan adjusted',  color: Colors.warning },
    [SignalLevel.Danger]:  { emoji: '🛑', title: 'Safety mode',   color: Colors.danger },
  };
  const { emoji, title, color } = config[level];

  return (
    <SafeAreaView style={[CommonStyles.flex1, CommonStyles.center, { backgroundColor: Colors.bg, padding: Spacing.xl }]}>
      <Text style={{ fontSize: 64 }}>{emoji}</Text>
      <Text style={[Typography.title2, { color: Colors.textPrimary, marginTop: Spacing.lg, textAlign: 'center' }]}>
        {title}
      </Text>
      {messages.map((m, i) => (
        <Text key={i} style={[Typography.subhead, { color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm }]}>
          {m}
        </Text>
      ))}
      <PrimaryButton
        label="Done"
        onPress={() => router.replace('/(tabs)')}
        style={{ marginTop: Spacing['3xl'], alignSelf: 'stretch' }}
      />
    </SafeAreaView>
  );
}

// ── Primitives ────────────────────────────────────────────

function SectionLabel({ title }: { title: string }) {
  return <Text style={styles.sectionLabel}>{title}</Text>;
}

function ChipRow<T>({ options, value, onChange }: {
  options: { label: string; value: T }[];
  value: T; onChange: (v: T) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map(opt => (
        <TouchableOpacity
          key={String(opt.value)}
          style={[styles.chip, opt.value === value && styles.chipActive]}
          onPress={() => onChange(opt.value)}
          activeOpacity={0.75}
        >
          <Text style={[styles.chipText, opt.value === value && styles.chipTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function EffortSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const effortColor = (n: number) =>
    n <= 3 ? Colors.success : n <= 6 ? Colors.warning : Colors.danger;

  return (
    <View style={styles.effortRow}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
        <TouchableOpacity
          key={n}
          style={[styles.effortBtn, { backgroundColor: n <= value ? effortColor(value) : Colors.tertiary }]}
          onPress={() => onChange(n)}
          activeOpacity={0.75}
        >
          <Text style={[styles.effortNum, { color: n <= value ? '#fff' : Colors.textTertiary }]}>{n}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll:       { padding: Spacing.xl, paddingBottom: Spacing['4xl'] },
  sectionLabel: { ...Typography.label, color: Colors.textSecondary, marginTop: Spacing.xl, marginBottom: Spacing.sm },
  chipRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip:         { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border },
  chipActive:   { borderColor: Colors.accent, backgroundColor: Colors.accent + '12' },
  chipText:     { ...Typography.subhead, color: Colors.textPrimary },
  chipTextActive: { color: Colors.accent, fontWeight: '600' },
  effortRow:    { flexDirection: 'row', gap: 5 },
  effortBtn:    { flex: 1, height: 42, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  effortNum:    { ...Typography.caption1, fontWeight: '700' },
});
