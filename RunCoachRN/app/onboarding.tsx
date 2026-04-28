import React, { useState } from 'react';
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
  SafeAreaView, TextInput, Switch, Animated, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useAppStore } from '../src/store/useAppStore';
import {
  InjuryRisk, InjuryType, RunningAbility, RunningGoal,
  TrainingStyle, WorkoutType, goalNeedsTaper,
  ABILITY_DESCRIPTIONS, ABILITY_LABELS, GOAL_EMOJIS, GOAL_LABELS,
  INJURY_LABELS, TRAINING_STYLE_DESCRIPTIONS, TRAINING_STYLE_LABELS,
} from '../src/types/enums';
import type { UserProfile } from '../src/types/models';
import { Colors, CommonStyles, Radius, Spacing, Typography } from '../src/theme';
import { PrimaryButton, SecondaryButton, GhostButton } from '../src/components/ui/Buttons';

const TOTAL_STEPS = 5;

function makeId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

export default function Onboarding() {
  const { setProfile, generateAndSavePlan } = useAppStore();
  const [step, setStep]               = useState(0);
  const [generating, setGenerating]   = useState(false);
  const [done, setDone]               = useState(false);

  // Form state
  const [age, setAge]                         = useState(30);
  const [ability, setAbility]                 = useState<RunningAbility>(RunningAbility.Beginner);
  const [weeklyMileage, setWeeklyMileage]     = useState(10);
  const [longestRun, setLongestRun]           = useState(4);
  const [goal, setGoal]                       = useState<RunningGoal>(RunningGoal.GetFit);
  const [hasGoalDate, setHasGoalDate]         = useState(false);
  const [goalDate, setGoalDate]               = useState(new Date());
  const [runDays, setRunDays]                 = useState(4);
  const [selectedDays, setSelectedDays]       = useState<Set<number>>(new Set([1, 3, 5, 0])); // Mon/Wed/Fri/Sun
  const [longRunDay, setLongRunDay]           = useState(0); // Sun
  const [strengthDays, setStrengthDays]       = useState(1);
  const [injuries, setInjuries]               = useState<Set<InjuryType>>(new Set([InjuryType.None]));
  const [style, setStyle]                     = useState<TrainingStyle>(TrainingStyle.Balanced);

  const canAdvance = step === 0 ? true  // all steps valid by default
    : step === 1 ? !!goal
    : true;

  function toggleInjury(i: InjuryType) {
    const next = new Set(injuries);
    if (i === InjuryType.None) { next.clear(); next.add(InjuryType.None); }
    else {
      next.delete(InjuryType.None);
      next.has(i) ? next.delete(i) : next.add(i);
      if (next.size === 0) next.add(InjuryType.None);
    }
    setInjuries(next);
  }

  async function finish() {
    setGenerating(true);
    const injuryList = Array.from(injuries);
    const hasRealInjury = injuryList.some(i => i !== InjuryType.None);
    const risk: InjuryRisk = hasRealInjury
      ? (injuryList.length > 2 ? InjuryRisk.High : InjuryRisk.Medium)
      : InjuryRisk.Low;

    const profile: UserProfile = {
      id: makeId(),
      age, ability, weeklyMileage, longestRecentRun: longestRun,
      goal,
      goalDate: hasGoalDate ? goalDate.toISOString() : undefined,
      runningDaysPerWeek: selectedDays.size, specificRunDays: Array.from(selectedDays).sort(),
      preferredLongRunDay: longRunDay,
      strengthDaysPerWeek: strengthDays, injuries: injuryList,
      trainingStyle: style, injuryRisk: risk,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    await setProfile(profile);
    await generateAndSavePlan();
    setGenerating(false);
    setDone(true);
    setTimeout(() => router.replace('/(tabs)'), 1400);
  }

  if (generating || done) {
    return (
      <SafeAreaView style={[CommonStyles.flex1, CommonStyles.center, { backgroundColor: Colors.bg }]}>
        <Text style={{ fontSize: 56 }}>{done ? '✅' : '🏃'}</Text>
        <Text style={[Typography.title2, { color: Colors.textPrimary, marginTop: Spacing.lg }]}>
          {done ? 'Your plan is ready.' : 'Building your plan…'}
        </Text>
        <Text style={[Typography.subhead, { color: Colors.textSecondary, marginTop: Spacing.sm }]}>
          {done ? "Let's get running." : 'Applying training science to your profile.'}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[CommonStyles.flex1, { backgroundColor: Colors.bg }]}>
      {/* Progress dots */}
      <View style={styles.dotsRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>

      {/* Step content */}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {step === 0 && <StepBasicInfo
          age={age} setAge={setAge}
          ability={ability} setAbility={setAbility}
          weeklyMileage={weeklyMileage} setWeeklyMileage={setWeeklyMileage}
          longestRun={longestRun} setLongestRun={setLongestRun}
        />}
        {step === 1 && <StepGoal goal={goal} setGoal={setGoal}
          hasGoalDate={hasGoalDate} setHasGoalDate={setHasGoalDate}
          goalDate={goalDate} setGoalDate={setGoalDate} />}
        {step === 2 && <StepSchedule
          selectedDays={selectedDays} setSelectedDays={setSelectedDays}
          longRunDay={longRunDay} setLongRunDay={setLongRunDay}
          strengthDays={strengthDays} setStrengthDays={setStrengthDays}
        />}
        {step === 3 && <StepInjuries injuries={injuries} toggle={toggleInjury} />}
        {step === 4 && <StepStyle style={style} setStyle={setStyle} />}
      </ScrollView>

      {/* Nav buttons */}
      <View style={styles.navRow}>
        {step > 0
          ? <SecondaryButton label="Back" onPress={() => setStep(s => s - 1)} size="md" style={{ flex: 1 }} />
          : <View style={{ flex: 1 }} />
        }
        <View style={{ width: Spacing.md }} />
        {step < TOTAL_STEPS - 1
          ? <PrimaryButton label="Next" onPress={() => setStep(s => s + 1)} size="md" style={{ flex: 2 }} disabled={!canAdvance} />
          : <PrimaryButton label="Build My Plan" onPress={finish} size="md" style={{ flex: 2 }} color={Colors.success} />
        }
      </View>
    </SafeAreaView>
  );
}

// ── Step components ───────────────────────────────────────

function StepBasicInfo({ age, setAge, ability, setAbility, weeklyMileage, setWeeklyMileage, longestRun, setLongestRun }: any) {
  return (
    <View style={styles.stepContent}>
      <StepHeader title="Tell us about yourself" sub="We'll use this to set the right starting point." />
      <Stepper label="Age" value={age} min={13} max={80} onChange={setAge} />
      <ChoiceGroup
        label="Running experience"
        options={Object.values(RunningAbility)}
        value={ability}
        getLabel={v => ABILITY_LABELS[v as RunningAbility]}
        getSub={v => ABILITY_DESCRIPTIONS[v as RunningAbility]}
        onChange={setAbility}
      />
      <Stepper label="Weekly mileage (mi)" value={weeklyMileage} min={0} max={100} step={5} onChange={setWeeklyMileage} />
      <Stepper label="Longest recent run (mi)" value={longestRun} min={0} max={30} step={1} onChange={setLongestRun} />
    </View>
  );
}

function StepGoal({ goal, setGoal, hasGoalDate, setHasGoalDate, goalDate, setGoalDate }: any) {
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 14); // at least 2 weeks out

  return (
    <View style={styles.stepContent}>
      <StepHeader title="What's your goal?" sub="This shapes every week of your plan." />
      <View style={styles.goalGrid}>
        {Object.values(RunningGoal).map(g => (
          <TouchableOpacity
            key={g}
            style={[styles.goalCard, goal === g && styles.goalCardActive]}
            onPress={() => setGoal(g)}
            activeOpacity={0.75}
          >
            <Text style={{ fontSize: 32 }}>{GOAL_EMOJIS[g as RunningGoal]}</Text>
            <Text style={[styles.goalLabel, goal === g && { color: Colors.accent }]}>
              {GOAL_LABELS[g as RunningGoal]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.raceDateRow}>
        <View style={{ flex: 1 }}>
          <Text style={[Typography.subhead, { color: Colors.textPrimary, fontWeight: '600' }]}>
            🏁  I have a race date
          </Text>
          <Text style={[Typography.caption1, { color: Colors.textSecondary }]}>
            Plan will taper for your race
          </Text>
        </View>
        <Switch
          value={hasGoalDate}
          onValueChange={setHasGoalDate}
          trackColor={{ true: Colors.accent }}
          thumbColor="#fff"
        />
      </View>

      {hasGoalDate && (
        <DateTimePicker
          value={goalDate}
          mode="date"
          display="spinner"
          minimumDate={minDate}
          onChange={(_: any, date?: Date) => date && setGoalDate(date)}
          style={{ marginTop: -Spacing.sm }}
          textColor={Colors.textPrimary}
        />
      )}
    </View>
  );
}

function StepSchedule({ selectedDays, setSelectedDays, longRunDay, setLongRunDay, strengthDays, setStrengthDays }: any) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function toggleDay(i: number) {
    const next = new Set<number>(selectedDays);
    if (next.has(i)) {
      if (next.size <= 2) return; // minimum 2 run days
      next.delete(i);
      if (longRunDay === i) setLongRunDay(Array.from(next)[0]);
    } else {
      next.add(i);
    }
    setSelectedDays(next);
  }

  return (
    <View style={styles.stepContent}>
      <StepHeader title="Set your schedule" sub="Pick the days you'll run. Be realistic — consistency beats ambition." />

      <Text style={styles.fieldLabel}>Which days will you run?</Text>
      <View style={styles.dayRow}>
        {days.map((d, i) => (
          <TouchableOpacity key={i} onPress={() => toggleDay(i)}
            style={[styles.dayBtn, selectedDays.has(i) && styles.dayBtnActive]}>
            <Text style={[styles.dayBtnText, selectedDays.has(i) && { color: '#fff' }]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[Typography.caption1, { color: Colors.textTertiary, marginBottom: Spacing.xl }]}>
        {selectedDays.size} days selected · tap to toggle
      </Text>

      <Text style={styles.fieldLabel}>Which is your long run day?</Text>
      <View style={[styles.dayRow, { marginBottom: Spacing.xl }]}>
        {days.map((d, i) => {
          const isRun = selectedDays.has(i);
          return (
            <TouchableOpacity key={i} onPress={() => isRun && setLongRunDay(i)}
              style={[styles.dayBtn, longRunDay === i && styles.dayBtnActive, !isRun && { opacity: 0.25 }]}>
              <Text style={[styles.dayBtnText, longRunDay === i && { color: '#fff' }]}>{d}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Stepper label="Strength days / week" value={strengthDays} min={0} max={3} onChange={setStrengthDays} />
      <InfoBox text="Strength training days are scheduled on non-running days where possible." />
    </View>
  );
}

function StepInjuries({ injuries, toggle }: { injuries: Set<InjuryType>; toggle: (i: InjuryType) => void }) {
  return (
    <View style={styles.stepContent}>
      <StepHeader title="Injury history" sub="Past injuries shape how we progress your training. Be honest — we adjust, not avoid." />
      <View style={styles.injuryGrid}>
        {Object.values(InjuryType).map(i => {
          const sel = injuries.has(i as InjuryType);
          return (
            <TouchableOpacity key={i} onPress={() => toggle(i as InjuryType)}
              style={[styles.injuryChip, sel && styles.injuryChipActive]}>
              <Text style={[styles.injuryLabel, sel && { color: Colors.accent }]}>
                {INJURY_LABELS[i as InjuryType]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function StepStyle({ style, setStyle }: any) {
  return (
    <View style={styles.stepContent}>
      <StepHeader title="Training style" sub="How fast do you want to push the load?" />
      <ChoiceGroup
        label=""
        options={Object.values(TrainingStyle)}
        value={style}
        getLabel={v => TRAINING_STYLE_LABELS[v as TrainingStyle]}
        getSub={v => TRAINING_STYLE_DESCRIPTIONS[v as TrainingStyle]}
        onChange={setStyle}
      />
      <InfoBox text="When in doubt, choose Balanced. You can always regenerate your plan later." />
    </View>
  );
}

// ── Primitives ────────────────────────────────────────────

function StepHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <View style={{ marginBottom: Spacing.xl }}>
      <Text style={[Typography.title2, { color: Colors.textPrimary }]}>{title}</Text>
      <Text style={[Typography.subhead, { color: Colors.textSecondary, marginTop: 4 }]}>{sub}</Text>
    </View>
  );
}

function Stepper({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={CommonStyles.row}>
        <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(Math.max(min, value - step))}>
          <Text style={styles.stepBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{value}</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(Math.min(max, value + step))}>
          <Text style={styles.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ChoiceGroup<T extends string>({ label, options, value, getLabel, getSub, onChange }: {
  label: string; options: T[]; value: T; getLabel: (v: T) => string;
  getSub?: (v: T) => string; onChange: (v: T) => void;
}) {
  return (
    <View style={{ marginBottom: Spacing.xl }}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      {options.map(opt => {
        const sel = opt === value;
        return (
          <TouchableOpacity key={opt} onPress={() => onChange(opt)}
            style={[styles.choiceCard, sel && styles.choiceCardActive]}>
            <View style={[styles.choiceCheck, sel && { borderColor: Colors.accent }]}>
              {sel && <View style={styles.choiceCheckFill} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.choiceTitle, sel && { color: Colors.accent }]}>{getLabel(opt)}</Text>
              {getSub && <Text style={styles.choiceSub}>{getSub(opt)}</Text>}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function InfoBox({ text }: { text: string }) {
  return (
    <View style={styles.infoBox}>
      <Text style={styles.infoText}>ℹ️  {text}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  dotsRow:    { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  dot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.tertiary },
  dotActive:  { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accent },
  scroll:     { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['3xl'] },
  stepContent:{ paddingTop: Spacing.md },
  navRow:     { flexDirection: 'row', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.separator, backgroundColor: Colors.bg },

  fieldLabel: { ...Typography.headline, color: Colors.textPrimary, marginBottom: Spacing.sm },
  stepper:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xl },
  stepBtn:    { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  stepBtnText:{ ...Typography.title3, color: Colors.accent },
  stepperValue: { ...Typography.title3, color: Colors.textPrimary, minWidth: 48, textAlign: 'center' },

  goalGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: Spacing.xl },
  raceDateRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md },
  goalCard:   { width: '47%', padding: Spacing.lg, backgroundColor: Colors.surface, borderRadius: Radius.md, alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: 'transparent' },
  goalCardActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '0A' },
  goalLabel:  { ...Typography.subhead, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },

  dayRow:     { flexDirection: 'row', gap: 6, marginTop: Spacing.sm },
  dayBtn:     { flex: 1, paddingVertical: 10, backgroundColor: Colors.surface, borderRadius: Radius.sm, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  dayBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  dayBtnText: { ...Typography.caption1, fontWeight: '600', color: Colors.textPrimary },

  injuryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  injuryChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border },
  injuryChipActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '0A' },
  injuryLabel: { ...Typography.subhead, color: Colors.textPrimary },

  choiceCard:       { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, padding: Spacing.lg, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1.5, borderColor: 'transparent', marginBottom: Spacing.sm },
  choiceCardActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '0A' },
  choiceCheck:      { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  choiceCheckFill:  { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.accent },
  choiceTitle:      { ...Typography.headline, color: Colors.textPrimary },
  choiceSub:        { ...Typography.caption1, color: Colors.textSecondary, marginTop: 2 },

  infoBox:    { flexDirection: 'row', padding: Spacing.md, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm, marginTop: Spacing.sm },
  infoText:   { ...Typography.footnote, color: Colors.textSecondary, flex: 1 },

  ...CommonStyles,
});
