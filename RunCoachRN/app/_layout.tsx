import { useEffect } from 'react';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAppStore } from '../src/store/useAppStore';

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
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="workout/[id]" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="checkin/[id]"  options={{ presentation: 'modal' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
