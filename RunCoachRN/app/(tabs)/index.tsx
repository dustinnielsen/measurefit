import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import {
  useAppStore, currentWeekNumber, todayWorkout,
  workoutsForWeek, completedMilesThisWeek, weeklyMileage,
} from '../../src/store/useAppStore';
import { workoutColor } from '../../src/theme';
import { Colors, CommonStyles, Radius, Spacing, Typography } from '../../src/theme';
import { Card } from '../../src/components/ui/Card';
import { Pill } from '../../src/components/ui/Pill';
import { WorkoutTypeBadge } from '../../src/components/ui/WorkoutTypeBadge';
import { PHASE_LABELS, WORKOUT_LABELS, WorkoutType } from '../../src/types/enums';
import type { WorkoutDay } from '../../src/types/models';
import { workoutIsToday, workoutIsPast, workoutSummaryLine } from '../../src/types/models';

function raceCountdown(goalDate: string): { days: number; label: string } | null {
  const race = new Date(goalDate);
  const now  = new Date();
  race.setHours(0,0,0,0); now.setHours(0,0,0,0);
  const days = Math.round((race.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return null;
  if (days === 0) return { days: 0, label: 'Race day! 🎉' };
  if (days === 1) return { days: 1, label: '1 day to race day' };
  return { days, label: `${days} days to race day` };
}

export default function TodayTab() {
  const plan     = useAppStore(s => s.plan);
  const profile  = useAppStore(s => s.profile);
  const weekNum  = plan ? currentWeekNumber(plan) : 1;
  const today    = plan ? todayWorkout(plan) : null;
  const workouts = plan ? workoutsForWeek(plan, weekNum) : [];
  const doneMiles = plan ? completedMilesThisWeek(plan) : 0;
  const targetMiles = plan ? weeklyMileage(plan, weekNum) : 0;
  const phase    = workouts[0]?.phase;

  const countdown = profile?.goalDate ? raceCountdown(profile.goalDate) : null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning.' : hour < 17 ? 'Good afternoon.' : 'Good evening.';

  return (
    <SafeAreaView style={CommonStyles.screenBg}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[Typography.title2, { color: Colors.textPrimary }]}>{greeting}</Text>
          {plan && (
            <Text style={[Typography.subhead, { color: Colors.textSecondary, marginTop: 2 }]}>
              Week {weekNum} of {plan.totalWeeks}
              {phase ? `  ·  ${PHASE_LABELS[phase]} Phase` : ''}
            </Text>
          )}
        </View>

        {/* Race countdown */}
        {countdown && (
          <TouchableOpacity style={[styles.raceBanner, countdown.days <= 7 && styles.raceBannerUrgent]}
            onPress={() => router.push('/edit-race-date')} activeOpacity={0.8}>
            <Text style={styles.raceBannerText}>🏁  {countdown.label}</Text>
          </TouchableOpacity>
        )}

        {/* Adaptation banner */}
        {plan && plan.workoutDays.some(w => w.adaptationNote && !w.isCompleted) && (
          <View style={styles.adaptBanner}>
            <Text style={styles.adaptBannerText}>
              🔄  Plan adjusted based on your recent check-in
            </Text>
          </View>
        )}

        {/* Today's workout */}
        {today
          ? <TodayHeroCard workout={today} />
          : <RestDayCard />
        }

        {/* Week overview */}
        {plan && (
          <WeekOverview
            workouts={workouts}
            doneMiles={doneMiles}
            targetMiles={targetMiles}
          />
        )}

        {!plan && (
          <Card style={{ alignItems: 'center', padding: Spacing.xxl }}>
            <Text style={{ fontSize: 48 }}>🏃</Text>
            <Text style={[Typography.headline, { color: Colors.textPrimary, marginTop: Spacing.md }]}>
              No plan yet
            </Text>
            <Text style={[Typography.subhead, { color: Colors.textSecondary, marginTop: 4, textAlign: 'center' }]}>
              Something went wrong loading your plan. Try restarting the app.
            </Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Today hero card ───────────────────────────────────────

function TodayHeroCard({ workout }: { workout: WorkoutDay }) {
  const color = workoutColor(workout.workoutType);
  return (
    <TouchableOpacity
      style={[styles.heroCard, { shadowColor: color }]}
      activeOpacity={0.9}
      onPress={() => router.push(`/workout/${workout.id}`)}
    >
      {/* Gradient-style header strip */}
      <View style={[styles.heroStrip, { backgroundColor: color }]}>
        <View>
          <Text style={styles.heroLabel}>TODAY</Text>
          <Text style={styles.heroTitle}>{WORKOUT_LABELS[workout.workoutType]}</Text>
        </View>
        <View style={styles.heroRight}>
          <Text style={{ fontSize: 40 }}>{getEmoji(workout.workoutType)}</Text>
          {workout.isCompleted && <Pill text="Done" color="#fff" />}
          {workout.adaptationNote && !workout.isCompleted && <Pill text="Adapted" color="#fff" />}
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.heroStats}>
        {workout.distanceMiles != null && (
          <HeroStat label="Distance" value={`${workout.distanceMiles.toFixed(1)} mi`} />
        )}
        {workout.durationMinutes != null && (
          <HeroStat label="Duration" value={`${workout.durationMinutes} min`} />
        )}
        {workout.phase && (
          <HeroStat label="Phase" value={PHASE_LABELS[workout.phase]} />
        )}
        <View style={{ flex: 1 }} />
        <Text style={{ color: Colors.textTertiary, fontSize: 18 }}>›</Text>
      </View>

      {/* Description */}
      <Text style={styles.heroDesc} numberOfLines={2}>{workout.workoutDescription}</Text>
    </TouchableOpacity>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginRight: Spacing.xl }}>
      <Text style={[Typography.headline, { color: Colors.textPrimary }]}>{value}</Text>
      <Text style={[Typography.caption2, { color: Colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function RestDayCard() {
  return (
    <Card style={styles.restCard}>
      <Text style={{ fontSize: 40 }}>😴</Text>
      <View style={{ flex: 1, marginLeft: Spacing.lg }}>
        <Text style={[Typography.headline, { color: Colors.textPrimary }]}>Rest Day</Text>
        <Text style={[Typography.subhead, { color: Colors.textSecondary }]}>
          No workout today. Recover, hydrate, sleep well.
        </Text>
      </View>
    </Card>
  );
}

// ── Week overview ─────────────────────────────────────────

function WeekOverview({ workouts, doneMiles, targetMiles }: {
  workouts: WorkoutDay[]; doneMiles: number; targetMiles: number;
}) {
  const progress = targetMiles > 0 ? Math.min(doneMiles / targetMiles, 1) : 0;
  const DAY_LETTERS = ['S','M','T','W','T','F','S'];

  return (
    <Card style={{ marginTop: Spacing.lg }}>
      <View style={CommonStyles.rowBetween}>
        <Text style={[Typography.headline, { color: Colors.textPrimary }]}>This Week</Text>
        <Text style={[Typography.subhead, { color: Colors.textSecondary }]}>
          {doneMiles.toFixed(1)} / {Math.round(targetMiles)} mi
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {/* Day dots */}
      <View style={styles.dotsRow}>
        {workouts.sort((a,b) => a.dayOfWeek - b.dayOfWeek).map(w => {
          const isToday = workoutIsToday(w);
          const isPast  = workoutIsPast(w);
          const color   = w.isCompleted ? Colors.success
            : w.isSkipped  ? Colors.textTertiary
            : isToday      ? workoutColor(w.workoutType)
            : isPast       ? Colors.warning
            : Colors.surfaceAlt;
          return (
            <TouchableOpacity key={w.id} style={styles.dotCol}
              onPress={() => router.push(`/workout/${w.id}`)}>
              <Text style={styles.dotDayLabel}>{DAY_LETTERS[w.dayOfWeek]}</Text>
              <View style={[styles.dotCircle, { backgroundColor: color }]}>
                <Text style={{ fontSize: 13 }}>
                  {w.isCompleted ? '✓' : w.isSkipped ? '×'
                    : (w.workoutType === WorkoutType.Rest || w.workoutType === WorkoutType.Mobility)
                    ? '—' : getEmoji(w.workoutType)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </Card>
  );
}

function getEmoji(type: WorkoutType) {
  const map: Record<WorkoutType, string> = {
    [WorkoutType.Easy]: '🏃', [WorkoutType.Long]: '🛣️', [WorkoutType.Tempo]: '⏱️',
    [WorkoutType.Intervals]: '⚡️', [WorkoutType.Strides]: '💨',
    [WorkoutType.Rest]: '😴', [WorkoutType.Strength]: '🏋️', [WorkoutType.Mobility]: '🧘',
  };
  return map[type];
}

// ── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll:       { padding: Spacing.xl, paddingBottom: Spacing['4xl'] },
  header:       { marginBottom: Spacing.xl },
  raceBanner:       { backgroundColor: Colors.accent + '18', borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.accent + '40', flexDirection: 'row', alignItems: 'center' },
  raceBannerUrgent: { backgroundColor: Colors.success + '18', borderColor: Colors.success + '60' },
  raceBannerText:   { ...Typography.subhead, color: Colors.accent, fontWeight: '600' },
  adaptBanner:      { backgroundColor: Colors.warning + '18', borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.warning + '40' },
  adaptBannerText:  { ...Typography.subhead, color: Colors.warning },

  heroCard:     { backgroundColor: Colors.surface, borderRadius: Radius.xl, overflow: 'hidden', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 8, marginBottom: Spacing.lg },
  heroStrip:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.xl, paddingBottom: Spacing.lg },
  heroLabel:    { ...Typography.label, color: 'rgba(255,255,255,0.8)' },
  heroTitle:    { ...Typography.title2, color: '#fff', marginTop: 2 },
  heroRight:    { alignItems: 'flex-end', gap: 6 },
  heroStats:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingTop: Spacing.md },
  heroDesc:     { ...Typography.footnote, color: Colors.textSecondary, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg, paddingTop: 4 },

  restCard:     { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg },
  progressTrack:{ height: 6, backgroundColor: Colors.tertiary, borderRadius: 3, marginTop: Spacing.md, marginBottom: Spacing.lg, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 3 },
  dotsRow:      { flexDirection: 'row', justifyContent: 'space-between' },
  dotCol:       { alignItems: 'center', gap: 4, flex: 1 },
  dotDayLabel:  { ...Typography.caption2, color: Colors.textSecondary },
  dotCircle:    { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
