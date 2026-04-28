import React, { useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View, ActivityIndicator } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useAppStore } from '../src/store/useAppStore';
import { Colors, Spacing, Typography, Radius } from '../src/theme';
import { PrimaryButton, GhostButton } from '../src/components/ui/Buttons';

export default function EditRaceDate() {
  const { profile, setProfile, generateAndSavePlan } = useAppStore();

  const existing = profile?.goalDate ? new Date(profile.goalDate) : null;
  const [hasDate, setHasDate]   = useState(!!existing);
  const [raceDate, setRaceDate] = useState(existing ?? new Date());
  const [saving, setSaving]     = useState(false);

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 14);

  async function save() {
    if (!profile) return;
    const msg = hasDate
      ? `Set race date to ${raceDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}? Your plan will be regenerated to taper for this date.`
      : 'Remove race date? Your plan will be regenerated without a taper target.';
    Alert.alert('Update race date?', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Save & Regenerate', onPress: async () => {
        setSaving(true);
        await setProfile({
          ...profile,
          goalDate: hasDate ? raceDate.toISOString() : undefined,
          updatedAt: new Date().toISOString(),
        });
        await generateAndSavePlan();
        setSaving(false);
        router.back();
      }},
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[Typography.title2, { color: Colors.textPrimary, marginBottom: 4 }]}>Race Date</Text>
        <Text style={[Typography.subhead, { color: Colors.textSecondary, marginBottom: Spacing.xl }]}>
          Your plan will taper in the final weeks before race day.
        </Text>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={[Typography.subhead, { color: Colors.textPrimary, fontWeight: '600' }]}>
              🏁  I have a race date
            </Text>
            <Text style={[Typography.caption1, { color: Colors.textSecondary }]}>
              Enables automatic taper
            </Text>
          </View>
          <Switch value={hasDate} onValueChange={setHasDate}
            trackColor={{ true: Colors.accent }} thumbColor="#fff" />
        </View>

        {hasDate && (
          <DateTimePicker
            value={raceDate}
            mode="date"
            display="spinner"
            minimumDate={minDate}
            onChange={(_: any, date?: Date) => date && setRaceDate(date)}
            textColor={Colors.textPrimary}
            style={{ marginBottom: Spacing.xl }}
          />
        )}

        {saving
          ? <ActivityIndicator color={Colors.accent} style={{ marginTop: Spacing.xl }} />
          : <>
              <PrimaryButton label="Save & Regenerate Plan" onPress={save} style={{ marginTop: Spacing.xl }} />
              <GhostButton label="Cancel" onPress={() => router.back()} style={{ marginTop: Spacing.sm }} />
            </>
        }
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll:     { padding: Spacing.xl, paddingBottom: Spacing['4xl'] },
  toggleRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md },
});
