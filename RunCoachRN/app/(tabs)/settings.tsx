import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  Alert, Image, SafeAreaView, ScrollView, StyleSheet, TextInput,
  Text, TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAppStore, currentWeekNumber, completedMilesThisWeek, weeklyMileage } from '../../src/store/useAppStore';
import { StravaService, type StravaTokens } from '../../src/services/StravaService';
import { Colors, CommonStyles, Radius, Spacing, Typography } from '../../src/theme';
import { Card } from '../../src/components/ui/Card';
import {
  ABILITY_LABELS, GOAL_EMOJIS, GOAL_LABELS, TRAINING_STYLE_LABELS,
} from '../../src/types/enums';

export default function SettingsTab() {
  const { profile, plan, clearAllData, generateAndSavePlan, resetProgress, setProfile } = useAppStore();
  const races = useAppStore(s => s.races);
  const [stravaTokens, setStravaTokens] = useState<StravaTokens | null>(null);
  const [goalWeightInput, setGoalWeightInput] = useState('');
  const [editingGoalWeight, setEditingGoalWeight] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  async function pickProfilePhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to set a profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      await setProfile({ ...profile!, avatarUri: result.assets[0].uri });
    }
  }

  async function saveDisplayName() {
    if (!profile) return;
    await setProfile({ ...profile, displayName: nameInput.trim() });
    setEditingName(false);
  }

  useFocusEffect(useCallback(() => {
    StravaService.loadTokens().then(setStravaTokens);
  }, []));

  function confirmRegen() {
    Alert.alert(
      'Regenerate plan?',
      'This deletes your current plan and all completion history. Your profile stays the same.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Regenerate', style: 'destructive', onPress: async () => {
          await generateAndSavePlan();
          Alert.alert('Done', 'Your new plan is ready.');
        }},
      ],
    );
  }

  function confirmResetProgress() {
    Alert.alert(
      'Reset all progress?',
      'All completed workouts and check-in history will be cleared. Your plan and profile stay the same.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: async () => {
          await resetProgress();
          Alert.alert('Done', 'Progress cleared. Fresh start!');
        }},
      ],
    );
  }

  async function setWeightUnit(unit: 'lbs' | 'kg') {
    if (!profile) return;
    await setProfile({ ...profile, weightUnit: unit });
  }

  async function saveGoalWeight() {
    if (!profile) return;
    const weightUnit = profile.weightUnit ?? 'lbs';
    const parsed = parseFloat(goalWeightInput);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid', 'Enter a valid weight.');
      return;
    }
    const inLbs = weightUnit === 'kg' ? parsed * 2.20462 : parsed;
    await setProfile({ ...profile, goalWeight: inLbs });
    setEditingGoalWeight(false);
    setGoalWeightInput('');
  }

  function confirmDeleteAll() {
    Alert.alert(
      'Delete all data?',
      'This permanently removes your profile and plan. You will need to complete onboarding again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Everything', style: 'destructive', onPress: async () => {
          await clearAllData();
          router.replace('/onboarding');
        }},
      ],
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={CommonStyles.screenBg}>
        <View style={[CommonStyles.flex1, CommonStyles.center]}>
          <Text style={[Typography.subhead, { color: Colors.textSecondary }]}>No profile found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Profile hub stats
  const weekNum    = plan ? currentWeekNumber(plan) : 0;
  const doneMiles  = plan ? completedMilesThisWeek(plan) : 0;
  const targetMiles = plan ? weeklyMileage(plan, weekNum) : 0;
  const weekPct    = targetMiles > 0 ? Math.min(doneMiles / targetMiles, 1) : 0;
  const totalMiles = plan
    ? plan.workoutDays.filter(w => w.completed && w.actualMiles).reduce((sum, w) => sum + (w.actualMiles ?? 0), 0)
    : 0;
  const completedWorkouts = plan ? plan.workoutDays.filter(w => w.completed).length : 0;
  const nextRace = races.find(r => !r.finishTimeSecs && new Date(r.date) > new Date());
  const daysToRace = nextRace
    ? Math.ceil((new Date(nextRace.date).getTime() - new Date().setHours(0,0,0,0)) / 86400000)
    : null;
  const activeShoe = useAppStore.getState().shoes.find(s => !s.retired);

  return (
    <SafeAreaView style={CommonStyles.screenBg}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Profile Hero ── */}
        <View style={styles.hero}>
          <View style={CommonStyles.rowBetween}>
            {/* Avatar + name */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
              <TouchableOpacity onPress={pickProfilePhoto} style={styles.avatarWrap}>
                {profile.avatarUri ? (
                  <Image source={{ uri: profile.avatarUri }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={{ fontSize: 28 }}>🔥</Text>
                  </View>
                )}
                <View style={styles.avatarEditBadge}>
                  <Text style={{ fontSize: 10, color: '#fff' }}>✎</Text>
                </View>
              </TouchableOpacity>
              <View>
                {editingName ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                    <TextInput
                      style={styles.nameInput}
                      value={nameInput}
                      onChangeText={setNameInput}
                      placeholder="Your name"
                      placeholderTextColor={Colors.textTertiary}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={saveDisplayName}
                    />
                    <TouchableOpacity onPress={saveDisplayName}>
                      <Text style={[Typography.caption1, { color: Colors.accent, fontWeight: '700' }]}>Save</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => { setNameInput(profile.displayName ?? ''); setEditingName(true); }}>
                    <Text style={[Typography.title3, { color: Colors.textPrimary }]}>
                      {profile.displayName || 'Add your name'}
                    </Text>
                  </TouchableOpacity>
                )}
                <Text style={[Typography.caption1, { color: Colors.textSecondary, marginTop: 2 }]}>
                  {GOAL_EMOJIS[profile.goal]}  {GOAL_LABELS[profile.goal]}  ·  {ABILITY_LABELS[profile.ability]}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.goalBadge}
              onPress={() => router.push('/edit-race-date')}
            >
              <Text style={[Typography.caption1, { color: Colors.accent, fontWeight: '700' }]}>
                {profile.goalDate
                  ? `🏁 ${new Date(profile.goalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                  : '+ Race Date'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <StatPill label="Total Miles" value={totalMiles.toFixed(0)} />
            <StatPill label="Workouts" value={`${completedWorkouts}`} />
            {plan ? <StatPill label="Week" value={`${weekNum} / ${plan.totalWeeks}`} /> : null}
            {daysToRace !== null ? <StatPill label="Race In" value={`${daysToRace}d`} accent /> : null}
          </View>

          {/* This week progress */}
          {plan && (
            <View style={{ marginTop: Spacing.md }}>
              <View style={[CommonStyles.rowBetween, { marginBottom: 6 }]}>
                <Text style={[Typography.caption1, { color: Colors.textSecondary }]}>This week</Text>
                <Text style={[Typography.caption1, { color: Colors.textSecondary }]}>
                  {doneMiles.toFixed(1)} / {targetMiles.toFixed(0)} mi
                </Text>
              </View>
              <View style={styles.weekBarTrack}>
                <View style={[styles.weekBarFill, { width: `${weekPct * 100}%` }]} />
              </View>
            </View>
          )}

          {/* Active shoe */}
          {activeShoe && (
            <TouchableOpacity style={styles.shoeRow} onPress={() => router.push('/shoes' as any)}>
              <Text style={{ fontSize: 16 }}>👟</Text>
              <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                <Text style={[Typography.caption1, { color: Colors.textSecondary }]}>
                  {activeShoe.brand} {activeShoe.name}  ·  {activeShoe.totalMiles.toFixed(0)} / {activeShoe.alertMiles} mi
                </Text>
                <View style={styles.shoeBarTrack}>
                  <View style={[styles.shoeBarFill, {
                    width: `${Math.min(activeShoe.totalMiles / activeShoe.alertMiles, 1) * 100}%`,
                    backgroundColor: activeShoe.totalMiles >= activeShoe.alertMiles * 0.9 ? Colors.warning : Colors.accent,
                  }]} />
                </View>
              </View>
              <Text style={{ color: Colors.textTertiary, fontSize: 12 }}>›</Text>
            </TouchableOpacity>
          )}
        </View>


        {/* Strava */}
        <SectionTitle title="Strava" />
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => { router.push('/strava-connect'); }}
        >
          <View style={CommonStyles.rowBetween}>
            <View>
              <Text style={[Typography.subhead, { fontWeight: '600', color: Colors.textPrimary }]}>
                {stravaTokens ? 'Connected' : 'Connect Strava'}
              </Text>
              {stravaTokens ? (
                <Text style={[Typography.footnote, { color: Colors.success, marginTop: 2 }]}>
                  Logged in as {stravaTokens.athleteName}
                </Text>
              ) : (
                <Text style={[Typography.footnote, { color: Colors.textSecondary, marginTop: 2 }]}>
                  Push completed workouts to your Strava feed
                </Text>
              )}
            </View>
            <View style={[styles.hkBadge, { backgroundColor: stravaTokens ? Colors.success + '20' : Colors.tertiary }]}>
              <Text style={[Typography.caption1, { color: stravaTokens ? Colors.success : Colors.textSecondary, fontWeight: '600' }]}>
                {stravaTokens ? 'ON' : 'OFF'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Actions */}
        {profile.goalDate && (
          <>
            <SectionTitle title="Race" />
            <Card>
              <Row label="Race date" value={new Date(profile.goalDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} />
            </Card>
          </>
        )}

        {/* Weight tracking */}
        <SectionTitle title="Weight Tracking" />
        <Card style={{ marginBottom: Spacing.sm }}>
          <View style={[CommonStyles.rowBetween, { paddingVertical: Spacing.sm }]}>
            <Text style={[Typography.subhead, { color: Colors.textSecondary }]}>Unit</Text>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              {(['lbs', 'kg'] as const).map(u => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitChip, (profile.weightUnit ?? 'lbs') === u && styles.unitChipActive]}
                  onPress={() => setWeightUnit(u)}
                >
                  <Text style={[Typography.caption1, { color: (profile.weightUnit ?? 'lbs') === u ? Colors.accent : Colors.textSecondary, fontWeight: '600' }]}>
                    {u}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={CommonStyles.divider} />
          <View style={[CommonStyles.rowBetween, { paddingVertical: Spacing.sm }]}>
            <Text style={[Typography.subhead, { color: Colors.textSecondary }]}>Goal Weight</Text>
            {editingGoalWeight ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <TextInput
                  style={styles.inlineInput}
                  value={goalWeightInput}
                  onChangeText={setGoalWeightInput}
                  placeholder={profile.weightUnit === 'kg' ? '70' : '155'}
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="decimal-pad"
                  autoFocus
                />
                <TouchableOpacity onPress={saveGoalWeight}>
                  <Text style={[Typography.caption1, { color: Colors.accent, fontWeight: '700' }]}>Save</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => { setEditingGoalWeight(true); setGoalWeightInput(''); }}>
                <Text style={[Typography.subhead, { color: Colors.textPrimary, fontWeight: '500' }]}>
                  {profile.goalWeight
                    ? `${((profile.weightUnit ?? 'lbs') === 'kg' ? profile.goalWeight / 2.20462 : profile.goalWeight).toFixed(1)} ${profile.weightUnit ?? 'lbs'}`
                    : 'Set goal'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>

        {/* Races */}
        <SectionTitle title="Races" />
        <TouchableOpacity style={[styles.actionRow, { marginBottom: Spacing.sm }]} onPress={() => router.push('/races' as any)}>
          <View style={CommonStyles.rowBetween}>
            <Text style={[Typography.subhead, { color: Colors.accent, fontWeight: '600' }]}>
              🏅  My Races
            </Text>
            <Text style={[Typography.caption1, { color: Colors.textSecondary }]}>
              {races.length === 0 ? 'None' : `${races.length} race${races.length > 1 ? 's' : ''}`}  ›
            </Text>
          </View>
        </TouchableOpacity>

        <SectionTitle title="Training Tools" />
        <TouchableOpacity style={[styles.actionRow, { marginBottom: Spacing.sm }]} onPress={() => router.push('/morning-checkin' as any)}>
          <View style={CommonStyles.rowBetween}>
            <Text style={[Typography.subhead, { color: Colors.accent, fontWeight: '600' }]}>
              🌅  Morning Check-In
            </Text>
            <Text style={{ color: Colors.textTertiary }}>›</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionRow, { marginBottom: Spacing.sm }]} onPress={() => router.push('/shoes' as any)}>
          <View style={CommonStyles.rowBetween}>
            <Text style={[Typography.subhead, { color: Colors.accent, fontWeight: '600' }]}>
              👟  Shoe Tracker
            </Text>
            <Text style={{ color: Colors.textTertiary }}>›</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionRow, { marginBottom: Spacing.sm }]} onPress={() => router.push('/shoe-recommendations' as any)}>
          <View style={CommonStyles.rowBetween}>
            <Text style={[Typography.subhead, { color: Colors.accent, fontWeight: '600' }]}>
              ⭐  Shoe Recommendations
            </Text>
            <Text style={{ color: Colors.textTertiary }}>›</Text>
          </View>
        </TouchableOpacity>

        <SectionTitle title="Plan" />
        <TouchableOpacity style={[styles.actionRow, { marginBottom: Spacing.sm }]} onPress={() => router.push('/edit-race-date')}>
          <Text style={[Typography.subhead, { color: Colors.accent, fontWeight: '600' }]}>
            {profile.goalDate ? 'Edit Race Date' : 'Add Race Date'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionRow, { marginBottom: Spacing.sm }]} onPress={() => router.push('/edit-schedule')}>
          <Text style={[Typography.subhead, { color: Colors.accent, fontWeight: '600' }]}>
            Edit Run Schedule
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionRow} onPress={confirmRegen}>
          <Text style={[Typography.subhead, { color: Colors.warning, fontWeight: '600' }]}>
            Regenerate Plan
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionRow} onPress={confirmResetProgress}>
          <Text style={[Typography.subhead, { color: Colors.warning, fontWeight: '600' }]}>
            Reset All Progress
          </Text>
        </TouchableOpacity>

        <SectionTitle title="Danger Zone" />
        <TouchableOpacity style={styles.actionRow} onPress={confirmDeleteAll}>
          <Text style={[Typography.subhead, { color: Colors.danger, fontWeight: '600' }]}>
            Delete All Data
          </Text>
        </TouchableOpacity>

        {/* About */}
        <SectionTitle title="About" />
        <Card>
          <Row label="App" value="Cinder" />
          <Divider />
          <Row label="Version" value="1.0.0" />
        </Card>

        <Text style={[Typography.caption1, { color: Colors.textTertiary, textAlign: 'center', marginTop: Spacing.xl }]}>
          Built with 80/20 training principles, 10% weekly volume cap,
          and automatic deload weeks every 4th week.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatPill({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={[styles.statPill, accent && { borderColor: Colors.accent + '40', backgroundColor: Colors.accent + '12' }]}>
      <Text style={[Typography.headline, { color: accent ? Colors.accent : Colors.textPrimary, fontWeight: '700' }]}>{value}</Text>
      <Text style={[Typography.caption2, { color: Colors.textTertiary, marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Text style={[Typography.label, { color: Colors.textSecondary, marginTop: Spacing.xl, marginBottom: Spacing.sm }]}>
      {title}
    </Text>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={[CommonStyles.rowBetween, { paddingVertical: Spacing.sm }]}>
      <Text style={[Typography.subhead, { color: Colors.textSecondary }]}>{label}</Text>
      <Text style={[Typography.subhead, { color: Colors.textPrimary, fontWeight: '500', flex: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

function Divider() {
  return <View style={CommonStyles.divider} />;
}

const styles = StyleSheet.create({
  scroll:     { padding: Spacing.xl, paddingBottom: Spacing['4xl'] },
  actionRow:  { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg },
  hkBadge:    { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full },

  unitChip:       { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.full, backgroundColor: Colors.surfaceAlt, borderWidth: 1.5, borderColor: Colors.border },
  unitChipActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '12' },
  inlineInput:    { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.sm, paddingVertical: 4, color: Colors.textPrimary, fontSize: 15, minWidth: 60, textAlign: 'right' },

  // Profile hero
  hero:              { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.xl, gap: Spacing.sm },
  goalBadge:         { backgroundColor: Colors.accent + '15', borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 6, borderWidth: 1, borderColor: Colors.accent + '30' },
  statsRow:          { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  statPill:          { flex: 1, alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  weekBarTrack:      { height: 6, backgroundColor: Colors.tertiary, borderRadius: 3, overflow: 'hidden' },
  weekBarFill:       { height: '100%', backgroundColor: Colors.accent, borderRadius: 3 },
  shoeRow:           { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: Spacing.sm },
  shoeBarTrack:      { height: 4, backgroundColor: Colors.tertiary, borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  shoeBarFill:       { height: '100%', borderRadius: 2 },
  // Avatar
  avatarWrap:        { position: 'relative' },
  avatar:            { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: Colors.accent },
  avatarPlaceholder: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.surfaceAlt, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  avatarEditBadge:   { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  nameInput:         { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.accent, paddingHorizontal: Spacing.sm, paddingVertical: 4, color: Colors.textPrimary, fontSize: 16, minWidth: 120 },
});
