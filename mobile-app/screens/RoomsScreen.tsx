import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput,
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

const ROOM_SUGGESTIONS = [
  'Living Room', 'Master Bedroom', 'Bedroom', 'Kitchen',
  'Office', 'Dining Room', 'Bathroom', 'Basement', 'Garage',
  'Guest Room', 'Playroom', 'Sunroom', 'Hallway',
];

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

  const [addRoomVisible, setAddRoomVisible] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [saving, setSaving] = useState(false);

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

  const openAddRoom = () => { setNewRoomName(''); setAddRoomVisible(true); };

  const saveRoom = async () => {
    if (!newRoomName.trim() || !dealer) return;
    setSaving(true);
    try {
      const room = await roomsService.createRoom({ dealer_id: dealer.id, name: newRoomName.trim() });
      setAddRoomVisible(false);
      await loadRooms();
      navigation.navigate('RoomDetail', { roomId: room.id, roomName: room.name });
    } catch (e) { console.error('createRoom', e); }
    finally { setSaving(false); }
  };

  const totalWindows = rooms.reduce((a, r) => a + (r.windows?.length ?? 0), 0);
  const coveredWindows = rooms.reduce((a, r) => a + (r.windows?.filter((w: any) => w.product_id || w.fabric_collection_name).length ?? 0), 0);
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
            <Text style={styles.emptyDesc}>Tap the button below to add your first room</Text>
          </View>
        }
        renderItem={({ item: room }) => {
          const windows = room.windows ?? [];
          const covered = windows.filter((w: any) => w.product_id || w.fabric_collection_name).length;
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
                    <View key={w.id} style={[styles.dot, (w.product_id || w.fabric_collection_name) ? styles.dotCovered : styles.dotEmpty]} />
                  ))}
                  {windows.length > 6 && <Text style={styles.moreDots}>+{windows.length - 6}</Text>}
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* FAB */}
      <View style={styles.fabContainer}>
        <TouchableOpacity style={[styles.fab, { backgroundColor: brandColor }]} onPress={openAddRoom}>
          <Text style={styles.fabText}>+ Add Room</Text>
        </TouchableOpacity>
      </View>

      {/* Add Room Modal */}
      <Modal visible={addRoomVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Room</Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setAddRoomVisible(false)}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 20, gap: 16 }}>
            <View>
              <Text style={styles.fieldLabel}>ROOM NAME</Text>
              <TextInput
                style={styles.fieldInput}
                value={newRoomName}
                onChangeText={setNewRoomName}
                placeholder="e.g. Living Room"
                placeholderTextColor="rgba(255,255,255,0.25)"
                autoFocus
              />
            </View>
            <Text style={styles.suggestLabel}>SUGGESTIONS</Text>
            <View style={styles.suggestions}>
              {ROOM_SUGGESTIONS.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.suggestionChip, newRoomName === s && { backgroundColor: brandColor, borderColor: brandColor }]}
                  onPress={() => setNewRoomName(s)}
                >
                  <Text style={[styles.suggestionText, newRoomName === s && { color: 'white' }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: !newRoomName.trim() ? 'rgba(255,255,255,0.1)' : brandColor }]}
              onPress={saveRoom}
              disabled={!newRoomName.trim() || saving}
            >
              {saving
                ? <ActivityIndicator color="white" />
                : <Text style={styles.saveBtnText}>Create Room & Add Windows</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0F1A' },
  centered: { flex: 1, backgroundColor: '#0A0F1A', alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  coverageBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  coverageText: { fontSize: 12, fontWeight: '700' },
  progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 20, borderRadius: 2, marginBottom: 16, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  list: { padding: 20, paddingTop: 4, gap: 10, paddingBottom: 100 },
  roomCard: {
    backgroundColor: '#111827', borderRadius: 16,
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
  emptyDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center' },
  fabContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 36 },
  fab: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  fabText: { color: 'white', fontWeight: '800', fontSize: 17 },
  modal: { flex: 1, backgroundColor: '#0A0F1A' },
  modalHeader: { padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', alignItems: 'center' },
  modalTitle: { color: 'white', fontSize: 18, fontWeight: '800', flex: 1 },
  modalCloseBtn: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  fieldLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  fieldInput: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, color: 'white', fontSize: 16, padding: 14 },
  suggestLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)' },
  suggestionText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: 'white', fontWeight: '800', fontSize: 16 },
});