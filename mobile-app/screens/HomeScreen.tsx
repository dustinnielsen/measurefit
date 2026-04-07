import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { roomsService, supabase } from '../lib/supabase';

const STATUS_COLORS: Record<string, string> = {
  draft:     'rgba(255,255,255,0.3)',
  sent:      '#0A84FF',
  viewed:    '#FF9F0A',
  approved:  '#30D158',
  declined:  '#FF453A',
  ordered:   '#BF5AF2',
  installed: '#30D158',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', sent: 'Sent', viewed: 'Viewed',
  approved: 'Approved ✓', declined: 'Declined',
  ordered: 'Ordered', installed: 'Installed ✓',
};

const PAYMENT_COLORS: Record<string, string> = {
  link_sent:    '#FF9F0A',
  deposit_paid: '#30D158',
  paid_in_full: '#30D158',
};

const PAYMENT_LABELS: Record<string, string> = {
  link_sent:    '🔗 Link Sent',
  deposit_paid: '💰 Deposit',
  paid_in_full: '💰 Paid',
};

export default function HomeScreen({ navigation }: any) {
  const { dealer }       = useAuth();
  const { tenantConfig } = useTenant();

  const [rooms, setRooms]           = useState<any[]>([]);
  const [recentQuotes, setRecentQuotes] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [jobName, setJobName]       = useState('');
  const [editingJob, setEditingJob] = useState(false);
  const [jobDraft, setJobDraft]     = useState('');

  // Metrics
  const [approvedValue, setApprovedValue] = useState(0);
  const [quotesSent, setQuotesSent]       = useState(0);
  const [totalWindows, setTotalWindows]   = useState(0);
  const [quoteCount, setQuoteCount]       = useState(0);

  const brandColor = tenantConfig.primary_color;

  useFocusEffect(useCallback(() => {
    loadData();
  }, [dealer]));

  const loadData = async () => {
    if (!dealer) return;
    try {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [roomData, quotesRes, sentRes] = await Promise.all([
        roomsService.getRooms(dealer.id),
        supabase
          .from('quotes')
          .select(`
            id, quote_number, status, total_cents, payment_status, created_at,
            customer:customers(first_name, last_name)
          `)
          .eq('dealer_id', dealer.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('quotes')
          .select('id', { count: 'exact', head: true })
          .eq('dealer_id', dealer.id)
          .in('status', ['sent', 'viewed', 'approved', 'ordered', 'installed'])
          .gte('created_at', monthStart.toISOString()),
      ]);

      const allRooms = roomData ?? [];
      setRooms(allRooms);
      setTotalWindows(allRooms.reduce((a: number, r: any) => a + (r.windows?.length ?? 0), 0));

      const quotes = quotesRes.data ?? [];
      setQuoteCount(quotes.length);
      setRecentQuotes(quotes.slice(0, 3));

      const approved = quotes
        .filter((q: any) => ['approved', 'ordered', 'installed'].includes(q.status))
        .reduce((a: number, q: any) => a + (q.total_cents ?? 0), 0);
      setApprovedValue(approved);
      setQuotesSent(sentRes.count ?? 0);

    } catch (e) { console.error('HomeScreen load', e); }
    finally { setLoading(false); }
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const dealerFirstName = (() => {
    const name = (dealer as any)?.owner_name ?? (dealer as any)?.name ?? '';
    return name.split(' ')[0] ?? name;
  })();

  const coveredWindows = rooms.reduce((a, r) => a +
    (r.windows?.filter((w: any) => w.product_id || w.fabric_collection_name).length ?? 0), 0
  );

  if (loading) {
    return (
      <View style={S.centered}>
        <ActivityIndicator color={brandColor} size="large" />
      </View>
    );
  }

  return (
    <View style={S.container}>

      {/* ── Header ── */}
      <View style={S.header}>
        <View>
          <Text style={S.greeting}>{greeting()}, {dealerFirstName}</Text>
          <Text style={S.subline}>
            {totalWindows === 0
              ? "Let's get measuring."
              : coveredWindows === totalWindows
              ? 'All windows covered. Ready to quote.'
              : `${totalWindows - coveredWindows} window${totalWindows - coveredWindows !== 1 ? 's' : ''} left to cover.`}
          </Text>
        </View>
        <TouchableOpacity
          style={[S.jobPill, { borderColor: jobName ? brandColor + '55' : 'rgba(255,255,255,0.1)' }]}
          onPress={() => { setJobDraft(jobName); setEditingJob(true); }}
        >
          <Text style={[S.jobPillText, { color: jobName ? brandColor : 'rgba(255,255,255,0.3)' }]} numberOfLines={1}>
            {jobName || '+ Job'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Metrics row ── */}
      <View style={S.metricsRow}>
        <View style={S.metricChip}>
          <Text style={[S.metricValue, { color: '#30D158' }]}>
            ${approvedValue >= 10000000
              ? `${(approvedValue / 100000).toFixed(0)}k`
              : (approvedValue / 100).toFixed(0)}
          </Text>
          <Text style={S.metricLabel}>Approved</Text>
        </View>
        <View style={S.metricDivider} />
        <View style={S.metricChip}>
          <Text style={[S.metricValue, { color: brandColor }]}>{quotesSent}</Text>
          <Text style={S.metricLabel}>Sent this mo.</Text>
        </View>
        <View style={S.metricDivider} />
        <View style={S.metricChip}>
          <Text style={[S.metricValue, { color: 'rgba(255,255,255,0.8)' }]}>{totalWindows}</Text>
          <Text style={S.metricLabel}>Windows</Text>
        </View>
      </View>

      {/* ── Hero: New Quote ── */}
      <TouchableOpacity
        style={[S.heroCard, { backgroundColor: brandColor }]}
        onPress={() => navigation.navigate('Quotes', { screen: 'QuoteBuilder', params: {} })}
        activeOpacity={0.85}
      >
        <View style={S.heroContent}>
          <View>
            <Text style={S.heroLabel}>START HERE</Text>
            <Text style={S.heroTitle}>New Quote</Text>
            <Text style={S.heroSub}>Build, price & send to customer</Text>
          </View>
          <Text style={S.heroIcon}>📋</Text>
        </View>
        <View style={S.heroFooter}>
          <Text style={S.heroStat}>{quoteCount} quote{quoteCount !== 1 ? 's' : ''} total</Text>
          <Text style={S.heroArrow}>→</Text>
        </View>
      </TouchableOpacity>

      {/* ── Recent Quotes ── */}
      <TouchableOpacity
        style={S.recentCard}
        onPress={() => navigation.navigate('Quotes')}
        activeOpacity={1}
      >
        <View style={S.recentHeader}>
          <Text style={S.recentTitle}>Recent Quotes</Text>
          <Text style={[S.recentSeeAll, { color: brandColor }]}>See all →</Text>
        </View>

        {recentQuotes.length === 0 ? (
          <Text style={S.recentEmpty}>No quotes yet — tap New Quote to start.</Text>
        ) : (
          recentQuotes.map((q: any, i: number) => {
            const color = STATUS_COLORS[q.status] ?? 'rgba(255,255,255,0.3)';
            const label = STATUS_LABELS[q.status] ?? q.status;
            const customerName = q.customer
              ? `${q.customer.first_name} ${q.customer.last_name}`.trim()
              : 'No customer';
            const total = q.total_cents ? `$${(q.total_cents / 100).toFixed(0)}` : '—';
            const ps = q.payment_status;
            const psColor = PAYMENT_COLORS[ps];
            const psLabel = PAYMENT_LABELS[ps];

            return (
              <TouchableOpacity
                key={q.id}
                onPress={() => navigation.navigate('Quotes', { screen: 'QuoteBuilder', params: { quoteId: q.id } })}
                activeOpacity={0.7}
              >
                {i > 0 && <View style={S.recentDivider} />}
                <View style={S.recentRow}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={S.recentCustomer}>{customerName}</Text>
                    <Text style={S.recentNumber}>{q.quote_number || 'Draft'}</Text>
                  </View>
                  <View style={S.recentRight}>
                    <Text style={S.recentTotal}>{total}</Text>
                    <View style={S.recentBadges}>
                      <View style={[S.badge, { backgroundColor: color + '20', borderColor: color + '50' }]}>
                        <Text style={[S.badgeText, { color }]}>{label}</Text>
                      </View>
                      {psColor && (
                        <View style={[S.badge, { backgroundColor: psColor + '20', borderColor: psColor + '50' }]}>
                          <Text style={[S.badgeText, { color: psColor }]}>{psLabel}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </TouchableOpacity>

      {/* ── Browse Fabrics ── */}
      <TouchableOpacity
        style={[S.searchRow, { marginBottom: 24 }]}
        onPress={() => navigation.navigate('Search')}
        activeOpacity={0.85}
      >
        <Text style={S.searchIcon}>🔍</Text>
        <View style={{ flex: 1 }}>
          <Text style={S.searchTitle}>Browse Fabrics & Products</Text>
          <Text style={S.searchSub}>Norman · Hunter Douglas · 2 brands</Text>
        </View>
        <Text style={[S.searchArrow, { color: brandColor }]}>→</Text>
      </TouchableOpacity>

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
    </View>
  );
}

const S = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#080C14', padding: 20, paddingTop: 64, gap: 12 },
  centered:       { flex: 1, backgroundColor: '#080C14', alignItems: 'center', justifyContent: 'center' },

  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  greeting:       { color: 'white', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  subline:        { color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 3 },
  jobPill:        { borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, maxWidth: 120 },
  jobPillText:    { fontSize: 12, fontWeight: '700' },

  metricsRow:     { flexDirection: 'row', backgroundColor: '#0D1520', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', paddingVertical: 14, paddingHorizontal: 8 },
  metricChip:     { flex: 1, alignItems: 'center', gap: 3 },
  metricValue:    { fontSize: 20, fontWeight: '800' },
  metricLabel:    { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '600' },
  metricDivider:  { width: 1, backgroundColor: 'rgba(255,255,255,0.08)' },

  heroCard:       { borderRadius: 20, padding: 20, gap: 14 },
  heroContent:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLabel:      { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  heroTitle:      { color: 'white', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  heroSub:        { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 4 },
  heroIcon:       { fontSize: 44 },
  heroFooter:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroStat:       { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
  heroArrow:      { color: 'white', fontSize: 18, fontWeight: '700' },

  recentCard:     { backgroundColor: '#0D1520', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', padding: 16, gap: 12 },
  recentHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recentTitle:    { color: 'white', fontSize: 15, fontWeight: '800' },
  recentSeeAll:   { fontSize: 13, fontWeight: '600' },
  recentEmpty:    { color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  recentDivider:  { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 10 },
  recentRow:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recentCustomer: { color: 'white', fontSize: 14, fontWeight: '700' },
  recentNumber:   { color: 'rgba(255,255,255,0.3)', fontSize: 11 },
  recentRight:    { alignItems: 'flex-end', gap: 5 },
  recentTotal:    { color: 'white', fontSize: 15, fontWeight: '800' },
  recentBadges:   { flexDirection: 'row', gap: 5 },
  badge:          { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText:      { fontSize: 10, fontWeight: '700' },

  searchRow:      { backgroundColor: '#0D1520', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  searchIcon:     { fontSize: 22 },
  searchTitle:    { color: 'white', fontSize: 14, fontWeight: '700' },
  searchSub:      { color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 },
  searchArrow:    { fontSize: 16, fontWeight: '700' },

  modal:          { flex: 1, backgroundColor: '#080C14' },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  modalTitle:     { color: 'white', fontSize: 18, fontWeight: '800' },
  modalClose:     { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  modalLabel:     { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  modalInput:     { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, color: 'white', fontSize: 16, padding: 14 },
  modalSave:      { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  modalSaveText:  { color: 'white', fontWeight: '700', fontSize: 15 },
  modalClear:     { alignItems: 'center', paddingVertical: 8 },
  modalClearText: { color: 'rgba(255,69,58,0.7)', fontSize: 13, fontWeight: '600' },
});