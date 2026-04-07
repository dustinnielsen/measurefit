import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { quotesService } from '../lib/supabase';
import type { Quote } from '../lib/supabase';

const STATUS_COLORS: Record<string, string> = {
  draft: 'rgba(255,255,255,0.3)',
  sent: '#0A84FF',
  viewed: '#FF9F0A',
  approved: '#30D158',
  declined: '#FF453A',
  ordered: '#BF5AF2',
  installed: '#30D158',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', sent: 'Sent', viewed: 'Viewed',
  approved: 'Approved ✓', declined: 'Declined',
  ordered: 'Ordered', installed: 'Installed ✓',
};

export default function QuoteScreen({ navigation }: any) {
  const { dealer } = useAuth();
  const { tenantConfig } = useTenant();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const brandColor = tenantConfig.primary_color;

  useFocusEffect(useCallback(() => {
    if (dealer) loadQuotes();
  }, [dealer]));

  const loadQuotes = async () => {
    try {
      const data = await quotesService.getQuotes(dealer!.id);
      setQuotes(data);
    } catch (e) {
      console.error('Quote load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDelete = async (quoteId: string) => {
    setMenuOpenId(null);
    if (!window.confirm('Delete this quote? This cannot be undone.')) return;
    setDeletingId(quoteId);
    try {
      await quotesService.deleteQuote(quoteId);
      setQuotes((prev: any) => prev.filter((q: any) => q.id !== quoteId));
    } catch (e) {
      console.error('Delete error:', e);
      window.alert('Failed to delete quote.');
    } finally {
      setDeletingId(null);
    }
  };

  const totalValue = quotes
    .filter((q: any) => q.status === 'approved' || q.status === 'ordered' || q.status === 'installed')
    .reduce((a: any, q: any) => a + (q.total_cents ?? 0), 0);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={brandColor} size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Quotes</Text>
          {totalValue > 0 && (
            <Text style={styles.headerSub}>${(totalValue / 100).toLocaleString()} approved</Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.newQuoteBtn, { backgroundColor: brandColor }]}
          onPress={() => navigation.navigate('QuoteBuilder', {})}
        >
          <Text style={styles.newQuoteBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={quotes}
        keyExtractor={(q: any) => q.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadQuotes(); }}
            tintColor={brandColor}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>No quotes yet</Text>
            <Text style={styles.emptyDesc}>Scan {tenantConfig.product_noun_plural} and build your first quote</Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: brandColor }]}
              onPress={() => navigation.navigate('QuoteBuilder', {})}
            >
              <Text style={styles.emptyBtnText}>Create Quote</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item: q }: any) => {
          const color = STATUS_COLORS[q.status] ?? 'rgba(255,255,255,0.3)';
          const total = q.total_cents ? `$${(q.total_cents / 100).toFixed(0)}` : '—';
          const date = q.created_at ? new Date(q.created_at).toLocaleDateString() : '';
          const isMenuOpen = menuOpenId === q.id;
          const isDeleting = deletingId === q.id;

          return (
            <View style={styles.cardWrapper}>
              <View style={styles.cardRow}>
                <TouchableOpacity
                  style={styles.quoteCard}
                  onPress={() => {
                    if (isMenuOpen) { setMenuOpenId(null); return; }
                    navigation.navigate('QuoteBuilder', { quoteId: q.id });
                  }}
                >
                  <View style={styles.quoteCardLeft}>
                    <Text style={styles.quoteNumber}>{q.quote_number}</Text>
                    <Text style={styles.customerName}>
                      {q.customer ? `${q.customer.first_name} ${q.customer.last_name}` : 'No customer'}
                    </Text>
                    <Text style={styles.quoteDate}>{date}</Text>
                  </View>
                  <View style={styles.quoteCardRight}>
                    <Text style={styles.quoteTotal}>{total}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: `${color}20`, borderColor: `${color}50` }]}>
                      <Text style={[styles.statusText, { color }]}>{STATUS_LABELS[q.status]}</Text>
                    </View>
                    {q.payment_status && q.payment_status !== 'unpaid' && (
                      <View style={[styles.statusBadge, {
                        backgroundColor: (q.payment_status === 'deposit_paid' || q.payment_status === 'paid_in_full')
                          ? 'rgba(48,209,88,0.1)' : 'rgba(255,159,10,0.1)',
                        borderColor: (q.payment_status === 'deposit_paid' || q.payment_status === 'paid_in_full')
                          ? 'rgba(48,209,88,0.3)' : 'rgba(255,159,10,0.3)',
                      }]}>
                        <Text style={[styles.statusText, {
                          color: (q.payment_status === 'deposit_paid' || q.payment_status === 'paid_in_full')
                            ? '#30D158' : '#FF9F0A',
                        }]}>
                          {q.payment_status === 'paid_in_full' ? '💰 Paid' :
                           q.payment_status === 'deposit_paid' ? '💰 Deposit' : '🔗 Link Sent'}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuBtn}
                  onPress={() => setMenuOpenId(isMenuOpen ? null : q.id)}
                >
                  {isDeleting
                    ? <ActivityIndicator color="rgba(255,255,255,0.4)" size="small" />
                    : <Text style={styles.menuBtnText}>⋯</Text>
                  }
                </TouchableOpacity>
              </View>

              {isMenuOpen && (
                <View style={styles.dropdown}>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      setMenuOpenId(null);
                      navigation.navigate('QuoteBuilder', { quoteId: q.id });
                    }}
                  >
                    <Text style={styles.dropdownItemText}>✏️  Edit Quote</Text>
                  </TouchableOpacity>
                  <View style={styles.dropdownDivider} />
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => handleDelete(q.id)}
                  >
                    <Text style={styles.dropdownDeleteText}>🗑  Delete Quote</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080C14' },
  centered: { flex: 1, backgroundColor: '#080C14', alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  headerSub: { color: '#30D158', fontSize: 13, fontWeight: '600', marginTop: 2 },
  newQuoteBtn: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  newQuoteBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  list: { padding: 20, gap: 10, paddingBottom: 40 },
  cardWrapper: { position: 'relative' },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  quoteCard: {
    flex: 1,
    backgroundColor: '#0D1520', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    padding: 16, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
  },
  quoteCardLeft: { gap: 3 },
  quoteNumber: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  customerName: { color: 'white', fontWeight: '700', fontSize: 15 },
  quoteDate: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },
  quoteCardRight: { alignItems: 'flex-end', gap: 6 },
  quoteTotal: { color: 'white', fontWeight: '800', fontSize: 18 },
  statusBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  menuBtn: { paddingHorizontal: 12, paddingVertical: 16, justifyContent: 'center' },
  menuBtnText: { color: 'rgba(255,255,255,0.4)', fontSize: 22, fontWeight: '700' },
  dropdown: {
    backgroundColor: '#1C2B3A', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden', marginTop: 4,
  },
  dropdownItem: { paddingVertical: 13, paddingHorizontal: 16 },
  dropdownItemText: { color: 'white', fontSize: 14, fontWeight: '600' },
  dropdownDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  dropdownDeleteText: { color: '#FF453A', fontSize: 14, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { color: 'white', fontSize: 20, fontWeight: '700' },
  emptyDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  emptyBtn: { marginTop: 8, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
});