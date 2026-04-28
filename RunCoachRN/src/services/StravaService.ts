import AsyncStorage from '@react-native-async-storage/async-storage';
import { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_DISCOVERY } from '../config/strava';
import type { WorkoutDay } from '../types/models';
import { WORKOUT_LABELS, WorkoutType } from '../types/enums';

const TOKEN_KEY = '@runcoach/strava_token';

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix seconds
  athleteId: number;
  athleteName: string;
}

export const StravaService = {
  // ── Token storage ───────────────────────────────────────

  async saveTokens(tokens: StravaTokens): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  },

  async loadTokens(): Promise<StravaTokens | null> {
    const raw = await AsyncStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as StravaTokens) : null;
  },

  async clearTokens(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEY);
  },

  // ── Token exchange ──────────────────────────────────────

  async exchangeCodeForTokens(code: string): Promise<StravaTokens> {
    const res = await fetch(STRAVA_DISCOVERY.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
    const data = await res.json();
    return {
      accessToken:  data.access_token,
      refreshToken: data.refresh_token,
      expiresAt:    data.expires_at,
      athleteId:    data.athlete?.id ?? 0,
      athleteName:  data.athlete
        ? `${data.athlete.firstname} ${data.athlete.lastname}`.trim()
        : 'Strava Athlete',
    };
  },

  async refreshAccessToken(tokens: StravaTokens): Promise<StravaTokens> {
    const res = await fetch(STRAVA_DISCOVERY.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        refresh_token: tokens.refreshToken,
        grant_type:    'refresh_token',
      }),
    });
    if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
    const data = await res.json();
    const refreshed: StravaTokens = {
      ...tokens,
      accessToken:  data.access_token,
      refreshToken: data.refresh_token ?? tokens.refreshToken,
      expiresAt:    data.expires_at,
    };
    await StravaService.saveTokens(refreshed);
    return refreshed;
  },

  async getValidTokens(): Promise<StravaTokens | null> {
    const tokens = await StravaService.loadTokens();
    if (!tokens) return null;
    if (Date.now() / 1000 < tokens.expiresAt - 300) return tokens;
    try {
      return await StravaService.refreshAccessToken(tokens);
    } catch {
      return null;
    }
  },

  // ── Activity upload ──────────────────────────────────────

  sportType(workoutType: WorkoutType): string {
    switch (workoutType) {
      case WorkoutType.Strength:  return 'WeightTraining';
      case WorkoutType.Mobility:  return 'Yoga';
      default: return 'Run';
    }
  },

  async pushWorkout(workout: WorkoutDay): Promise<{ success: boolean; url?: string; error?: string }> {
    const tokens = await StravaService.getValidTokens();
    if (!tokens) return { success: false, error: 'Not connected to Strava' };

    const distMeters = (workout.actualDistanceMiles ?? workout.distanceMiles ?? 0) * 1609.344;
    const elapsedSec = workout.actualDurationSeconds
      ?? (workout.durationMinutes ? workout.durationMinutes * 60 : 1800);

    const body = {
      name:             WORKOUT_LABELS[workout.workoutType] + ' — RunCoach',
      sport_type:       StravaService.sportType(workout.workoutType),
      start_date_local: workout.date + 'T07:00:00',
      elapsed_time:     Math.round(elapsedSec),
      description:      workout.workoutDescription || workout.coachingNotes || '',
      ...(distMeters > 0 ? { distance: Math.round(distMeters) } : {}),
    };

    const res = await fetch('https://www.strava.com/api/v3/activities', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${tokens.accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err?.message ?? `Upload failed (${res.status})` };
    }

    const activity = await res.json();
    return {
      success: true,
      url: `https://www.strava.com/activities/${activity.id}`,
    };
  },
};
