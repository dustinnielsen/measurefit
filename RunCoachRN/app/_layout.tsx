import { useEffect } from 'react';
import { View } from 'react-native';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAppStore } from '../src/store/useAppStore';
import { WorkoutTicker } from './(tabs)/_layout';
// Side-effect import — registers the background location task before any screen renders
import '../src/services/LocationService';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { loadFromStorage, isLoaded } = useAppStore();

  useEffect(() => {
    loadFromStorage().then(() => SplashScreen.hideAsync());
  }, []);

  if (!isLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <View style={{ flex: 1 }}>
        <WorkoutTicker />
        <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="workout/[id]"       options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="checkin/[id]"      options={{ presentation: 'modal' }} />
        <Stack.Screen name="edit-workout/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="edit-schedule"     options={{ presentation: 'modal' }} />
        <Stack.Screen name="edit-race-date"    options={{ presentation: 'modal' }} />
        <Stack.Screen name="strava-connect"    options={{ presentation: 'modal' }} />
        <Stack.Screen name="coach-chat"       options={{ presentation: 'modal' }} />
        <Stack.Screen name="shoes"            options={{ presentation: 'modal' }} />
        <Stack.Screen name="morning-checkin"  options={{ presentation: 'modal' }} />
        <Stack.Screen name="races"            options={{ presentation: 'modal' }} />
        <Stack.Screen name="weight-history"   options={{ presentation: 'modal' }} />
        <Stack.Screen name="log-workout"      options={{ presentation: 'modal' }} />
      </Stack>
      </View>
    </GestureHandlerRootView>
  );
}
