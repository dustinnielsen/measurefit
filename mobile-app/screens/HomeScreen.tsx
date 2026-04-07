import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { roomsService, supabase } from '../lib/supabase';

export default function HomeScreen({ navigation }: any) {
  const { dealer }       = useAuth();
  const { tenantConfig } = useTenant();

  const [rooms, setRooms]               = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [jobName, setJobName]           = useState('');
  const [editingJob, setEditingJob]     = useState(false);
  const [jobDraft, setJobDraft]         = useState('');
  const [collections, setCollections]   = useState(0);
  const [colorways, setColorways]       = useState(0);

  const brandColor = tenantConfig.primary_color;

  useFocusEffect(useCallback(() => {
    loadData();
  }, [dealer]));

  const loadData = async () => {
    if (!dealer) return;
    try {
      const [roomData, colRes] = await Promise.all([
        roomsService.getRooms(dealer.id),
        supabase.from('fabric_collections').select('id, colorways').eq('is_active', true),
      ]);
      setRooms(roomData ?? []);
      const cols = colRes.data ?? [];
      setCollections(cols.length);
      setColorways(cols.reduce((a: number, c: any) => a + (c.colorways?.length ?? 0), 0));
    } catch (e) { console.error('HomeScreen load', e); }
    finally { setLoading(false); }
  };

  const totalWindows   = rooms.reduce((a, r) => a + (r.windows?.length ?? 0), 0);
  const coveredWindows = rooms.reduce((a, r) => a + (r.windows?.filter((w: any) => w.product_id || w.fabric_collection_name).length ?? 0), 0);
  const progress       = totalWindows > 0 ? coveredWindows / totalWindows : 0;
  const lastRoom       = rooms.length > 0 ? rooms[rooms.length - 1] : null;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const dealerName = (dealer as any)?.name ?? (dealer as any)?.contact_name ?? 'there';

  if (loading) {
    return (
      <View style={S.centered}>
        <ActivityIndicator color={brandColor} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={S.container} contentContainerStyle={S.content}>

      {/* ── Header ── */}
      <View style={S.header}>
        <View style={S.headerLeft}>
          <Text style={S.greeting}>{greeting()}</Text>
          <Text style={S.dealerName}>{dealerName}</Text>
        </View>
        <View style={[S.brandBadge, { backgroundColor: brandColor + '22', borderColor: brandColor + '44' }]}>
          <Text style={[S.brandBadgeText, { color: brandColor }]}>WindowFit</Text>
        </View>
      </View>

      {/* ── Current Job ── */}
      <TouchableOpacity
        style={[S.jobCard, { borderColor: jobName ? brandColor + '44' : 'rgba(255,255,255,0.08)' }]}
        onPress={() => { setJobDraft(jobName); setEditingJob(true); }}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          <Text style={S.jobLabel}>CURRENT JOB</Text>
          <Text style={[S.jobName, !jobName && S.jobNameEmpty]}>
            {jobName || 'Tap to set customer name...'}
          </Text>
        </View>
        <Text style={[S.jobEdit, { color: brandColor }]}>{jobName ? 'Edit' : '+'}</Text>
      </TouchableOpacity>

      {/* ── Progress summary (only if rooms exist) ── */}
      {rooms.length > 0 && (
        <View style={S.progressCard}>
          <View style={S.progressHeader}>
            <Text style={S.progressTitle}>Job Progress</Text>
            <Text style={[S.progressFraction, { color: brandColor }]}>
              {coveredWindows}/{totalWindows} covered
            </Text>
          </View>
          <View style={S.progressTrack}>
            <View style={[S.progressFill, { width: `${progress * 100}%` as any, backgroundColor: brandColor }]} />
          </View>
          <Text style={S.progressSub}>{rooms.length} room{rooms.length !== 1 ? 's' : ''} · {totalWindows - coveredWindows} remaining</Text>
        </View>
      )}

      {/* ── Quick actions ── */}
      <Text style={S.sectionLabel}>QUICK ACTIONS</Text>
      <View style={S.actionsGrid}>
        <TouchableOpacity
          style={[S.actionCard, S.actionCardPrimary, { backgroundColor: brandColor }]}
          onPress={() => navigation.navigate('Scan')}
        >
          <Text style={S.actionEmoji}>📐</Text>
          <Text style={S.actionLabelPrimary}>Scan Windows</Text>
          <Text style={S.actionSubPrimary}>AR measurement</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={S.actionCard}
          onPress={() => navigation.navigate('Rooms')}
        >
          <Text style={S.actionEmoji}>🏠</Text>
          <Text style={S.actionLabel}>My Rooms</Text>
          <Text style={S.actionSub}>
            {rooms.length > 0 ? `${rooms.length} room${rooms.length !== 1 ? 's' : ''}` : 'No rooms yet'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={S.actionCard}
          onPress={() => navigation.navigate('Search')}
        >
          <Text style={S.actionEmoji}>🔍</Text>
          <Text style={S.actionLabel}>Search Fabrics</Text>
          <Text style={S.actionSub}>{collections} collections</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={S.actionCard}
          onPress={() => navigation.navigate('Quotes')}
        >
          <Text style={S.actionEmoji}>📋</Text>
          <Text style={S.actionLabel}>Quotes</Text>
          <Text style={S.actionSub}>Build & send</Text>
        </TouchableOpacity>
      </View>

      {/* ── Last room worked on ── */}
      {lastRoom && (
        <>
          <Text style={S.sectionLabel}>LAST ROOM</Text>
          <TouchableOpacity
            style={S.lastRoomCard}
            onPress={() => navigation.navigate('Rooms', {
              screen: 'RoomDetail',
              params: { roomId: lastRoom.id, roomName: lastRoom.name },
            })}
          >
            <View style={S.lastRoomLeft}>
              <Text style={S.lastRoomEmoji}>🏠</Text>
              <View>
                <Text style={S.lastRoomName}>{lastRoom.name}</Text>
                <Text style={S.lastRoomMeta}>
                  {lastRoom.windows?.length ?? 0} window{(lastRoom.windows?.length ?? 0) !== 1 ? 's' : ''} ·{' '}
                  {lastRoom.windows?.filter((w: any) => w.product_id || w.fabric_collection_name).length ?? 0} covered
                </Text>
              </View>
            </View>
            <Text style={[S.lastRoomCta, { color: brandColor }]}>Continue →</Text>
          </TouchableOpacity>
        </>
      )}

      {/* ── Catalog stats ── */}
      <Text style={S.sectionLabel}>CATALOG</Text>
      <View style={S.statsRow}>
        <View style={S.statCard}>
          <Text style={[S.statNumber, { color: brandColor }]}>{collections}</Text>
          <Text style={S.statLabel}>Collections</Text>
        </View>
        <View style={S.statCard}>
          <Text style={[S.statNumber, { color: brandColor }]}>{colorways}</Text>
          <Text style={S.statLabel}>Colorways</Text>
        </View>
        <View style={S.statCard}>
          <Text style={[S.statNumber, { color: brandColor }]}>2</Text>
          <Text style={S.statLabel}>Brands</Text>
        </View>
      </View>

      <View style={{ height: 40 }} />

      {/* ── Edit job modal ── */}
      <Modal visible={editingJob} animationType="slide" presentationStyle="pageSheet">
        <View style={S.modal}>
          <View style={S.modalHeader}>
            <Text style={S.modalTitle}>Current Job</Text>
            <TouchableOpacity style={S.modalClose} onPress={() => setEditingJob(false)}>
              <Text style={S.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 20, gap: 16 }}>
            <Text style={S.modalLabel}>Customer or job name</Text>
            <TextInput
              value={jobDraft}
              onChangeText={setJobDraft}
              placeholder="e.g. Johnson Residence"
              placeholderTextColor="rgba(255,255,255,0.25)"
              style={S.modalInput}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => { setJobName(jobDraft); setEditingJob(false); }}
            />
            <TouchableOpacity
              style={[S.modalSave, { backgroundColor: brandColor }]}
              onPress={() => { setJobName(jobDraft); setEditingJob(false); }}
            >
              <Text style={S.modalSaveText}>Save</Text>
            </TouchableOpacity>
            {jobName ? (
              <TouchableOpacity
                style={S.modalClear}
                onPress={() => { setJobName(''); setJobDraft(''); setEditingJob(false); }}
              >
                <Text style={S.modalClearText}>Clear job name</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const S = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#080C14' },
  centered:           { flex: 1, backgroundColor: '#080C14', alignItems: 'center', justifyContent: 'center' },
  content:            { padding: 20, paddingTop: 64, gap: 12 },

  header:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  headerLeft:         { gap: 2 },
  greeting:           { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '500' },
  dealerName:         { color: 'white', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  brandBadge:         { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  brandBadgeText:     { fontSize: 12, fontWeight: '700' },

  jobCard:            { backgroundColor: '#0D1520', borderRadius: 14, padding: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  jobLabel:           { color: 'rgba(255,255,255,0.25)', fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 },
  jobName:            { color: 'white', fontSize: 16, fontWeight: '700' },
  jobNameEmpty:       { color: 'rgba(255,255,255,0.25)', fontWeight: '400', fontSize: 14 },
  jobEdit:            { fontSize: 13, fontWeight: '700' },

  progressCard:       { backgroundColor: '#0D1520', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', gap: 10 },
  progressHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTitle:      { color: 'white', fontSize: 14, fontWeight: '700' },
  progressFraction:   { fontSize: 13, fontWeight: '700' },
  progressTrack:      { height: 5, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  progressFill:       { height: '100%', borderRadius: 3 },
  progressSub:        { color: 'rgba(255,255,255,0.35)', fontSize: 12 },

  sectionLabel:       { color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginTop: 8, marginBottom: 2 },

  actionsGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard:         { width: '47%', backgroundColor: '#0D1520', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 4 },
  actionCardPrimary:  { borderWidth: 0 },
  actionEmoji:        { fontSize: 28, marginBottom: 4 },
  actionLabel:        { color: 'white', fontSize: 14, fontWeight: '700' },
  actionLabelPrimary: { color: 'white', fontSize: 14, fontWeight: '800' },
  actionSub:          { color: 'rgba(255,255,255,0.35)', fontSize: 11 },
  actionSubPrimary:   { color: 'rgba(255,255,255,0.7)', fontSize: 11 },

  lastRoomCard:       { backgroundColor: '#0D1520', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lastRoomLeft:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lastRoomEmoji:      { fontSize: 28 },
  lastRoomName:       { color: 'white', fontSize: 15, fontWeight: '700' },
  lastRoomMeta:       { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  lastRoomCta:        { fontSize: 13, fontWeight: '700' },

  statsRow:           { flexDirection: 'row', gap: 10 },
  statCard:           { flex: 1, backgroundColor: '#0D1520', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  statNumber:         { fontSize: 22, fontWeight: '800' },
  statLabel:          { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },

  modal:              { flex: 1, backgroundColor: '#080C14' },
  modalHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  modalTitle:         { color: 'white', fontSize: 18, fontWeight: '800' },
  modalClose:         { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  modalCloseText:     { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  modalLabel:         { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  modalInput:         { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, color: 'white', fontSize: 16, padding: 14 },
  modalSave:          { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  modalSaveText:      { color: 'white', fontWeight: '700', fontSize: 15 },
  modalClear:         { alignItems: 'center', paddingVertical: 8 },
  modalClearText:     { color: 'rgba(255,69,58,0.7)', fontSize: 13, fontWeight: '600' },
});