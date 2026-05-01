import type { GPSPoint } from '../types/models';

export interface GPXResult {
  points: GPSPoint[];
  distanceMiles: number;
  durationSeconds: number;
  name?: string;
}

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

export function parseGPX(xml: string): GPXResult | null {
  try {
    // Extract track name
    const nameMatch = xml.match(/<name>([^<]*)<\/name>/);
    const name = nameMatch?.[1]?.trim();

    // Extract all trackpoints — handles trkpt and wpt
    const trkptRegex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
    const points: GPSPoint[] = [];
    let match: RegExpExecArray | null;

    while ((match = trkptRegex.exec(xml)) !== null) {
      const lat = parseFloat(match[1]);
      const lon = parseFloat(match[2]);
      const inner = match[3];

      const timeMatch = inner.match(/<time>([^<]+)<\/time>/);
      const eleMatch  = inner.match(/<ele>([^<]+)<\/ele>/);

      const timestamp = timeMatch ? new Date(timeMatch[1]).getTime() : Date.now();
      const altitude  = eleMatch  ? parseFloat(eleMatch[1]) : undefined;

      if (!isNaN(lat) && !isNaN(lon)) {
        points.push({ latitude: lat, longitude: lon, timestamp, altitude });
      }
    }

    if (points.length < 2) return null;

    // Calculate total distance
    let distanceMiles = 0;
    for (let i = 1; i < points.length; i++) {
      const seg = haversineMiles(points[i - 1], points[i]);
      if (seg < 0.5) distanceMiles += seg; // filter teleports
    }

    const durationSeconds = Math.floor(
      (points[points.length - 1].timestamp - points[0].timestamp) / 1000,
    );

    return { points, distanceMiles, durationSeconds, name };
  } catch {
    return null;
  }
}
