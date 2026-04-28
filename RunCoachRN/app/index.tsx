import { Redirect } from 'expo-router';
import { useAppStore } from '../src/store/useAppStore';

export default function Root() {
  const profile = useAppStore(s => s.profile);
  return <Redirect href={profile ? '/(tabs)' : '/onboarding'} />;
}
