// ── Strava API credentials ────────────────────────────────
// 1. Go to https://www.strava.com/settings/api and create an app.
// 2. Set "Authorization Callback Domain" to: auth.expo.io
// 3. Paste your Client ID (number) and Client Secret below.

export const STRAVA_CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
export const STRAVA_CLIENT_SECRET = 'YOUR_CLIENT_SECRET_HERE';

export const STRAVA_SCOPES = ['activity:write', 'read'];

export const STRAVA_DISCOVERY = {
  authorizationEndpoint: 'https://www.strava.com/oauth/mobile/authorize',
  tokenEndpoint: 'https://www.strava.com/oauth/token',
  revocationEndpoint: 'https://www.strava.com/oauth/deauthorize',
};

export const stravaConfigured = (): boolean =>
  STRAVA_CLIENT_ID !== 'YOUR_CLIENT_ID_HERE' && STRAVA_CLIENT_SECRET !== 'YOUR_CLIENT_SECRET_HERE';
