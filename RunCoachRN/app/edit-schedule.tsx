import React, { useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAppStore } from '../src/store/useAppStore';
import { Colors, Spacing, Typography, Radius } from '../src/theme';
import { PrimaryButton } from '../src/components/ui/Buttons';

export default function EditSchedule() {
  const { profile, setProfile, generateAndSavePlan } = useAppStore();

  const initDays = profile?.specificRunDays
    ? new Set<number>(profile.specificRunDays)
    : new Set<number>([1, 3, 5, 0]);

  const [selectedDays, setSelectedDays] = useState<Set<number>>(initDays);
  const [longRunDay, setLongRunDay]     = useState(profile?.preferredLongRunDay ?? 0);
  const [saving, setSaving]             = useState(false);

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function toggleDay(i: number) {
    const next = new Set<number>(selectedDays);
    if (next.has(i)) {
      if (next.size <= 2) return;
      next.delete(i);
      if (longRunDay === i) setLongRunDay(Array.from(next)[0]);
    } else {
      next.add(i);
    }
    setSelectedDays(next);
  }

  async function save() {
    if (!profile) return;
    Alert.alert(
      'Regenerate plan?',
      'Your schedule will update and a new plan will be generated. Completed workouts are preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save & Regenerate', onPress: async () => {
          setSaving(true);
          await setProfile({
            ...profile,
            specificRunDays: Array.from(selectedDays).sort(),
            preferredLongRunDay: longRunDay,
            runningDaysPerWeek: selectedDays.size,
            updatedAt: new Date().toISOString(),
          });
          await generateAndSavePlan();
          setSaving(false);
          router.back();
        }},
      ],
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[Typography.title2, { color: Colors.textPrimary, marginBottom: 4 }]}>Edit Schedule</Text>
        <Text style={[Typography.subhead, { color: Colors.textSecondary, marginBottom: Spacing.xl }]}>
          Changes regenerate your plan from today.
        </Text>

        <Text style={styles.label}>Which days will you run?</Text>
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

        <Text style={styles.label}>Which is your long run day?</Text>
        <View style={[styles.dayRow, { marginBottom: Spacing['3xl'] }]}>
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

        {saving
          ? <ActivityIndicator color={Colors.accent} />
          : <PrimaryButton label="Save & Regenerate Plan" onPress={save} />
        }
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll:      { padding: Spacing.xl, paddingBottom: Spacing['4xl'] },
  label:       { ...Typography.label, color: Colors.textSecondary, marginBottom: Spacing.sm },
  dayRow:      { flexDirection: 'row', gap: 6, marginBottom: Spacing.sm },
  dayBtn:      { flex: 1, alignItems: 'center', paddingVertical: 10, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border },
  dayBtnActive:{ backgroundColor: Colors.accent, borderColor: Colors.accent },
  dayBtnText:  { ...Typography.caption1, fontWeight: '700', color: Colors.textPrimary },
});
