import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import type { GPSPoint } from '../../types/models';

interface RouteMapProps {
  route: GPSPoint[];
  style?: object;
}

export function RouteMap({ route, style }: RouteMapProps) {
  const lats = route.map(p => p.latitude);
  const lngs = route.map(p => p.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const region = {
    latitude:       (minLat + maxLat) / 2,
    longitude:      (minLng + maxLng) / 2,
    latitudeDelta:  Math.max(maxLat - minLat, 0.002) * 1.4,
    longitudeDelta: Math.max(maxLng - minLng, 0.002) * 1.4,
  };
  const coords = route.map(p => ({ latitude: p.latitude, longitude: p.longitude }));
  const start  = coords[0];
  const end    = coords[coords.length - 1];

  return (
    <View style={[styles.container, style]}>
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        region={region}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <Polyline coordinates={coords} strokeColor={Colors.accent} strokeWidth={3} />
        <Polyline coordinates={[start, start]} strokeColor={Colors.success} strokeWidth={10} lineCap="round" />
        <Polyline coordinates={[end, end]} strokeColor={Colors.danger} strokeWidth={10} lineCap="round" />
      </MapView>
      <View style={styles.legend}>
        <Text style={[Typography.caption2, { color: Colors.textSecondary }]}>
          <Text style={{ color: Colors.success }}>● </Text>Start
          {'   '}
          <Text style={{ color: Colors.danger }}>● </Text>Finish
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Colors.surface },
  map:       { width: '100%', height: 220 },
  legend:    { padding: Spacing.sm, alignItems: 'center' },
});
