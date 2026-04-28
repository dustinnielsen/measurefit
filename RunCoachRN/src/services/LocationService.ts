import * as Location from 'expo-location';
import type { GPSPoint } from '../types/models';

export type LocationUpdate = {
  point: GPSPoint;
  distanceMiles: number;        // total so far
  currentPaceMinPerMile: number | null;
};

type UpdateCallback = (update: LocationUpdate) => void;

// Haversine distance between two lat/lng points in miles
function haversineMiles(a: GPSPoint, b: GPSPoint): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(b.latitude  - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number { return deg * Math.PI / 180; }

// Rolling pace over the last ~30 seconds of GPS points
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
  return mins / distMi; // min/mile
}

class _LocationService {
  private subscription: Location.LocationSubscription | null = null;
  private points: GPSPoint[] = [];
  private totalMiles = 0;
  private callback: UpdateCallback | null = null;

  async requestPermissions(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  }

  async startTracking(onUpdate: UpdateCallback): Promise<boolean> {
    const granted = await this.requestPermissions();
    if (!granted) return false;

    this.points = [];
    this.totalMiles = 0;
    this.callback = onUpdate;

    this.subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 3000,   // every 3 seconds
        distanceInterval: 5,  // or every 5 metres
      },
      (loc) => {
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
          // Filter out GPS noise: ignore jumps > 0.1 mi in 3 sec (~120 mph)
          if (seg < 0.1) this.totalMiles += seg;
        }

        this.points.push(point);
        this.callback?.({
          point,
          distanceMiles:       this.totalMiles,
          currentPaceMinPerMile: rollingPace(this.points),
        });
      },
    );

    return true;
  }

  stopTracking(): { points: GPSPoint[]; distanceMiles: number } {
    this.subscription?.remove();
    this.subscription = null;
    this.callback = null;
    const result = { points: [...this.points], distanceMiles: this.totalMiles };
    this.points = [];
    this.totalMiles = 0;
    return result;
  }

  isTracking(): boolean {
    return this.subscription !== null;
  }
}

export const LocationService = new _LocationService();

// Format pace as "M:SS /mi"
export function formatPace(minPerMile: number | null | undefined): string {
  if (!minPerMile || !isFinite(minPerMile) || minPerMile > 30) return '--:--';
  const mins = Math.floor(minPerMile);
  const secs = Math.round((minPerMile - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Format elapsed seconds as "M:SS" or "H:MM:SS"
export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
