import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import type { GPSPoint } from '../types/models';

export const LOCATION_TASK_NAME = 'cinder-background-location';
const WORKOUT_NOTIFICATION_ID = 'cinder-active-workout';

export type LocationUpdate = {
  point: GPSPoint;
  distanceMiles: number;
  currentPaceMinPerMile: number | null;
};

type UpdateCallback = (update: LocationUpdate) => void;

function haversineMiles(a: GPSPoint, b: GPSPoint): number {
  const R = 3958.8;
  const dLat = toRad(b.latitude  - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number { return deg * Math.PI / 180; }

function rollingPace(points: GPSPoint[]): number | null {
  if (points.length < 2) return null;
  const windowMs = 30_000;
  const now = points[points.length - 1].timestamp;
  const windowPoints = points.filter(p => now - p.timestamp <= windowMs);
  if (windowPoints.length < 2) return null;
  const first = windowPoints[0];
  const last  = windowPoints[windowPoints.length - 1];
  const distMi = haversineMiles(first, last);
  const mins   = (last.timestamp - first.timestamp) / 60_000;
  if (distMi < 0.001) return null;
  return mins / distMi;
}

// Format helpers used for the notification
function formatDurationShort(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  return `${m}:${s.toString().padStart(2,'0')}`;
}

class _LocationService {
  private points: GPSPoint[] = [];
  private totalMiles = 0;
  private callback: UpdateCallback | null = null;
  private _isTracking = false;
  private _isBackground = false;
  private foregroundSub: Location.LocationSubscription | null = null;
  private startedAt = 0;
  private notifInterval: ReturnType<typeof setInterval> | null = null;

  async requestPermissions(): Promise<{ foreground: boolean; background: boolean }> {
    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    if (fg !== 'granted') return { foreground: false, background: false };
    const { status: bg } = await Location.requestBackgroundPermissionsAsync();
    return { foreground: true, background: bg === 'granted' };
  }

  async startTracking(onUpdate: UpdateCallback): Promise<'background' | 'foreground' | false> {
    const { foreground, background } = await this.requestPermissions();
    if (!foreground) return false;

    this.points = [];
    this.totalMiles = 0;
    this.callback = onUpdate;
    this.startedAt = Date.now();

    if (background) {
      // Full background tracking — works with screen locked
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 3000,
        distanceInterval: 5,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: '🔥 Cinder — Workout in progress',
          notificationBody: 'Your route is being recorded.',
        },
      });
      this._isTracking = true;
      this._isBackground = true;
      this._startNotification();
      return 'background';
    } else {
      // Foreground-only fallback — works while screen is on
      this.foregroundSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        (loc) => this._handleLocationUpdate(loc),
      );
      this._isTracking = true;
      this._isBackground = false;
      this._startNotification();
      return 'foreground';
    }
  }

  stopTracking(): { points: GPSPoint[]; distanceMiles: number } {
    if (this._isBackground) {
      Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});
    }
    if (this.foregroundSub) {
      this.foregroundSub.remove();
      this.foregroundSub = null;
    }
    this._stopNotification();
    this._isTracking = false;
    this._isBackground = false;
    this.callback = null;
    const result = { points: [...this.points], distanceMiles: this.totalMiles };
    this.points = [];
    this.totalMiles = 0;
    return result;
  }

  isTracking(): boolean { return this._isTracking; }
  isBackgroundTracking(): boolean { return this._isBackground; }

  _handleLocationUpdate(loc: Location.LocationObject) {
    const point: GPSPoint = {
      latitude:  loc.coords.latitude,
      longitude: loc.coords.longitude,
      timestamp: loc.timestamp,
      accuracy:  loc.coords.accuracy ?? undefined,
      altitude:  loc.coords.altitude ?? undefined,
    };

    if (this.points.length > 0) {
      const prev = this.points[this.points.length - 1];
      const seg  = haversineMiles(prev, point);
      if (seg < 0.1) this.totalMiles += seg;
    }

    this.points.push(point);
    this.callback?.({
      point,
      distanceMiles:         this.totalMiles,
      currentPaceMinPerMile: rollingPace(this.points),
    });
  }

  // ── Live notification ──────────────────────────────────────

  private async _startNotification() {
    await Notifications.requestPermissionsAsync();
    await this._updateNotification();
    // Update notification every 10 seconds
    this.notifInterval = setInterval(() => this._updateNotification(), 10_000);
  }

  private async _updateNotification() {
    const elapsed = Math.floor((Date.now() - this.startedAt) / 1000);
    const miles   = this.totalMiles.toFixed(2);
    const time    = formatDurationShort(elapsed);
    await Notifications.scheduleNotificationAsync({
      identifier: WORKOUT_NOTIFICATION_ID,
      content: {
        title: '🔥 Workout in progress',
        body: `${time}  ·  ${miles} mi`,
        sound: false,
        sticky: true,
      },
      trigger: null,
    });
  }

  private _stopNotification() {
    if (this.notifInterval) {
      clearInterval(this.notifInterval);
      this.notifInterval = null;
    }
    Notifications.dismissNotificationAsync(WORKOUT_NOTIFICATION_ID).catch(() => {});
  }
}

export const LocationService = new _LocationService();

// Must be defined at module load time
TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }: TaskManager.TaskManagerTaskBody) => {
  if (error) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  for (const loc of locations) {
    LocationService._handleLocationUpdate(loc);
  }
});

export function formatPace(minPerMile: number | null | undefined): string {
  if (!minPerMile || !isFinite(minPerMile) || minPerMile > 30) return '--:--';
  const mins = Math.floor(minPerMile);
  const secs = Math.round((minPerMile - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
