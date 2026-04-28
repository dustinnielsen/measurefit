import { Tabs } from 'expo-router';
import { Colors } from '../../src/theme';

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

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  // Simple emoji icon — swap for SF Symbols via expo-symbols once on EAS build
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 20, opacity: color === Colors.accent ? 1 : 0.5 }}>{emoji}</Text>;
}
