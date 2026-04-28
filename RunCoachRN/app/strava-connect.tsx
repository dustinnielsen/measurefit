import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking,
  SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Colors, CommonStyles, Radius, Spacing, Typography } from '../src/theme';
import { Card } from '../src/components/ui/Card';
import { PrimaryButton } from '../src/components/ui/Buttons';
import { GhostButton } from '../src/components/ui/Buttons';
import { StravaService, type StravaTokens } from '../src/services/StravaService';
import {
  STRAVA_CLIENT_ID, STRAVA_SCOPES, STRAVA_DISCOVERY, stravaConfigured,
} from '../src/config/strava';

WebBrowser.maybeCompleteAuthSession();

// In Expo Go, use the exp+<slug> scheme; in a native build, use the app's scheme.
const isExpoGo = Constants.executionEnvironment === 'storeClient';
const redirectUri = AuthSession.makeRedirectUri({
  scheme: isExpoGo ? 'exp+runcoach' : 'runcoach',
});

export default function StravaConnectScreen() {
  const [tokens,  setTokens]  = useState<StravaTokens | null>(null);
  const [loading, setLoading] = useState(true);
  const [pushing, setPushing] = useState(false);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId:     STRAVA_CLIENT_ID,
      scopes:       STRAVA_SCOPES,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      extraParams:  { approval_prompt: 'auto' },
    },
    STRAVA_DISCOVERY,
  );

  // Load existing connection on mount
  useEffect(() => {
    StravaService.loadTokens().then(t => { setTokens(t); setLoading(false); });
  }, []);

  // Handle OAuth callback
  useEffect(() => {
    if (response?.type !== 'success') return;
    const code = response.params.code;
    if (!code) return;

    setPushing(true);
    StravaService.exchangeCodeForTokens(code)
      .then(t => { StravaService.saveTokens(t); setTokens(t); })
      .catch(err => Alert.alert('Connection failed', err.message))
      .finally(() => setPushing(false));
  }, [response]);

  async function disconnect() {
    Alert.alert(
      'Disconnect Strava?',
      'Your completed workouts will no longer sync to Strava.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect', style: 'destructive',
          onPress: async () => { await StravaService.clearTokens(); setTokens(null); },
        },
      ],
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[CommonStyles.flex1, CommonStyles.center, { backgroundColor: Colors.bg }]}>
        <ActivityIndicator color={Colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={CommonStyles.screenBg}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: Spacing.lg }}>
          <Text style={[Typography.subhead, { color: Colors.accent }]}>← Back</Text>
        </TouchableOpacity>

        <Text style={[Typography.title2, { color: Colors.textPrimary }]}>Strava</Text>
        <Text style={[Typography.subhead, { color: Colors.textSecondary, marginTop: 4, marginBottom: Spacing.xl }]}>
          Push completed workouts directly to your Strava feed.
        </Text>

        {!stravaConfigured() && (
          <Card style={{ backgroundColor: Colors.warning + '18', borderColor: Colors.warning + '50', borderWidth: 1, marginBottom: Spacing.lg }}>
            <Text style={[Typography.label, { color: Colors.warning, marginBottom: Spacing.sm }]}>
              SETUP REQUIRED
            </Text>
            <Text style={[Typography.subhead, { color: Colors.textPrimary, marginBottom: Spacing.sm }]}>
              Add your Strava API credentials to get started.
            </Text>
            <Text style={[Typography.footnote, { color: Colors.textSecondary }]}>
              1. Visit strava.com/settings/api and create an app{'\n'}
              2. Set "Authorization Callback Domain" to:{'\n'}
              {'   '}
              <Text style={{ color: Colors.accent, fontFamily: 'monospace' }}>
                {isExpoGo ? 'exp+runcoach' : 'runcoach'}
              </Text>
              {'\n'}
              3. Open{' '}
              <Text style={{ color: Colors.accent }}>src/config/strava.ts</Text>
              {' '}and paste your Client ID + Secret.
            </Text>
            <TouchableOpacity
              style={[styles.link, { marginTop: Spacing.md }]}
              onPress={() => Linking.openURL('https://www.strava.com/settings/api')}
            >
              <Text style={[Typography.subhead, { color: Colors.accent, fontWeight: '600' }]}>
                Open Strava Developer Settings →
              </Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Connected state */}
        {tokens ? (
          <>
            <Card>
              <View style={[CommonStyles.rowBetween]}>
                <View>
                  <Text style={[Typography.subhead, { color: Colors.textSecondary }]}>Connected as</Text>
                  <Text style={[Typography.headline, { color: Colors.textPrimary, marginTop: 2 }]}>
                    {tokens.athleteName}
                  </Text>
                </View>
                <View style={styles.badge}>
                  <Text style={[Typography.caption1, { color: Colors.success, fontWeight: '700' }]}>LIVE</Text>
                </View>
              </View>
            </Card>

            <Card style={{ marginTop: Spacing.lg }}>
              <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: Spacing.sm }]}>
                HOW IT WORKS
              </Text>
              <Text style={[Typography.subhead, { color: Colors.textPrimary }]}>
                After completing any workout check-in, tap{' '}
                <Text style={{ fontWeight: '600' }}>"Send to Strava"</Text>
                {' '}on the result screen to post it to your Strava feed.
              </Text>
            </Card>

            <GhostButton
              label="Disconnect Strava"
              onPress={disconnect}
              style={{ marginTop: Spacing.xl }}
            />
          </>
        ) : (
          <>
            {/* How it works */}
            <Card style={{ marginBottom: Spacing.lg }}>
              <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: Spacing.sm }]}>
                WHAT YOU GET
              </Text>
              {[
                '🏃  Post runs to your Strava feed after check-in',
                '📊  Distance + time uploaded automatically',
                '🏆  Kudos from your Strava friends',
                '🗺️  Manual activity — no GPS file required',
              ].map(item => (
                <Text key={item} style={[Typography.subhead, { color: Colors.textPrimary, marginBottom: 8 }]}>
                  {item}
                </Text>
              ))}
            </Card>

            <PrimaryButton
              label={pushing ? 'Connecting…' : 'Connect Strava Account'}
              onPress={() => promptAsync()}
              loading={pushing}
              disabled={!request || !stravaConfigured()}
            />

            {!stravaConfigured() && (
              <Text style={[Typography.caption1, { color: Colors.textTertiary, textAlign: 'center', marginTop: Spacing.sm }]}>
                Add your API credentials in src/config/strava.ts first.
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.xl, paddingBottom: Spacing['4xl'] },
  badge:  { backgroundColor: Colors.success + '20', paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full },
  link:   { alignSelf: 'flex-start' },
});
