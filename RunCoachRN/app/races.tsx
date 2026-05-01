import React, { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { useAppStore } from '../src/store/useAppStore';
import { Colors, CommonStyles, Radius, Spacing, Typography } from '../src/theme';
import { Card } from '../src/components/ui/Card';
import { PrimaryButton, SecondaryButton } from '../src/components/ui/Buttons';
import type { Race } from '../src/types/models';

const DISTANCES = ['5K', '10K', 'Half Marathon', 'Marathon', 'Ultra', 'Other'];

function daysUntil(dateStr: string): number {
  const race = new Date(dateStr);
  const now  = new Date();
  race.setHours(0,0,0,0); now.setHours(0,0,0,0);
  return Math.round((race.getTime() - now.getTime()) / 86_400_000);
}

function formatFinishTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  return `${m}:${s.toString().padStart(2,'0')}`;
}

export default function RacesScreen() {
  const races = useAppStore(s => s.races);
  const { addRace, updateRace, deleteRace } = useAppStore();

  const [showForm, setShowForm]       = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [name, setName]               = useState('');
  const [date, setDate]               = useState('');
  const [distLabel, setDistLabel]     = useState('5K');
  const [customDist, setCustomDist]   = useState('');
  const [city, setCity]               = useState('');
  const [state, setState]             = useState('');
  const [bib, setBib]                 = useState('');
  const [notes, setNotes]             = useState('');
  const [finishMins, setFinishMins]   = useState('');
  const [finishSecs, setFinishSecs]   = useState('');

  const upcoming = races.filter(r => !r.isCompleted && daysUntil(r.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const completed = races.filter(r => r.isCompleted || daysUntil(r.date) < 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  function openAdd() {
    setEditingId(null);
    setName(''); setDate(''); setDistLabel('5K'); setCustomDist('');
    setCity(''); setState(''); setBib(''); setNotes('');
    setFinishMins(''); setFinishSecs('');
    setShowForm(true);
  }

  function openEdit(r: Race) {
    setEditingId(r.id);
    setName(r.name);
    setDate(r.date);
    setDistLabel(r.distanceLabel);
    setCustomDist(r.customDistance ?? '');
    setCity(r.city ?? '');
    setState(r.state ?? '');
    setBib(r.bibNumber ?? '');
    setNotes(r.notes ?? '');
    if (r.finishTimeSecs) {
      const m = Math.floor(r.finishTimeSecs / 60);
      const s = r.finishTimeSecs % 60;
      setFinishMins(String(m));
      setFinishSecs(String(s).padStart(2, '0'));
    } else {
      setFinishMins(''); setFinishSecs('');
    }
    setShowForm(true);
  }

  async function handleSave() {
    if (!name.trim() || !date.trim()) {
      Alert.alert('Required', 'Please enter a race name and date.');
      return;
    }
    // Basic date validation YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('Invalid date', 'Enter date as YYYY-MM-DD (e.g. 2026-09-20)');
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const finishTimeSecs = finishMins.trim()
      ? parseInt(finishMins) * 60 + parseInt(finishSecs || '0')
      : undefined;

    const raceData = {
      name:          name.trim(),
      date,
      distanceLabel: distLabel,
      customDistance: distLabel === 'Other' ? customDist.trim() : undefined,
      city:          city.trim() || undefined,
      state:         state.trim() || undefined,
      bibNumber:     bib.trim() || undefined,
      notes:         notes.trim() || undefined,
      isCompleted:   finishTimeSecs !== undefined,
      finishTimeSecs,
    };

    if (editingId) {
      await updateRace(editingId, raceData);
    } else {
      await addRace(raceData);
    }
    setShowForm(false);
  }

  function confirmDelete(id: string, raceName: string) {
    Alert.alert('Delete race?', `Remove "${raceName}" from your race list?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteRace(id) },
    ]);
  }

  async function shareRace(r: Race) {
    const days = daysUntil(r.date);
    const location = [r.city, r.state].filter(Boolean).join(', ');
    const lines = [
      `🏃 ${r.name}`,
      `📏 ${r.distanceLabel === 'Other' ? (r.customDistance ?? 'Race') : r.distanceLabel}`,
      location ? `📍 ${location}` : null,
      r.isCompleted && r.finishTimeSecs
        ? `🏅 Finished in ${formatFinishTime(r.finishTimeSecs)}`
        : days === 0 ? '🎉 Race day!'
        : days > 0  ? `⏳ ${days} days to go`
        : '✅ Completed',
      '',
      'Training with Cinder: AI Run Coach 🔥',
    ].filter(Boolean).join('\n');

    try {
      if (await Sharing.isAvailableAsync()) {
        // Sharing text via a temp approach — use clipboard fallback
        Alert.alert('Share your race!', lines, [
          { text: 'Copy', onPress: () => {} },
          { text: 'Done', style: 'cancel' },
        ]);
      }
    } catch {
      Alert.alert('Share your race!', lines);
    }
  }

  if (showForm) {
    return (
      <SafeAreaView style={CommonStyles.screenBg}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={[CommonStyles.rowBetween, { marginBottom: Spacing.xl }]}>
              <TouchableOpacity onPress={() => setShowForm(false)} style={{ padding: 4 }}>
                <Text style={[Typography.headline, { color: Colors.accent }]}>← Back</Text>
              </TouchableOpacity>
              <Text style={[Typography.title3, { color: Colors.textPrimary }]}>
                {editingId ? 'Edit Race' : 'Add Race'}
              </Text>
              <View style={{ width: 60 }} />
            </View>

            <Label text="RACE NAME *" />
            <Field value={name} onChange={setName} placeholder="Boston Marathon" />

            <Label text="DATE (YYYY-MM-DD) *" style={{ marginTop: Spacing.lg }} />
            <Field value={date} onChange={setDate} placeholder="2026-09-20" keyboardType="numbers-and-punctuation" />

            <Label text="DISTANCE" style={{ marginTop: Spacing.lg }} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                {DISTANCES.map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.distChip, distLabel === d && styles.distChipActive]}
                    onPress={() => setDistLabel(d)}
                  >
                    <Text style={[Typography.caption1, { color: distLabel === d ? Colors.accent : Colors.textSecondary, fontWeight: distLabel === d ? '700' : '400' }]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            {distLabel === 'Other' && (
              <Field value={customDist} onChange={setCustomDist} placeholder="e.g. 50K Trail" />
            )}

            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Label text="CITY" />
                <Field value={city} onChange={setCity} placeholder="Boston" />
              </View>
              <View style={{ flex: 1 }}>
                <Label text="STATE" />
                <Field value={state} onChange={setState} placeholder="MA" />
              </View>
            </View>

            <Label text="BIB NUMBER" style={{ marginTop: Spacing.lg }} />
            <Field value={bib} onChange={setBib} placeholder="12345" keyboardType="number-pad" />

            <Label text="FINISH TIME (if completed)" style={{ marginTop: Spacing.lg }} />
            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Field value={finishMins} onChange={setFinishMins} placeholder="Minutes (e.g. 215)" keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Field value={finishSecs} onChange={setFinishSecs} placeholder="Seconds (e.g. 30)" keyboardType="number-pad" />
              </View>
            </View>

            <Label text="NOTES" style={{ marginTop: Spacing.lg }} />
            <TextInput
              style={[styles.field, { height: 80, textAlignVertical: 'top' }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Goals, gear, anything you want to remember..."
              placeholderTextColor={Colors.textTertiary}
              multiline
            />

            <PrimaryButton label={editingId ? 'Save Changes' : 'Add Race'} onPress={handleSave} style={{ marginTop: Spacing.xl }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={CommonStyles.screenBg}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[CommonStyles.rowBetween, { marginBottom: Spacing.xl }]}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Text style={[Typography.headline, { color: Colors.accent }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[Typography.title3, { color: Colors.textPrimary }]}>My Races</Text>
          <TouchableOpacity onPress={openAdd} style={{ padding: 4 }}>
            <Text style={[Typography.headline, { color: Colors.accent }]}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {races.length === 0 && (
          <View style={[CommonStyles.center, { padding: Spacing['4xl'] }]}>
            <Text style={{ fontSize: 56 }}>🏅</Text>
            <Text style={[Typography.headline, { color: Colors.textPrimary, marginTop: Spacing.md }]}>
              No races yet
            </Text>
            <Text style={[Typography.subhead, { color: Colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>
              Add an upcoming race to track your countdown and share your journey.
            </Text>
            <PrimaryButton label="Add Your First Race" onPress={openAdd} style={{ marginTop: Spacing.xl }} />
          </View>
        )}

        {upcoming.length > 0 && (
          <>
            <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: Spacing.sm }]}>
              UPCOMING
            </Text>
            {upcoming.map(r => {
              const days = daysUntil(r.date);
              const location = [r.city, r.state].filter(Boolean).join(', ');
              return (
                <RaceCard
                  key={r.id}
                  race={r}
                  badge={days === 0 ? '🎉 Race day!' : `${days}d away`}
                  badgeColor={days <= 7 ? Colors.warning : Colors.accent}
                  location={location}
                  onEdit={() => openEdit(r)}
                  onDelete={() => confirmDelete(r.id, r.name)}
                  onShare={() => shareRace(r)}
                />
              );
            })}
          </>
        )}

        {completed.length > 0 && (
          <>
            <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: Spacing.sm, marginTop: upcoming.length > 0 ? Spacing.xl : 0 }]}>
              PAST RACES
            </Text>
            {completed.map(r => {
              const location = [r.city, r.state].filter(Boolean).join(', ');
              return (
                <RaceCard
                  key={r.id}
                  race={r}
                  badge={r.finishTimeSecs ? formatFinishTime(r.finishTimeSecs) : 'Completed'}
                  badgeColor={Colors.success}
                  location={location}
                  onEdit={() => openEdit(r)}
                  onDelete={() => confirmDelete(r.id, r.name)}
                  onShare={() => shareRace(r)}
                />
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RaceCard({
  race, badge, badgeColor, location, onEdit, onDelete, onShare,
}: {
  race: Race; badge: string; badgeColor: string; location: string;
  onEdit: () => void; onDelete: () => void; onShare: () => void;
}) {
  const dist = race.distanceLabel === 'Other' ? (race.customDistance ?? 'Race') : race.distanceLabel;
  return (
    <Card style={styles.raceCard}>
      <View style={[CommonStyles.rowBetween, { marginBottom: Spacing.sm }]}>
        <View style={{ flex: 1, marginRight: Spacing.sm }}>
          <Text style={[Typography.headline, { color: Colors.textPrimary }]} numberOfLines={1}>
            {race.name}
          </Text>
          <Text style={[Typography.caption1, { color: Colors.textSecondary, marginTop: 2 }]}>
            {dist}  ·  {new Date(race.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {location ? `  ·  ${location}` : ''}
          </Text>
          {race.bibNumber ? (
            <Text style={[Typography.caption1, { color: Colors.textTertiary, marginTop: 2 }]}>
              Bib #{race.bibNumber}
            </Text>
          ) : null}
        </View>
        <View style={[styles.badge, { backgroundColor: badgeColor + '20', borderColor: badgeColor + '40' }]}>
          <Text style={[Typography.caption1, { color: badgeColor, fontWeight: '700' }]}>{badge}</Text>
        </View>
      </View>
      {race.notes ? (
        <Text style={[Typography.caption1, { color: Colors.textSecondary, marginBottom: Spacing.sm }]} numberOfLines={2}>
          {race.notes}
        </Text>
      ) : null}
      <View style={[CommonStyles.row, { gap: Spacing.sm, marginTop: Spacing.sm }]}>
        <TouchableOpacity style={styles.actionBtn} onPress={onShare}>
          <Text style={[Typography.caption1, { color: Colors.accent, fontWeight: '600' }]}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onEdit}>
          <Text style={[Typography.caption1, { color: Colors.accent, fontWeight: '600' }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { borderColor: Colors.danger + '40' }]} onPress={onDelete}>
          <Text style={[Typography.caption1, { color: Colors.danger, fontWeight: '600' }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

function Label({ text, style }: { text: string; style?: object }) {
  return (
    <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: Spacing.sm }, style]}>
      {text}
    </Text>
  );
}

function Field({ value, onChange, placeholder, keyboardType = 'default' }: {
  value: string; onChange: (v: string) => void; placeholder: string; keyboardType?: any;
}) {
  return (
    <TextInput
      style={styles.field}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={Colors.textTertiary}
      keyboardType={keyboardType}
      returnKeyType="done"
    />
  );
}

const styles = StyleSheet.create({
  scroll:   { padding: Spacing.xl, paddingBottom: Spacing['4xl'] },

  raceCard: { marginBottom: Spacing.md },
  badge:    { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderWidth: 1 },
  actionBtn:{ flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderWidth: 1, borderColor: Colors.accent + '40', borderRadius: Radius.md },

  field:    { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, color: Colors.textPrimary, fontSize: 16 },
  twoCol:   { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },

  distChip:       { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border },
  distChipActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '12' },
});
