import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Linking, SafeAreaView, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { Colors, CommonStyles, Radius, Spacing, Typography } from '../src/theme';
import { Card } from '../src/components/ui/Card';

interface NearbyRace {
  race_id: number;
  name: string;
  next_date: string;
  city: string;
  state: string;
  url: string;
  distance_miles?: number;
}

type LoadState = 'idle' | 'locating' | 'fetching' | 'done' | 'error';

export default function RacesNearbyScreen() {
  const [races, setRaces]       = useState<NearbyRace[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [zipcode, setZipcode]   = useState('');

  useEffect(() => { fetchNearbyRaces(); }, []);

  async function fetchNearbyRaces() {
    try {
      setLoadState('locating');

      // 1. Get location permission + coords
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Location permission is needed to find races near you.');
        setLoadState('error');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;

      // 2. Reverse geocode → zipcode via OpenStreetMap Nominatim
      setLoadState('fetching');
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
        { headers: { 'User-Agent': 'CinderRunCoach/1.0' } }
      );
      const geoData = await geoRes.json();
      const zip = geoData?.address?.postcode?.split('-')[0]; // handle ZIP+4

      if (!zip) {
        setErrorMsg('Could not determine your location. Try again.');
        setLoadState('error');
        return;
      }
      setZipcode(zip);

      // 3. Fetch races from RunSignup
      const today = new Date().toISOString().slice(0, 10);
      const url = `https://api.runsignup.com/rest/races?zipcode=${zip}&radius=25&format=json&results_per_page=20&start_date=${today}&sort=date+ASC`;
      const raceRes = await fetch(url);
      const raceData = await raceRes.json();

      const fetched: NearbyRace[] = (raceData?.races ?? []).map((r: any) => ({
        race_id:       r.race?.race_id,
        name:          r.race?.name,
        next_date:     r.race?.next_date,
        city:          r.race?.address?.city ?? '',
        state:         r.race?.address?.state ?? '',
        url:           r.race?.url ?? `https://runsignup.com/Race/${r.race?.race_id}`,
        distance_miles: r.race?.distance_miles,
      })).filter((r: NearbyRace) => r.name && r.next_date);

      setRaces(fetched);
      setLoadState('done');
    } catch (e: any) {
      setErrorMsg('Something went wrong. Check your connection and try again.');
      setLoadState('error');
    }
  }

  function formatDate(dateStr: string) {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      });
    } catch { return dateStr; }
  }

  function daysUntil(dateStr: string) {
    const diff = Math.ceil((new Date(dateStr).getTime() - new Date().setHours(0,0,0,0)) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return `${diff} days away`;
  }

  return (
    <SafeAreaView style={CommonStyles.screenBg}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={[CommonStyles.rowBetween, { marginBottom: Spacing.xl }]}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Text style={[Typography.headline, { color: Colors.accent }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[Typography.title3, { color: Colors.textPrimary }]}>Races Near You</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Loading states */}
        {(loadState === 'locating' || loadState === 'fetching') && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={[Typography.subhead, { color: Colors.textSecondary, marginTop: Spacing.md }]}>
              {loadState === 'locating' ? 'Finding your location…' : 'Searching for races…'}
            </Text>
          </View>
        )}

        {loadState === 'error' && (
          <Card style={styles.centered}>
            <Text style={{ fontSize: 40, marginBottom: Spacing.md }}>📍</Text>
            <Text style={[Typography.subhead, { color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.sm }]}>
              {errorMsg}
            </Text>
            <TouchableOpacity onPress={fetchNearbyRaces} style={styles.retryBtn}>
              <Text style={[Typography.subhead, { color: '#fff', fontWeight: '700' }]}>Try Again</Text>
            </TouchableOpacity>
          </Card>
        )}

        {loadState === 'done' && (
          <>
            <Text style={[Typography.caption1, { color: Colors.textTertiary, marginBottom: Spacing.lg }]}>
              📍 Showing races within 25 miles of {zipcode}
            </Text>

            {races.length === 0 ? (
              <Card style={styles.centered}>
                <Text style={{ fontSize: 40 }}>🏁</Text>
                <Text style={[Typography.headline, { color: Colors.textPrimary, marginTop: Spacing.md }]}>
                  No upcoming races found
                </Text>
                <Text style={[Typography.subhead, { color: Colors.textSecondary, marginTop: 4, textAlign: 'center' }]}>
                  Try checking back closer to race season.
                </Text>
              </Card>
            ) : (
              races.map(race => (
                <Card key={race.race_id} style={styles.raceCard}>
                  <View style={CommonStyles.rowBetween}>
                    <View style={{ flex: 1, marginRight: Spacing.md }}>
                      <Text style={[Typography.headline, { color: Colors.textPrimary }]} numberOfLines={2}>
                        {race.name}
                      </Text>
                      <Text style={[Typography.caption1, { color: Colors.textSecondary, marginTop: 4 }]}>
                        📅 {formatDate(race.next_date)}
                      </Text>
                      {(race.city || race.state) && (
                        <Text style={[Typography.caption1, { color: Colors.textSecondary, marginTop: 2 }]}>
                          📍 {[race.city, race.state].filter(Boolean).join(', ')}
                        </Text>
                      )}
                      <Text style={[Typography.caption1, { color: Colors.accent, marginTop: 4, fontWeight: '600' }]}>
                        {daysUntil(race.next_date)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.registerBtn}
                    onPress={() => Linking.openURL(race.url).catch(() => {})}
                    activeOpacity={0.85}
                  >
                    <Text style={[Typography.subhead, { color: '#fff', fontWeight: '700' }]}>
                      Register →
                    </Text>
                  </TouchableOpacity>
                </Card>
              ))
            )}

            <TouchableOpacity onPress={fetchNearbyRaces} style={{ alignSelf: 'center', marginTop: Spacing.lg }}>
              <Text style={[Typography.caption1, { color: Colors.textTertiary }]}>↻ Refresh</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll:       { padding: Spacing.xl, paddingBottom: Spacing['4xl'] },
  centered:     { alignItems: 'center', padding: Spacing.xxl },
  raceCard:     { marginBottom: Spacing.md },
  registerBtn:  { marginTop: Spacing.md, backgroundColor: Colors.accent, borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center' },
  retryBtn:     { marginTop: Spacing.md, backgroundColor: Colors.accent, borderRadius: Radius.lg, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl },
});
