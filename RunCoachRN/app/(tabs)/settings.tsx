import React, { useState } from 'react';
import {
  Alert, SafeAreaView, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import { useAppStore, currentWeekNumber } from '../../src/store/useAppStore';
import { HealthKitService } from '../../src/services/HealthKitService';
import { Colors, CommonStyles, Radius, Spacing, Typography } from '../../src/theme';
import { Card } from '../../src/components/ui/Card';
import {
  ABILITY_LABELS, GOAL_EMOJIS, GOAL_LABELS, TRAINING_STYLE_LABELS,
} from '../../src/types/enums';

export default function SettingsTab() {
  const { profile, plan, clearAllData, generateAndSavePlan } = useAppStore();

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

  return (
    <SafeAreaView style={CommonStyles.screenBg}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[Typography.title2, { color: Colors.textPrimary, marginBottom: Spacing.xl }]}>
          Settings
        </Text>

        {/* Profile */}
        <SectionTitle title="Your Profile" />
        <Card>
          <Row label="Ability"       value={ABILITY_LABELS[profile.ability]} />
          <Divider />
          <Row label="Goal"          value={`${GOAL_EMOJIS[profile.goal]}  ${GOAL_LABELS[profile.goal]}`} />
          <Divider />
          <Row label="Days / week"   value={`${profile.runningDaysPerWeek} days`} />
          <Divider />
          <Row label="Weekly mileage" value={`${profile.weeklyMileage.toFixed(0)} mi`} />
          <Divider />
          <Row label="Style"         value={TRAINING_STYLE_LABELS[profile.trainingStyle]} />
        </Card>

        {/* Plan */}
        {plan && (
          <>
            <SectionTitle title="Training Plan" />
            <Card>
              <Row label="Total weeks"   value={`${plan.totalWeeks} weeks`} />
              <Divider />
              <Row label="Current week"  value={`Week ${currentWeekNumber(plan)}`} />
              <Divider />
              <Row label="Peak mileage"  value={`${plan.peakWeeklyMileage.toFixed(0)} mi/wk`} />
              <Divider />
              <Row label="Generated"     value={new Date(plan.generatedAt).toLocaleDateString()} />
            </Card>
          </>
        )}

        {/* Apple Health */}
        <SectionTitle title="Apple Health" />
        <Card>
          <View style={[CommonStyles.rowBetween]}>
            <View style={{ flex: 1 }}>
              <Text style={[Typography.subhead, { fontWeight: '600', color: Colors.textPrimary }]}>
                Connect Apple Health
              </Text>
              <Text style={[Typography.footnote, { color: Colors.textSecondary, marginTop: 2 }]}>
                {HealthKitService.statusMessage()}
              </Text>
            </View>
            <View style={[styles.hkBadge, { backgroundColor: HealthKitService.isAvailable() ? Colors.success + '20' : Colors.tertiary }]}>
              <Text style={[Typography.caption1, { color: HealthKitService.isAvailable() ? Colors.success : Colors.textSecondary, fontWeight: '600' }]}>
                {HealthKitService.isAvailable() ? 'ON' : 'Soon'}
              </Text>
            </View>
          </View>
          {!HealthKitService.isAvailable() && (
            <Text style={[Typography.caption1, { color: Colors.textTertiary, marginTop: Spacing.sm }]}>
              Requires the full EAS build with Apple Developer account ($99/yr).
              All training features work without it.
            </Text>
          )}
        </Card>

        {/* Actions */}
        <SectionTitle title="Plan" />
        <TouchableOpacity style={styles.actionRow} onPress={confirmRegen}>
          <Text style={[Typography.subhead, { color: Colors.warning, fontWeight: '600' }]}>
            Regenerate Plan
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
          <Row label="App" value="RunCoach" />
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
});
