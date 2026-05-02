import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Tabs, router } from 'expo-router';
import { useAppStore, selectElapsedSeconds } from '../../src/store/useAppStore';
import { formatDuration } from '../../src/services/LocationService';
import { Colors, Spacing, Typography } from '../../src/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   Colors.accent,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: {
          borderTopColor: Colors.separator,
          backgroundColor: Colors.surface,
        },
      }}
    >
      <Tabs.Screen name="index"    options={{ title: 'Today',    tabBarIcon: ({ color }) => <TabIcon emoji="🏃" color={color} /> }} />
      <Tabs.Screen name="plan"     options={{ title: 'Plan',     tabBarIcon: ({ color }) => <TabIcon emoji="📅" color={color} /> }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: ({ color }) => <TabIcon emoji="📊" color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color }) => <TabIcon emoji="⚙️" color={color} /> }} />
    </Tabs>
  );
}

// ── Live workout ticker ────────────────────────────────────

export function WorkoutTicker() {
  const session = useAppStore(s => s.session);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [!!session]);

  if (!session) return null;

  const elapsed = selectElapsedSeconds(session);
  const miles   = session.distanceMiles ?? 0;

  return (
    <TouchableOpacity
      style={styles.ticker}
      onPress={() => router.push(`/workout/${session.workoutId}` as any)}
      activeOpacity={0.85}
    >
      <View style={styles.tickerDot} />
      <Text style={styles.tickerText}>
        {formatDuration(elapsed)}
      </Text>
      <Text style={styles.tickerSep}>·</Text>
      <Text style={styles.tickerText}>
        {miles.toFixed(2)} mi
      </Text>
      <Text style={[styles.tickerText, { marginLeft: 'auto', opacity: 0.7, fontSize: 12 }]}>
        Tap to return ›
      </Text>
    </TouchableOpacity>
  );
}

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  return <Text style={{ fontSize: 20, opacity: color === Colors.accent ? 1 : 0.5 }}>{emoji}</Text>;
}

const styles = StyleSheet.create({
  ticker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    gap: Spacing.sm,
  },
  tickerDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#fff',
    opacity: 0.9,
  },
  tickerText: {
    ...Typography.subhead as any,
    color: '#fff',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  tickerSep: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
});
