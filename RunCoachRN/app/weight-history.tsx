import React, { useState } from 'react';
import {
  Alert, SafeAreaView, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import { useAppStore } from '../src/store/useAppStore';
import { Colors, CommonStyles, Radius, Spacing, Typography } from '../src/theme';
import { Card } from '../src/components/ui/Card';

export default function WeightHistoryScreen() {
  const weightEntries  = useAppStore(s => s.weightEntries);
  const profile        = useAppStore(s => s.profile);
  const { deleteWeightEntry } = useAppStore();

  const weightUnit = profile?.weightUnit ?? 'lbs';
  const goalLbs    = profile?.goalWeight;
  const goal       = goalLbs ? (weightUnit === 'kg' ? goalLbs / 2.20462 : goalLbs) : null;

  // Sort descending (newest first) for display
  const sorted = [...weightEntries].sort((a, b) => b.timestamp - a.timestamp);

  // Convert for display
  const display = sorted.map(e => ({
    ...e,
    displayWeight: weightUnit === 'kg' ? e.weight / 2.20462 : e.weight,
  }));

  // Stats
  const last30 = weightEntries.slice(-30);
  const first  = last30.length > 1 ? (weightUnit === 'kg' ? last30[0].weight / 2.20462 : last30[0].weight) : null;
  const latest = display[0]?.displayWeight ?? null;
  const change = first != null && latest != null ? latest - first : null;

  // Simple sparkline — last 14 entries in chronological order
  const spark  = [...display].reverse().slice(-14);
  const minW   = spark.length > 0 ? Math.min(...spark.map(e => e.displayWeight)) : 0;
  const maxW   = spark.length > 0 ? Math.max(...spark.map(e => e.displayWeight)) : 1;
  const range  = maxW - minW || 1;

  function confirmDelete(id: string, dateStr: string) {
    Alert.alert('Delete entry?', `Remove the entry from ${dateStr}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteWeightEntry(id) },
    ]);
  }

  return (
    <SafeAreaView style={CommonStyles.screenBg}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[CommonStyles.rowBetween, { marginBottom: Spacing.xl }]}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Text style={[Typography.headline, { color: Colors.accent }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[Typography.title3, { color: Colors.textPrimary }]}>Weight History</Text>
          <View style={{ width: 60 }} />
        </View>

        {weightEntries.length === 0 ? (
          <View style={[CommonStyles.center, { padding: Spacing['4xl'] }]}>
            <Text style={{ fontSize: 56 }}>⚖️</Text>
            <Text style={[Typography.headline, { color: Colors.textPrimary, marginTop: Spacing.md }]}>
              No entries yet
            </Text>
            <Text style={[Typography.subhead, { color: Colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>
              Log your weight in the Morning Check-In to start tracking your trend.
            </Text>
          </View>
        ) : (
          <>
            {/* Summary stats */}
            <Card style={{ marginBottom: Spacing.lg }}>
              <View style={styles.statsRow}>
                {latest != null && (
                  <View style={styles.statItem}>
                    <Text style={[Typography.title2, { color: Colors.textPrimary }]}>
                      {latest.toFixed(1)}
                    </Text>
                    <Text style={[Typography.caption1, { color: Colors.textSecondary }]}>
                      Current ({weightUnit})
                    </Text>
                  </View>
                )}
                {change != null && (
                  <View style={styles.statItem}>
                    <Text style={[Typography.title2, { color: change < 0 ? Colors.success : change > 0 ? Colors.danger : Colors.textSecondary }]}>
                      {change >= 0 ? '+' : ''}{change.toFixed(1)}
                    </Text>
                    <Text style={[Typography.caption1, { color: Colors.textSecondary }]}>30-day</Text>
                  </View>
                )}
                {goal != null && (
                  <View style={styles.statItem}>
                    <Text style={[Typography.title2, { color: Colors.accent }]}>
                      {goal.toFixed(1)}
                    </Text>
                    <Text style={[Typography.caption1, { color: Colors.textSecondary }]}>
                      Goal ({weightUnit})
                    </Text>
                  </View>
                )}
                <View style={styles.statItem}>
                  <Text style={[Typography.title2, { color: Colors.textPrimary }]}>
                    {weightEntries.length}
                  </Text>
                  <Text style={[Typography.caption1, { color: Colors.textSecondary }]}>Entries</Text>
                </View>
              </View>
            </Card>

            {/* Sparkline chart */}
            {spark.length > 1 && (
              <Card style={{ marginBottom: Spacing.lg }}>
                <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: Spacing.md }]}>
                  TREND  ·  LAST {spark.length} ENTRIES
                </Text>
                <View style={styles.sparklineContainer}>
                  {spark.map((e, i) => {
                    const pct = (e.displayWeight - minW) / range;
                    const barH = Math.max(4, pct * 80);
                    const isLatest = i === spark.length - 1;
                    return (
                      <View key={e.id} style={styles.sparkBar}>
                        <View style={{ height: 80, justifyContent: 'flex-end' }}>
                          <View style={[styles.bar, { height: barH, backgroundColor: isLatest ? Colors.accent : Colors.accent + '50' }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>
                <View style={[CommonStyles.rowBetween, { marginTop: Spacing.sm }]}>
                  <Text style={[Typography.caption2, { color: Colors.textTertiary }]}>
                    {new Date(spark[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                  <Text style={[Typography.caption2, { color: Colors.textTertiary }]}>
                    Today
                  </Text>
                </View>
                <View style={[CommonStyles.rowBetween, { marginTop: 4 }]}>
                  <Text style={[Typography.caption2, { color: Colors.textTertiary }]}>
                    Low: {minW.toFixed(1)} {weightUnit}
                  </Text>
                  <Text style={[Typography.caption2, { color: Colors.textTertiary }]}>
                    High: {maxW.toFixed(1)} {weightUnit}
                  </Text>
                </View>
              </Card>
            )}

            {/* Entry list */}
            <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: Spacing.sm }]}>
              ALL ENTRIES
            </Text>
            <Card>
              {display.map((e, i) => (
                <View key={e.id}>
                  <View style={[CommonStyles.rowBetween, { paddingVertical: Spacing.md }]}>
                    <View>
                      <Text style={[Typography.subhead, { color: Colors.textPrimary, fontWeight: '600' }]}>
                        {e.displayWeight.toFixed(1)} {weightUnit}
                      </Text>
                      <Text style={[Typography.caption1, { color: Colors.textSecondary, marginTop: 2 }]}>
                        {new Date(e.date).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => confirmDelete(e.id, new Date(e.date).toLocaleDateString())}
                      style={styles.deleteBtn}
                    >
                      <Text style={[Typography.caption1, { color: Colors.danger }]}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                  {i < display.length - 1 && <View style={CommonStyles.divider} />}
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll:   { padding: Spacing.xl, paddingBottom: Spacing['4xl'] },

  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },

  sparklineContainer: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  sparkBar:           { flex: 1 },
  bar:                { borderRadius: 2 },

  deleteBtn: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm },
});
