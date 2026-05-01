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
import { PHASE_LABELS, WORKOUT_LABELS, WorkoutType } from '../../src/types/enums';
import type { WorkoutDay } from '../../src/types/models';
import { workoutIsToday, workoutIsPast } from '../../src/types/models';
import { getPaceZones } from '../../src/services/PaceService';
import {
  emberScore, emberScoreLabel, emberScoreColor, predictRaceTime,
} from '../../src/services/MilestoneService';
import { nutritionNudge } from '../../src/services/WarmupService';

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
  const plan          = useAppStore(s => s.plan);
  const profile       = useAppStore(s => s.profile);
  const morningCheckin = useAppStore(s => s.morningCheckin);
  const races         = useAppStore(s => s.races);

  const weekNum      = plan ? currentWeekNumber(plan) : 1;
  const today        = plan ? todayWorkout(plan) : null;
  const workouts     = plan ? workoutsForWeek(plan, weekNum) : [];
  const doneMiles    = plan ? completedMilesThisWeek(plan) : 0;
  const targetMiles  = plan ? weeklyMileage(plan, weekNum) : 0;
  const phase        = workouts[0]?.phase;

  // Use next upcoming race from races array, fall back to profile.goalDate
  const nextRace = races
    .filter(r => !r.isCompleted)
    .sort((a, b) => a.date.localeCompare(b.date))
    .find(r => {
      const d = new Date(r.date); d.setHours(0,0,0,0);
      const n = new Date(); n.setHours(0,0,0,0);
      return d >= n;
    });
  const countdownDate = nextRace?.date ?? profile?.goalDate;
  const countdown = countdownDate ? raceCountdown(countdownDate) : null;
  const countdownLabel = nextRace && countdown
    ? `${nextRace.name}  ·  ${countdown.label}`
    : countdown?.label ?? null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning.' : hour < 17 ? 'Good afternoon.' : 'Good evening.';

  // Ember score from today's check-in
  const todayDate = new Date().toISOString().slice(0, 10);
  const todayCheckin = morningCheckin?.date === todayDate ? morningCheckin : null;
  const score = todayCheckin
    ? emberScore(todayCheckin.sleepQuality, todayCheckin.energyLevel, todayCheckin.stressLevel)
    : null;

  // Nutrition nudge for today's workout
  const nudge = today ? nutritionNudge(today.workoutType, today.distanceMiles) : null;

  // Race predictor
  const allCompleted = plan?.workoutDays.filter(w => w.isCompleted) ?? [];
  const bestPace = allCompleted.reduce((best, w) => {
    if (!w.averagePaceMinPerMile) return best;
    return best === 0 || w.averagePaceMinPerMile < best ? w.averagePaceMinPerMile : best;
  }, 0);
  const longestRun = allCompleted.reduce((best, w) => {
    const d = w.actualDistanceMiles ?? w.distanceMiles ?? 0;
    return d > best ? d : best;
  }, 0);
  const predictedTime = profile && bestPace > 0 && longestRun > 0
    ? predictRaceTime(profile.goal, longestRun, bestPace)
    : null;

  return (
    <SafeAreaView style={CommonStyles.screenBg}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, CommonStyles.rowBetween]}>
          <View>
            <Text style={[Typography.title2, { color: Colors.textPrimary }]}>{greeting}</Text>
            {plan && (
              <Text style={[Typography.subhead, { color: Colors.textSecondary, marginTop: 2 }]}>
                Week {weekNum} of {plan.totalWeeks}
                {phase ? `  ·  ${PHASE_LABELS[phase]} Phase` : ''}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.coachBtn}
            onPress={() => router.push('/coach-chat' as any)}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 20 }}>🔥</Text>
          </TouchableOpacity>
        </View>

        {/* Race countdown */}
        {countdown && countdownLabel && (
          <TouchableOpacity
            style={[styles.raceBanner, countdown.days <= 7 && styles.raceBannerUrgent]}
            onPress={() => nextRace ? router.push('/races' as any) : router.push('/edit-race-date')}
            activeOpacity={0.8}
          >
            <Text style={styles.raceBannerText}>🏁  {countdownLabel}</Text>
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

        {/* Cinder Score */}
        {todayCheckin && score !== null ? (
          <EmberScoreCard score={score} />
        ) : (
          <TouchableOpacity
            style={styles.checkinPrompt}
            onPress={() => router.push('/morning-checkin' as any)}
            activeOpacity={0.85}
          >
            <Text style={{ fontSize: 28 }}>🌅</Text>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <Text style={[Typography.headline, { color: Colors.textPrimary }]}>How are you feeling?</Text>
              <Text style={[Typography.caption1, { color: Colors.textSecondary }]}>
                Log your morning check-in to get your Cinder Score
              </Text>
            </View>
            <Text style={{ color: Colors.accent, fontSize: 20 }}>›</Text>
          </TouchableOpacity>
        )}

        {/* Today's workout */}
        {today
          ? <TodayHeroCard workout={today} />
          : <RestDayCard />
        }

        {/* Nutrition nudge */}
        {nudge && (
          <View style={styles.nudgeBanner}>
            <Text style={styles.nudgeText}>{nudge}</Text>
          </View>
        )}

        {/* Week overview */}
        {plan && (
          <WeekOverview
            workouts={workouts}
            doneMiles={doneMiles}
            targetMiles={targetMiles}
          />
        )}

        {/* Race predictor */}
        {predictedTime && profile && (
          <RacePredictorCard predictedTime={predictedTime} goal={profile.goal} />
        )}

        {/* Pace zones */}
        {profile && plan && (
          <PaceZonesCard ability={profile.ability} goal={profile.goal} />
        )}

        {/* Log a workout */}
        {plan && (
          <TouchableOpacity
            style={styles.logWorkoutBtn}
            onPress={() => router.push('/log-workout' as any)}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 22 }}>➕</Text>
            <Text style={[Typography.subhead, { color: Colors.accent, fontWeight: '600', marginLeft: Spacing.sm }]}>
              Log a Workout
            </Text>
          </TouchableOpacity>
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

// ── Cinder Score card ──────────────────────────────────────

function EmberScoreCard({ score }: { score: number }) {
  const color = emberScoreColor(score);
  const label = emberScoreLabel(score);
  const circumference = 2 * Math.PI * 34;
  const filled = (score / 100) * circumference;

  return (
    <Card style={styles.emberCard}>
      <View style={styles.emberLeft}>
        <View style={styles.scoreRing}>
          {/* Background circle track */}
          <View style={[styles.ringTrack, { borderColor: Colors.tertiary }]} />
          {/* Score indicator — simple arc using border trick */}
          <View style={[styles.ringFill, { borderColor: color, opacity: score / 100 * 0.8 + 0.2 }]} />
          <Text style={[Typography.title2, { color }]}>{score}</Text>
        </View>
      </View>
      <View style={{ flex: 1, marginLeft: Spacing.lg }}>
        <Text style={[Typography.label, { color: Colors.textSecondary }]}>CINDER SCORE</Text>
        <Text style={[Typography.headline, { color, marginTop: 2 }]}>{label}</Text>
        <TouchableOpacity onPress={() => router.push('/morning-checkin' as any)} style={{ marginTop: 4 }}>
          <Text style={[Typography.caption1, { color: Colors.accent }]}>Update check-in →</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

// ── Race predictor card ───────────────────────────────────

const GOAL_DISPLAY: Record<string, string> = {
  FiveK: '5K', TenK: '10K', HalfMarathon: 'Half Marathon',
  Marathon: 'Marathon', FasterMile: 'Mile', GetFit: 'Fitness',
};

function RacePredictorCard({ predictedTime, goal }: { predictedTime: string; goal: string }) {
  return (
    <Card style={[styles.predictorCard, { marginTop: Spacing.lg }]}>
      <View style={CommonStyles.rowBetween}>
        <View>
          <Text style={[Typography.label, { color: Colors.textSecondary }]}>RACE PREDICTOR</Text>
          <Text style={[Typography.title2, { color: Colors.accent, marginTop: 4 }]}>{predictedTime}</Text>
          <Text style={[Typography.caption1, { color: Colors.textSecondary, marginTop: 2 }]}>
            Projected {GOAL_DISPLAY[goal] ?? goal} based on training
          </Text>
        </View>
        <Text style={{ fontSize: 36 }}>🏅</Text>
      </View>
    </Card>
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

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

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

// ── Pace zones card ───────────────────────────────────────

function PaceZonesCard({ ability, goal }: { ability: any; goal: any }) {
  const zones = getPaceZones(ability, goal);
  const rows: { label: string; range: [string, string]; color: string }[] = [
    { label: 'Easy',     range: zones.easy,     color: Colors.easy },
    { label: 'Long Run', range: zones.long,      color: Colors.long },
    { label: 'Tempo',    range: zones.tempo,     color: Colors.tempo },
    { label: 'Interval', range: zones.interval,  color: Colors.accent },
  ];

  return (
    <Card style={{ marginTop: Spacing.lg }}>
      <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: Spacing.md }]}>
        YOUR TARGET PACES
      </Text>
      {rows.map(r => (
        <View key={r.label} style={styles.paceRow}>
          <View style={[styles.paceDot, { backgroundColor: r.color }]} />
          <Text style={[Typography.subhead, { color: Colors.textSecondary, width: 68 }]}>{r.label}</Text>
          <Text style={[Typography.subhead, { color: Colors.textPrimary, fontWeight: '600', flex: 1 }]}>
            {r.range[0]}–{r.range[1]}
          </Text>
          <Text style={[Typography.caption1, { color: Colors.textTertiary }]}>/mi</Text>
        </View>
      ))}
      {zones.race && (
        <View style={[styles.paceRow, { marginTop: Spacing.xs, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.separator }]}>
          <View style={[styles.paceDot, { backgroundColor: Colors.accent }]} />
          <Text style={[Typography.subhead, { color: Colors.textSecondary, width: 68 }]}>Race</Text>
          <Text style={[Typography.subhead, { color: Colors.accent, fontWeight: '700', flex: 1 }]}>{zones.race}</Text>
          <Text style={[Typography.caption1, { color: Colors.textTertiary }]}>/mi</Text>
        </View>
      )}
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
  header:       { marginBottom: Spacing.xl, alignItems: 'flex-start' },
  coachBtn:     { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.accent + '18', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.accent + '30' },

  raceBanner:       { backgroundColor: Colors.accent + '18', borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.accent + '40', flexDirection: 'row', alignItems: 'center' },
  raceBannerUrgent: { backgroundColor: Colors.success + '18', borderColor: Colors.success + '60' },
  raceBannerText:   { ...Typography.subhead, color: Colors.accent, fontWeight: '600' },
  adaptBanner:      { backgroundColor: Colors.warning + '18', borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.warning + '40' },
  adaptBannerText:  { ...Typography.subhead, color: Colors.warning },

  checkinPrompt: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border },

  emberCard:  { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg },
  emberLeft:  { alignItems: 'center', justifyContent: 'center' },
  scoreRing:  { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  ringTrack:  { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 5 },
  ringFill:   { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 5 },

  nudgeBanner: { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.lg, borderLeftWidth: 3, borderLeftColor: Colors.accent },
  nudgeText:   { ...Typography.footnote, color: Colors.textSecondary },

  logWorkoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginTop: Spacing.md, borderWidth: 1.5, borderColor: Colors.accent + '40', borderStyle: 'dashed' },

  predictorCard: { backgroundColor: Colors.surface },

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
  paceRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  paceDot:      { width: 8, height: 8, borderRadius: 4, marginRight: Spacing.sm },
});
