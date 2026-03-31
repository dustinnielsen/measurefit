import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { roomsService } from '../lib/supabase';

const ROOM_ICONS: Record<string, string> = {
  'Living Room': '🛋️', 'Master Bedroom': '🛏️', 'Bedroom': '🛏️',
  'Kitchen': '🍳', 'Office': '💼', 'Dining Room': '🍽️',
  'Bathroom': '🚿', 'Basement': '🏚️', 'Garage': '🚗',
};

function roomIcon(name: string) {
  for (const [key, icon] of Object.entries(ROOM_ICONS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return '🏠';
}

export default function RoomsScreen({ navigation }: any) {
  const { dealer } = useAuth();
  const { tenantConfig } = useTenant();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const brandColor = tenantConfig.primary_color;

  const loadRooms = async () => {
    if (!dealer) return;
    try {
      const data = await roomsService.getRooms(dealer.id);
      setRooms(data);
    } catch (e: any) {
      console.error('Failed to load rooms:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadRooms(); }, [dealer]));

  const onRefresh = () => { setRefreshing(true); loadRooms(); };

  const totalWindows = rooms.reduce((a, r) => a + (r.windows?.length ?? 0), 0);
  const coveredWindows = rooms.reduce((a, r) => a + (r.windows?.filter((w: any) => w.product_id).length ?? 0), 0);
  const progress = totalWindows > 0 ? coveredWindows / totalWindows : 0;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={brandColor} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Rooms</Text>
        <View style={[styles.coverageBadge, { backgroundColor: brandColor + '26' }]}>
          <Text style={[styles.coverageText, { color: brandColor }]}>{coveredWindows}/{totalWindows} covered</Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: brandColor }]} />
      </View>

      <FlatList
        data={rooms}
        keyExtractor={r => r.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={brandColor} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🏠</Text>
            <Text style={styles.emptyTitle}>No rooms yet</Text>
            <Text style={styles.emptyDesc}>Scan a {tenantConfig.product_noun} to create your first room</Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: brandColor }]}
              onPress={() => navigation.navigate('Scan')}
            >
              <Text style={styles.emptyBtnText}>Go to Scanner</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item: room }) => {
          const windows = room.windows ?? [];
          const covered = windows.filter((w: any) => w.product_id).length;
          return (
            <TouchableOpacity
              style={styles.roomCard}
              onPress={() => navigation.navigate('RoomDetail', { roomId: room.id, roomName: room.name })}
            >
              <View style={styles.roomCardLeft}>
                <Text style={styles.roomIcon}>{roomIcon(room.name)}</Text>
                <View>
                  <Text style={styles.roomName}>{room.name}</Text>
                  <Text style={styles.roomSub}>
                    {windows.length} {windows.length !== 1 ? tenantConfig.product_noun_plural : tenantConfig.product_noun}
                    {windows.length > 0 ? ` · ${covered} covered` : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.roomCardRight}>
                <View style={styles.dotRow}>
                  {windows.slice(0, 6).map((w: any) => (
                    <View key={w.id} style={[styles.dot, w.product_id ? styles.dotCovered : styles.dotEmpty]} />
                  ))}
                  {windows.length > 6 && <Text style={styles.moreDots}>+{windows.length - 6}</Text>}
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          rooms.length > 0 ? (
            <TouchableOpacity style={styles.addRoomBtn} onPress={() => navigation.navigate('Scan')}>
              <Text style={styles.addRoomText}>+ Scan New {tenantConfig.product_noun_plural.charAt(0).toUpperCase() + tenantConfig.product_noun_plural.slice(1)}</Text>
            </TouchableOpacity>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080C14' },
  centered: { flex: 1, backgroundColor: '#080C14', alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  coverageBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  coverageText: { fontSize: 12, fontWeight: '700' },
  progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 20, borderRadius: 2, marginBottom: 16, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  list: { padding: 20, paddingTop: 4, gap: 10, paddingBottom: 40 },
  roomCard: {
    backgroundColor: '#0D1520', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    padding: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  roomCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roomIcon: { fontSize: 28 },
  roomName: { color: 'white', fontWeight: '700', fontSize: 15 },
  roomSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  roomCardRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dotRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotCovered: { backgroundColor: '#30D158' },
  dotEmpty: { backgroundColor: 'rgba(255,255,255,0.2)' },
  moreDots: { color: 'rgba(255,255,255,0.3)', fontSize: 10 },
  chevron: { color: 'rgba(255,255,255,0.3)', fontSize: 22 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { color: 'white', fontSize: 20, fontWeight: '700' },
  emptyDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  emptyBtn: { marginTop: 8, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  addRoomBtn: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    borderStyle: 'dashed', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  addRoomText: { color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 14 },
});