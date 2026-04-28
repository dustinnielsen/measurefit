import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, SafeAreaView, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppStore, selectElapsedSeconds } from '../../src/store/useAppStore';
import { LocationService, formatDuration, formatPace } from '../../src/services/LocationService';
import { workoutColor, Colors, CommonStyles, Radius, Spacing, Typography } from '../../src/theme';
import { Card } from '../../src/components/ui/Card';
import { PrimaryButton, SecondaryButton, GhostButton } from '../../src/components/ui/Buttons';
import { Pill } from '../../src/components/ui/Pill';
import { PHASE_LABELS, WORKOUT_LABELS, WorkoutType, isRunWorkout } from '../../src/types/enums';
import { deriveWorkoutStructure } from '../../src/types/models';

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const plan    = useAppStore(s => s.plan);
  const session = useAppStore(s => s.session);
  const { startSession, pauseSession, resumeSession, endSession, updateWorkout, updateSessionGPS } = useAppStore();

  const workout = plan?.workoutDays.find(w => w.id === id);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [tick, setTick] = useState(0); // force re-render for elapsed time

  const elapsed  = selectElapsedSeconds(session?.workoutId === id ? session : null);
  const isActive = session?.workoutId === id;
  const isRunning = isActive && session?.isActive;

  const structure = workout ? deriveWorkoutStructure(workout) : null;
  const color     = workout ? workoutColor(workout.workoutType) : Colors.accent;

  // Tick timer every second
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => setTick(t => t + 1), 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning]);

  if (!workout) {
    return (
      <SafeAreaView style={CommonStyles.screenBg}>
        <Text style={{ padding: 24, color: Colors.textSecondary }}>Workout not found.</Text>
      </SafeAreaView>
    );
  }

  async function handleStart() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startSession(workout!.id);

    if (isRunWorkout(workout!.workoutType)) {
      const granted = await LocationService.requestPermissions();
      if (granted) {
        LocationService.startTracking((update) => {
          updateSessionGPS(update.point, update.distanceMiles, update.currentPaceMinPerMile ?? undefined);
        });
      }
    }
  }

  function handlePause() {
    pauseSession();
    if (LocationService.isTracking()) LocationService.stopTracking();
  }

  async function handleResume() {
    resumeSession();
    if (isRunWorkout(workout!.workoutType)) {
      await LocationService.startTracking((update) => {
        updateSessionGPS(update.point, update.distanceMiles, update.currentPaceMinPerMile ?? undefined);
      });
    }
  }

  function handleComplete() {
    Alert.alert(
      'Finish workout?',
      'This will save your session and open the check-in.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Finish', style: 'default', onPress: confirmComplete },
      ],
    );
  }

  async function confirmComplete() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const finished = endSession();
    let gpsData = { points: [], distanceMiles: 0 } as any;
    if (LocationService.isTracking()) gpsData = LocationService.stopTracking();

    await updateWorkout(workout!.id, {
      isCompleted:          true,
      completedAt:          new Date().toISOString(),
      actualDurationSeconds: finished ? Math.floor((Date.now() - finished.startedAt - finished.totalPausedMs) / 1000) : undefined,
      actualDistanceMiles:   finished?.distanceMiles || gpsData.distanceMiles || undefined,
      route:                 gpsData.points.length > 0 ? gpsData.points : undefined,
    });

    router.replace(`/checkin/${workout!.id}`);
  }

  function handleSkip() {
    Alert.alert('Skip this workout?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Skip', style: 'destructive', onPress: async () => {
        await updateWorkout(workout!.id, { isSkipped: true });
        router.back();
      }},
    ]);
  }

  return (
    <SafeAreaView style={[CommonStyles.flex1, { backgroundColor: Colors.bg }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: color }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>✕</Text>
          </TouchableOpacity>
          {workout.adaptationNote && <Pill text="Adapted" color="#fff" />}

          <View style={styles.headerBody}>
            <Text style={{ fontSize: 52 }}>{WORKOUT_EMOJIS[workout.workoutType]}</Text>
            <View style={{ flex: 1, marginLeft: Spacing.lg }}>
              <Text style={styles.headerTitle}>{WORKOUT_LABELS[workout.workoutType]}</Text>
              <Text style={styles.headerSub}>{PHASE_LABELS[workout.phase]} Phase</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            {workout.distanceMiles != null &&
              <StatChip label="Distance" value={`${workout.distanceMiles.toFixed(1)} mi`} />}
            {workout.durationMinutes != null &&
              <StatChip label="Duration" value={`${workout.durationMinutes} min`} />}
            <StatChip label="Date" value={formatDate(workout.date)} />
          </View>
        </View>

        <View style={{ padding: Spacing.xl, gap: Spacing.md }}>
          {/* Live session stats */}
          {isActive && (
            <View style={[styles.liveCard, { borderColor: color + '50' }]}>
              <LiveStat label="Time"     value={formatDuration(elapsed)} />
              <LiveStat label="Distance" value={session!.distanceMiles > 0 ? `${session!.distanceMiles.toFixed(2)} mi` : '--'} />
              <LiveStat label="Pace"     value={formatPace(session!.currentPaceMinPerMile)} suffix="/mi" />
            </View>
          )}

          {/* Adaptation banner */}
          {workout.adaptationNote && (
            <Card style={styles.adaptCard}>
              <Text style={styles.adaptTitle}>🔄  Plan adjusted</Text>
              {workout.preAdaptType && (
                <Text style={styles.adaptOrig}>
                  Was: {WORKOUT_LABELS[workout.preAdaptType]}
                  {workout.preAdaptDistance != null ? `  (${workout.preAdaptDistance.toFixed(1)} mi)` : ''}
                </Text>
              )}
              <Text style={styles.adaptNote}>{workout.adaptationNote}</Text>
            </Card>
          )}

          {/* Workout structure */}
          {structure && (
            <>
              {structure.warmup ? <PhaseCard icon="🔥" title="Warm-Up"   body={structure.warmup}   color={Colors.warning} /> : null}
              <PhaseCard icon="🏃" title="Main Set"  body={structure.mainSet}  color={color} />
              {structure.cooldown ? <PhaseCard icon="🌬️" title="Cool-Down" body={structure.cooldown} color={Colors.long} /> : null}

              <Card style={styles.effortCard}>
                <View style={[styles.effortIcon, { backgroundColor: color + '18' }]}>
                  <Text style={{ fontSize: 22 }}>🎯</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.effortLabel}>EFFORT TARGET</Text>
                  <Text style={[Typography.subhead, { color: Colors.textPrimary }]}>{structure.effortCue}</Text>
                </View>
              </Card>

              {workout.coachingNotes ? (
                <Card>
                  <Text style={styles.coachLabel}>COACH'S NOTE</Text>
                  <Text style={[Typography.subhead, { color: Colors.textSecondary }]}>{workout.coachingNotes}</Text>
                </Card>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        {workout.isCompleted ? (
          <Text style={[Typography.subhead, { color: Colors.textSecondary, textAlign: 'center' }]}>
            ✅ Workout complete
          </Text>
        ) : workout.isSkipped ? (
          <Text style={[Typography.subhead, { color: Colors.textSecondary, textAlign: 'center' }]}>
            Workout skipped
          </Text>
        ) : isRunning ? (
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <SecondaryButton label="Pause"  onPress={handlePause}    size="lg" style={{ flex: 1 }} />
            <PrimaryButton   label="Finish" onPress={handleComplete} size="lg" style={{ flex: 2 }} color={Colors.success} />
          </View>
        ) : isActive ? (
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <PrimaryButton label="Resume"  onPress={handleResume}   size="lg" style={{ flex: 2 }} color={color} />
            <PrimaryButton label="Finish"  onPress={handleComplete} size="lg" style={{ flex: 1 }} color={Colors.success} />
          </View>
        ) : (
          <View style={{ gap: Spacing.sm }}>
            <PrimaryButton label="Start Workout" onPress={handleStart} size="lg" color={color} />
            <GhostButton label="Mark Complete Without Timer" onPress={confirmComplete} />
          </View>
        )}
        {!workout.isCompleted && !workout.isSkipped && !isActive && (
          <GhostButton label="Skip This Workout" onPress={handleSkip}
            style={{ marginTop: 4 }} color={Colors.textTertiary} />
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────

function PhaseCard({ icon, title, body, color }: { icon: string; title: string; body: string; color: string }) {
  return (
    <Card>
      <Text style={[Typography.label, { color, marginBottom: Spacing.sm }]}>{icon}  {title}</Text>
      <Text style={[Typography.body, { color: Colors.textPrimary }]}>{body}</Text>
    </Card>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statChip}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function LiveStat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[Typography.title3, { color: Colors.textPrimary, fontVariant: ['tabular-nums'] }]}>
        {value}{suffix ?? ''}
      </Text>
      <Text style={[Typography.caption1, { color: Colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const WORKOUT_EMOJIS: Record<WorkoutType, string> = {
  [WorkoutType.Easy]: '🏃', [WorkoutType.Long]: '🛣️', [WorkoutType.Tempo]: '⏱️',
  [WorkoutType.Intervals]: '⚡️', [WorkoutType.Strides]: '💨',
  [WorkoutType.Rest]: '😴', [WorkoutType.Strength]: '🏋️', [WorkoutType.Mobility]: '🧘',
};

// ── Styles ────────────────────────────────────────────────
const { long: _long, ..._ } = Colors; // suppress unused import warning

const styles = StyleSheet.create({
  header:      { padding: Spacing.xl, paddingTop: Spacing.xxl },
  backBtn:     { alignSelf: 'flex-start', marginBottom: Spacing.md },
  backText:    { ...Typography.title3, color: 'rgba(255,255,255,0.85)' },
  headerBody:  { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.md },
  headerTitle: { ...Typography.largeTitle, color: '#fff' },
  headerSub:   { ...Typography.subhead, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  statsRow:    { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  statChip:    { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  statValue:   { ...Typography.subhead, fontWeight: '700', color: '#fff' },
  statLabel:   { ...Typography.caption2, color: 'rgba(255,255,255,0.75)' },

  liveCard:    { flexDirection: 'row', padding: Spacing.lg, backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1.5, gap: Spacing.sm },
  adaptCard:   { padding: Spacing.lg, backgroundColor: Colors.warning + '10', borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.warning + '40' },
  adaptTitle:  { ...Typography.headline, color: Colors.warning, marginBottom: 4 },
  adaptOrig:   { ...Typography.caption1, color: Colors.textSecondary, textDecorationLine: 'line-through', marginBottom: 2 },
  adaptNote:   { ...Typography.footnote, color: Colors.textSecondary },

  effortCard:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  effortIcon:  { width: 48, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  effortLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: 4 },
  coachLabel:  { ...Typography.label, color: Colors.textSecondary, marginBottom: Spacing.sm },

  bottomBar:   { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surface + 'F0', padding: Spacing.xl, paddingBottom: Spacing.xxl, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.separator },
});
