import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, SafeAreaView, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import { useAppStore, selectElapsedSeconds } from '../../src/store/useAppStore';
import { LocationService, formatDuration, formatPace } from '../../src/services/LocationService';
import { workoutColor, Colors, CommonStyles, Radius, Spacing, Typography } from '../../src/theme';
import { Card } from '../../src/components/ui/Card';
import { PrimaryButton, SecondaryButton, GhostButton } from '../../src/components/ui/Buttons';
import { Pill } from '../../src/components/ui/Pill';
import { MilestoneModal } from '../../src/components/ui/MilestoneModal';
import { RouteMap } from '../../src/components/ui/RouteMap';
import { PHASE_LABELS, WORKOUT_LABELS, WorkoutType, isRunWorkout } from '../../src/types/enums';
import { deriveWorkoutStructure } from '../../src/types/models';
import { targetPaceForWorkout, paceZoneLabel } from '../../src/services/PaceService';
import { getWarmupRoutine } from '../../src/services/WarmupService';
import { checkNewMilestones, MILESTONES } from '../../src/services/MilestoneService';
import { parseGPX } from '../../src/services/GPXService';
import { estimateCalories } from '../../src/services/CalorieService';
import type { Milestone } from '../../src/types/models';

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const plan             = useAppStore(s => s.plan);
  const profile          = useAppStore(s => s.profile);
  const session          = useAppStore(s => s.session);
  const morningCheckin   = useAppStore(s => s.morningCheckin);
  const earnedMilestones = useAppStore(s => s.earnedMilestones);
  const { startSession, pauseSession, resumeSession, endSession, updateWorkout, updateSessionGPS, earnMilestone } = useAppStore();

  const workout = plan?.workoutDays.find(w => w.id === id);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [tick, setTick] = useState(0);
  const [newMilestone, setNewMilestone] = useState<Milestone | null>(null);
  const [warmupExpanded, setWarmupExpanded] = useState(false);

  const elapsed   = selectElapsedSeconds(session?.workoutId === id ? session : null);
  const isActive  = session?.workoutId === id;
  const isRunning = isActive && session?.isActive;

  const structure  = workout ? deriveWorkoutStructure(workout) : null;
  const color      = workout ? workoutColor(workout.workoutType) : Colors.accent;
  const targetPace = (workout && profile)
    ? targetPaceForWorkout(workout.workoutType, profile.ability, profile.goal)
    : null;

  const todayDate    = new Date().toISOString().slice(0, 10);
  const todayCheckin = morningCheckin?.date === todayDate ? morningCheckin : null;
  const warmup       = workout
    ? getWarmupRoutine(workout.workoutType, todayCheckin?.energyLevel)
    : null;

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
      await LocationService.startTracking((update) => {
        updateSessionGPS(update.point, update.distanceMiles, update.currentPaceMinPerMile ?? undefined);
      });
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

    const durationSecs = finished
      ? Math.floor((Date.now() - finished.startedAt - finished.totalPausedMs) / 1000)
      : undefined;
    const weightLbs = useAppStore.getState().weightEntries.slice(-1)[0]?.weight ?? 155;
    const calories = durationSecs && workout
      ? estimateCalories(workout.workoutType, durationSecs, weightLbs)
      : undefined;

    await updateWorkout(workout!.id, {
      isCompleted:           true,
      completedAt:           new Date().toISOString(),
      actualDurationSeconds: durationSecs,
      actualDistanceMiles:   finished?.distanceMiles || gpsData.distanceMiles || undefined,
      route:                 gpsData.points.length > 0 ? gpsData.points : undefined,
      estimatedCalories:     calories,
    });

    // Check for newly earned milestones
    const updatedPlan = useAppStore.getState().plan;
    if (updatedPlan) {
      const newIds = checkNewMilestones(updatedPlan, earnedMilestones);
      if (newIds.length > 0) {
        for (const mid of newIds) {
          await earnMilestone(mid);
        }
        // Show the first new milestone — others will show on next visits
        const first = MILESTONES[newIds[0]];
        if (first) {
          setNewMilestone(first);
          return; // don't navigate yet — modal will dismiss to checkin
        }
      }
    }

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

  function handleMilestoneDismiss() {
    setNewMilestone(null);
    router.replace(`/checkin/${workout!.id}`);
  }

  async function handleGPXImport() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/gpx+xml', 'text/xml', 'application/xml', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const file = result.assets[0];
      const response = await fetch(file.uri);
      const xml = await response.text();
      const parsed = parseGPX(xml);

      if (!parsed) {
        Alert.alert('Could not parse GPX', 'Make sure this is a valid .gpx file from your watch or GPS device.');
        return;
      }

      Alert.alert(
        'Import this run?',
        `Distance: ${parsed.distanceMiles.toFixed(2)} mi\nDuration: ${formatDuration(parsed.durationSeconds)}${parsed.name ? `\nName: ${parsed.name}` : ''}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            onPress: async () => {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              const avgPace = parsed.distanceMiles > 0
                ? (parsed.durationSeconds / 60) / parsed.distanceMiles
                : undefined;
              const weightLbs = useAppStore.getState().weightEntries.slice(-1)[0]?.weight ?? 155;
              const calories = estimateCalories(workout!.workoutType, parsed.durationSeconds, weightLbs);

              await updateWorkout(workout!.id, {
                isCompleted:           true,
                completedAt:           new Date().toISOString(),
                actualDurationSeconds: parsed.durationSeconds,
                actualDistanceMiles:   parsed.distanceMiles,
                averagePaceMinPerMile: avgPace,
                route:                 parsed.points,
                estimatedCalories:     calories,
              });

              const updatedPlan = useAppStore.getState().plan;
              if (updatedPlan) {
                const newIds = checkNewMilestones(updatedPlan, earnedMilestones);
                for (const mid of newIds) await earnMilestone(mid);
                const first = newIds.length > 0 ? MILESTONES[newIds[0]] : null;
                if (first) { setNewMilestone(first); return; }
              }
              router.replace(`/checkin/${workout!.id}`);
            },
          },
        ],
      );
    } catch {
      Alert.alert('Error', 'Could not read the file. Please try again.');
    }
  }

  return (
    <SafeAreaView style={[CommonStyles.flex1, { backgroundColor: Colors.bg }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: color }]}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backText}>✕</Text>
            </TouchableOpacity>
            {!workout.isCompleted && !workout.isSkipped && !isActive && (
              <TouchableOpacity onPress={() => router.push(`/edit-workout/${id}` as any)}>
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
          {workout.adaptationNote && <Pill text="Adapted" color="#fff" />}

          <View style={styles.headerBody}>
            <Text style={{ fontSize: 52 }}>{WORKOUT_EMOJIS[workout.workoutType]}</Text>
            <View style={{ flex: 1, marginLeft: Spacing.lg }}>
              <Text style={styles.headerTitle}>{WORKOUT_LABELS[workout.workoutType]}</Text>
              <Text style={styles.headerSub}>{PHASE_LABELS[workout.phase]} Phase</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            {workout.isCompleted && workout.actualDistanceMiles != null
              ? <StatChip label="Distance" value={`${workout.actualDistanceMiles.toFixed(2)} mi`} />
              : workout.distanceMiles != null
              ? <StatChip label="Distance" value={`${workout.distanceMiles.toFixed(1)} mi`} />
              : null}
            {workout.isCompleted && workout.actualDurationSeconds != null
              ? <StatChip label="Duration" value={formatDuration(workout.actualDurationSeconds)} />
              : workout.durationMinutes != null
              ? <StatChip label="Duration" value={`${workout.durationMinutes} min`} />
              : null}
            {workout.isCompleted && workout.estimatedCalories
              ? <StatChip label="Calories" value={`~${workout.estimatedCalories}`} />
              : null}
            <StatChip label="Date" value={formatDate(workout.date)} />
          </View>
        </View>

        <View style={{ padding: Spacing.xl, gap: Spacing.md }}>
          {/* Live session stats */}
          {isActive && (
            <>
              <View style={[styles.liveCard, { borderColor: color + '50' }]}>
                <LiveStat label="Time"     value={formatDuration(elapsed)} />
                <LiveStat label="Distance" value={session!.distanceMiles > 0 ? `${session!.distanceMiles.toFixed(2)} mi` : '--'} />
                <LiveStat label="Pace"     value={formatPace(session!.currentPaceMinPerMile)} suffix="/mi" />
              </View>
              {targetPace && (
                <View style={styles.targetPaceBar}>
                  <Text style={[Typography.caption1, { color: Colors.textSecondary }]}>
                    {paceZoneLabel(workout.workoutType)}
                  </Text>
                  <Text style={[Typography.subhead, { color, fontWeight: '700' }]}>
                    {targetPace[0]}–{targetPace[1]} /mi
                  </Text>
                </View>
              )}
            </>
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

          {/* Pre-run warmup (only before workout starts) */}
          {!isActive && !workout.isCompleted && !workout.isSkipped &&
           warmup && warmup.steps.length > 0 && workout.workoutType !== WorkoutType.Rest && (
            <TouchableOpacity
              style={styles.warmupHeader}
              onPress={() => setWarmupExpanded(e => !e)}
              activeOpacity={0.8}
            >
              <View style={CommonStyles.row}>
                <Text style={{ fontSize: 20, marginRight: Spacing.sm }}>🔥</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.headline, { color: Colors.textPrimary }]}>{warmup.title}</Text>
                  <Text style={[Typography.caption1, { color: Colors.textSecondary }]}>
                    {warmup.totalMinutes} min · {warmup.steps.length} steps
                  </Text>
                </View>
                <Text style={[Typography.subhead, { color: Colors.accent }]}>
                  {warmupExpanded ? 'Hide' : 'Show'}
                </Text>
              </View>

              {warmupExpanded && (
                <View style={styles.warmupSteps}>
                  {warmup.steps.map((step, i) => (
                    <View key={i} style={styles.warmupStep}>
                      <View style={styles.warmupNum}>
                        <Text style={[Typography.caption1, { color: Colors.accent, fontWeight: '700' }]}>{i + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[Typography.subhead, { color: Colors.textPrimary, fontWeight: '600' }]}>{step.name}</Text>
                        <Text style={[Typography.caption1, { color: Colors.textSecondary }]}>{step.detail}</Text>
                      </View>
                      <Text style={[Typography.caption1, { color: Colors.textTertiary }]}>{step.duration}</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
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
                  {targetPace && (
                    <Text style={[Typography.caption1, { color, fontWeight: '600', marginTop: 4 }]}>
                      {targetPace[0]}–{targetPace[1]} /mi
                    </Text>
                  )}
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

          {/* Post-workout cool-down (only after active session) */}
          {workout.isCompleted && warmup && warmup.cooldownSteps.length > 0 && (
            <Card>
              <Text style={[Typography.label, { color: Colors.long, marginBottom: Spacing.md }]}>🌬️  COOL-DOWN</Text>
              {warmup.cooldownSteps.map((step, i) => (
                <View key={i} style={[styles.warmupStep, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.separator, paddingTop: Spacing.sm }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[Typography.subhead, { color: Colors.textPrimary, fontWeight: '600' }]}>{step.name}</Text>
                    <Text style={[Typography.caption1, { color: Colors.textSecondary }]}>{step.detail}</Text>
                  </View>
                  <Text style={[Typography.caption1, { color: Colors.textTertiary }]}>{step.duration}</Text>
                </View>
              ))}
            </Card>
          )}

          {/* Saved route map */}
          {workout.isCompleted && workout.route && workout.route.length > 1 && (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <Text style={[Typography.label, { color: Colors.textSecondary, margin: Spacing.md, marginBottom: Spacing.sm }]}>
                YOUR ROUTE
              </Text>
              <RouteMap route={workout.route} />
            </Card>
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
            {isRunWorkout(workout.workoutType) && (
              <SecondaryButton label="📡  Import from Watch (.gpx)" onPress={handleGPXImport} size="lg" />
            )}
            <GhostButton label="Mark Complete Without Timer" onPress={confirmComplete} />
          </View>
        )}
        {!workout.isCompleted && !workout.isSkipped && !isActive && (
          <GhostButton label="Skip This Workout" onPress={handleSkip}
            style={{ marginTop: 4 }} color={Colors.textTertiary} />
        )}
      </View>

      {/* Milestone celebration modal */}
      <MilestoneModal milestone={newMilestone} onDismiss={handleMilestoneDismiss} />
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
  [WorkoutType.Walk]: '🚶',
};

// ── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  header:        { padding: Spacing.xl, paddingTop: Spacing.xxl },
  headerTopRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  backBtn:       {},
  backText:      { ...Typography.title3, color: 'rgba(255,255,255,0.85)' },
  editText:      { ...Typography.subhead, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  headerBody:    { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.md },
  headerTitle:   { ...Typography.largeTitle, color: '#fff' },
  headerSub:     { ...Typography.subhead, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  statsRow:      { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  statChip:      { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  statValue:     { ...Typography.subhead, fontWeight: '700', color: '#fff' },
  statLabel:     { ...Typography.caption2, color: 'rgba(255,255,255,0.75)' },

  liveCard:      { flexDirection: 'row', padding: Spacing.lg, backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1.5, gap: Spacing.sm },
  targetPaceBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.md },

  adaptCard:   { padding: Spacing.lg, backgroundColor: Colors.warning + '10', borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.warning + '40' },
  adaptTitle:  { ...Typography.headline, color: Colors.warning, marginBottom: 4 },
  adaptOrig:   { ...Typography.caption1, color: Colors.textSecondary, textDecorationLine: 'line-through', marginBottom: 2 },
  adaptNote:   { ...Typography.footnote, color: Colors.textSecondary },

  warmupHeader: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderLeftWidth: 3, borderLeftColor: Colors.warning },
  warmupSteps:  { marginTop: Spacing.md, gap: Spacing.sm },
  warmupStep:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  warmupNum:    { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.accent + '20', alignItems: 'center', justifyContent: 'center' },

  effortCard:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  effortIcon:  { width: 48, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  effortLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: 4 },
  coachLabel:  { ...Typography.label, color: Colors.textSecondary, marginBottom: Spacing.sm },

  bottomBar:   { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surface + 'F0', padding: Spacing.xl, paddingBottom: Spacing.xxl, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.separator },
});
