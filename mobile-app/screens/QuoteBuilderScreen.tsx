import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Modal,
} from 'react-native';

const Alert = {
  alert: (title: string, message?: string, buttons?: Array<{text: string, onPress?: () => void}>) => {
    if (buttons && buttons.length > 1) {
      const result = window.confirm(`${title}\n\n${message ?? ''}`);
      if (result) { buttons[1]?.onPress?.(); } else { buttons[0]?.onPress?.(); }
    } else {
      window.alert(`${title}${message ? '\n\n' + message : ''}`);
      buttons?.[0]?.onPress?.();
    }
  }
};

import { useAuth } from '../context/AuthContext';
import { quotesService, customersService, roomsService } from '../lib/supabase';
import type { Quote, Customer } from '../lib/supabase';

const DEFAULT_MARGIN = 40;
const DEFAULT_INSTALL = 15;

export default function QuoteBuilderScreen({ route, navigation }: any) {
  const { quoteId } = route.params ?? {};
  const { dealer } = useAuth();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(!!quoteId);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomerFirstName, setNewCustomerFirstName] = useState('');
  const [newCustomerLastName, setNewCustomerLastName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [notes, setNotes] = useState('');

  const [globalMargin, setGlobalMargin] = useState(DEFAULT_MARGIN);
  const [installPercent, setInstallPercent] = useState(DEFAULT_INSTALL);
  const [itemMargins, setItemMargins] = useState<Record<string, number>>({});

  const [showWindowPicker, setShowWindowPicker] = useState(false);
  const [addedWindowIds, setAddedWindowIds] = useState<Set<string>>(new Set());

  useEffect(() => { init(); }, [quoteId]);

  const customerFullName = (c: Customer) => `${c.first_name} ${c.last_name}`.trim();

  const init = async () => {
    if (!dealer) return;
    try {
      const [custData, roomData] = await Promise.all([
        customersService.getCustomers(dealer.id),
        roomsService.getRooms(dealer.id),
      ]);
      setCustomers(custData);
      setRooms(roomData);
      if (quoteId) {
        const q = await quotesService.getQuote(quoteId);
        setQuote(q);
        if (q.customer) setSelectedCustomer(q.customer as Customer);
        // Track which windows are already in the quote
        const ids = new Set<string>((q.line_items ?? []).map((li: any) => li.window_id).filter(Boolean));
        setAddedWindowIds(ids);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c =>
    customerFullName(c).toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.email ?? '').toLowerCase().includes(customerSearch.toLowerCase())
  );

  const getItemMargin = (itemId: string) => itemMargins[itemId] ?? globalMargin;

  const getAdjustedPrice = (baseCents: number, itemId: string) => {
    const margin = getItemMargin(itemId);
    return Math.round(baseCents * (1 + margin / 100));
  };

  const lineItems = quote?.line_items ?? [];

  const computedSubtotal = lineItems.reduce((sum: number, item: any) => {
    return sum + getAdjustedPrice(item.unit_price_cents, item.id ?? '');
  }, 0);

  const computedInstall = Math.round(computedSubtotal * installPercent / 100);
  const computedTotal = computedSubtotal + computedInstall;

  const handleCreateQuote = async () => {
    if (!dealer) return;
    if (!selectedCustomer && !newCustomerFirstName.trim()) {
      Alert.alert('Customer required', 'Select or create a customer first.');
      return;
    }
    setSaving(true);
    try {
      let customerId = selectedCustomer?.id;
      if (isNewCustomer) {
        const newCust = await customersService.createCustomer({
          dealer_id: dealer.id,
          first_name: newCustomerFirstName.trim(),
          last_name: newCustomerLastName.trim(),
          email: newCustomerEmail.trim() || undefined,
          phone: newCustomerPhone.trim() || undefined,
          address_line1: newCustomerAddress.trim() || undefined,
          city: undefined, state: undefined, zip: undefined,
        });
        customerId = newCust.id;
        setSelectedCustomer(newCust);
      }
      const q = await quotesService.createQuote({
        dealerId: dealer.id,
        customerId: customerId!,
        quoteNumber: '',
        windows: [],
        notes: notes.trim() || undefined,
        installPercent,
      });
      setQuote(q);
    } catch (e: any) {
      Alert.alert('Failed to create quote', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddWindow = async (window: any) => {
    if (!quote || !dealer) return;
    if (!window.product) {
      Alert.alert('No product assigned', 'Assign a product to this window in the Rooms screen first.');
      return;
    }
    setSaving(true);
    try {
      await quotesService.addLineItem(quote.id, {
        window_id: window.id,
        product_id: window.product.id,
        description: `${window.label ?? 'Window'} — ${window.product.name}`,
        width_in: window.width_in,
        height_in: window.height_in,
        unit_price_cents: window.product.custom_price_cents ?? window.product.base_price_cents,
        quantity: 1,
      });
      const updated = await quotesService.getQuote(quote.id);
      setQuote(updated);
      setAddedWindowIds(prev => new Set([...prev, window.id]));
    } catch (e: any) {
      Alert.alert('Failed to add window', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLineItem = async (lineItemId: string, windowId?: string) => {
    if (!quote) return;
    setSaving(true);
    try {
      await quotesService.removeLineItem(quote.id, lineItemId);
      const updated = await quotesService.getQuote(quote.id);
      setQuote(updated);
      if (windowId) {
        setAddedWindowIds(prev => { const n = new Set(prev); n.delete(windowId); return n; });
      }
    } catch (e: any) {
      Alert.alert('Failed to remove item', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (!quote) return;
    setSending(true);
    try {
      await quotesService.sendQuote(quote.id);
      const updated = await quotesService.getQuote(quote.id);
      setQuote(updated);
    } catch (e: any) {
      Alert.alert('Failed to send', e.message);
    } finally {
      setSending(false);
    }
  };

  // All windows across all rooms that have a product assigned
  const allWindows = rooms.flatMap((r: any) =>
    (r.windows ?? []).map((w: any) => ({ ...w, roomName: r.name }))
  );
  const windowsWithProducts = allWindows.filter((w: any) => w.product);
  const windowsAvailable = windowsWithProducts.filter((w: any) => !addedWindowIds.has(w.id));

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color="#0A84FF" size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{quote ? quote.quote_number : 'New Quote'}</Text>
        {quote && (
          <View style={[styles.statusBadge, {
            backgroundColor: quote.status === 'sent' ? 'rgba(10,132,255,0.15)' : 'rgba(255,255,255,0.08)',
            borderColor: quote.status === 'sent' ? '#0A84FF' : 'rgba(255,255,255,0.15)',
          }]}>
            <Text style={[styles.statusText, { color: quote.status === 'sent' ? '#0A84FF' : 'rgba(255,255,255,0.5)' }]}>
              {quote.status.toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Customer section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Customer</Text>
          {selectedCustomer && !isNewCustomer ? (
            <View style={styles.selectedCustomer}>
              <View>
                <Text style={styles.selectedCustomerName}>{customerFullName(selectedCustomer)}</Text>
                <Text style={styles.selectedCustomerSub}>{selectedCustomer.email ?? selectedCustomer.phone ?? ''}</Text>
              </View>
              {!quote && (
                <TouchableOpacity onPress={() => setSelectedCustomer(null)}>
                  <Text style={styles.changeText}>Change</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : !quote ? (
            <View style={styles.section}>
              <View style={styles.tabRow}>
                <TouchableOpacity style={[styles.tab, !isNewCustomer && styles.tabActive]} onPress={() => setIsNewCustomer(false)}>
                  <Text style={[styles.tabText, !isNewCustomer && styles.tabTextActive]}>Existing</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, isNewCustomer && styles.tabActive]} onPress={() => setIsNewCustomer(true)}>
                  <Text style={[styles.tabText, isNewCustomer && styles.tabTextActive]}>New Customer</Text>
                </TouchableOpacity>
              </View>
              {!isNewCustomer ? (
                <View>
                  <TextInput
                    value={customerSearch}
                    onChangeText={setCustomerSearch}
                    style={styles.textInput}
                    placeholder="Search customers..."
                    placeholderTextColor="rgba(255,255,255,0.25)"
                  />
                  {filteredCustomers.slice(0, 5).map(c => (
                    <TouchableOpacity key={c.id} style={styles.customerOption} onPress={() => setSelectedCustomer(c)}>
                      <Text style={styles.customerOptionName}>{customerFullName(c)}</Text>
                      <Text style={styles.customerOptionSub}>{c.email ?? c.phone ?? ''}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.formFields}>
                  {[
                    ['First Name *', newCustomerFirstName, setNewCustomerFirstName],
                    ['Last Name', newCustomerLastName, setNewCustomerLastName],
                    ['Email', newCustomerEmail, setNewCustomerEmail],
                    ['Phone', newCustomerPhone, setNewCustomerPhone],
                    ['Address', newCustomerAddress, setNewCustomerAddress],
                  ].map(([label, value, setter]: any) => (
                    <View key={label}>
                      <Text style={styles.fieldLabel}>{label}</Text>
                      <TextInput value={value} onChangeText={setter} style={styles.textInput}
                        placeholderTextColor="rgba(255,255,255,0.25)" placeholder={label} />
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : null}
        </View>

        {/* Windows / Line items section */}
        {quote && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>Windows</Text>
              <TouchableOpacity
                style={styles.addWindowBtn}
                onPress={() => setShowWindowPicker(true)}
              >
                <Text style={styles.addWindowBtnText}>+ Add Window</Text>
              </TouchableOpacity>
            </View>

            {lineItems.length === 0 ? (
              <View style={styles.emptyWindows}>
                <Text style={styles.emptyWindowsText}>No windows added yet.</Text>
                <Text style={styles.emptyWindowsHint}>Tap "+ Add Window" to add scanned windows with assigned products.</Text>
              </View>
            ) : (
              lineItems.map((item: any) => {
                const itemId = item.id ?? '';
                const margin = getItemMargin(itemId);
                const adjustedPrice = getAdjustedPrice(item.unit_price_cents, itemId);
                return (
                  <View key={itemId} style={styles.lineItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lineItemName}>{item.product_name ?? item.description ?? 'Window'}</Text>
                      {item.width_in && item.height_in && (
                        <Text style={styles.lineItemSub}>{item.width_in}" × {item.height_in}"</Text>
                      )}
                      <View style={styles.itemMarginRow}>
                        <Text style={styles.itemMarginLabel}>Margin:</Text>
                        <TouchableOpacity style={styles.itemMarginBtn}
                          onPress={() => setItemMargins(p => ({ ...p, [itemId]: Math.max(0, margin - 5) }))}>
                          <Text style={styles.marginBtnText}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.itemMarginVal}>{margin}%</Text>
                        <TouchableOpacity style={styles.itemMarginBtn}
                          onPress={() => setItemMargins(p => ({ ...p, [itemId]: Math.min(200, margin + 5) }))}>
                          <Text style={styles.marginBtnText}>+</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleRemoveLineItem(itemId, item.window_id)}>
                          <Text style={styles.removeText}>remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.lineItemPriceCol}>
                      <Text style={styles.lineItemPrice}>${(adjustedPrice / 100).toFixed(0)}</Text>
                      <Text style={styles.lineItemBase}>base ${(item.unit_price_cents / 100).toFixed(0)}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* Margin controls */}
        {quote && lineItems.length > 0 && (
          <View style={styles.marginCard}>
            <View style={styles.marginRow}>
              <View style={styles.marginField}>
                <Text style={styles.marginLabel}>Global Markup %</Text>
                <View style={styles.marginInputRow}>
                  <TouchableOpacity style={styles.marginBtn}
                    onPress={() => { setGlobalMargin(m => Math.max(0, m - 5)); setItemMargins({}); }}>
                    <Text style={styles.marginBtnText}>−</Text>
                  </TouchableOpacity>
                  <TextInput value={String(globalMargin)} onChangeText={v => {
                    const n = parseInt(v.replace(/[^0-9]/g, '')) || 0;
                    setGlobalMargin(Math.min(200, Math.max(0, n)));
                    setItemMargins({});
                  }} style={styles.marginInput} keyboardType="numeric" selectTextOnFocus />
                  <TouchableOpacity style={styles.marginBtn}
                    onPress={() => { setGlobalMargin(m => Math.min(200, m + 5)); setItemMargins({}); }}>
                    <Text style={styles.marginBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.marginField}>
                <Text style={styles.marginLabel}>Install %</Text>
                <View style={styles.marginInputRow}>
                  <TouchableOpacity style={styles.marginBtn}
                    onPress={() => setInstallPercent(p => Math.max(0, p - 5))}>
                    <Text style={styles.marginBtnText}>−</Text>
                  </TouchableOpacity>
                  <TextInput value={String(installPercent)} onChangeText={v => {
                    const n = parseInt(v.replace(/[^0-9]/g, '')) || 0;
                    setInstallPercent(Math.min(100, Math.max(0, n)));
                  }} style={styles.marginInput} keyboardType="numeric" selectTextOnFocus />
                  <TouchableOpacity style={styles.marginBtn}
                    onPress={() => setInstallPercent(p => Math.min(100, p + 5))}>
                    <Text style={styles.marginBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Totals */}
        {quote && lineItems.length > 0 && (
          <View style={styles.totalsCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalVal}>${(computedSubtotal / 100).toFixed(0)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Installation ({installPercent}%)</Text>
              <Text style={styles.totalVal}>${(computedInstall / 100).toFixed(0)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalVal}>${(computedTotal / 100).toFixed(0)}</Text>
            </View>
          </View>
        )}

        {/* Notes */}
        {!quote && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notes (optional)</Text>
            <TextInput value={notes} onChangeText={setNotes}
              style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
              multiline placeholder="Any special notes..." placeholderTextColor="rgba(255,255,255,0.25)" />
          </View>
        )}

        {/* Actions */}
        {!quote ? (
          <TouchableOpacity style={[styles.primaryBtn, saving && styles.btnDisabled]}
            onPress={handleCreateQuote} disabled={saving}>
            {saving ? <ActivityIndicator color="white" size="small" />
              : <Text style={styles.primaryBtnText}>Create Quote</Text>}
          </TouchableOpacity>
        ) : quote.status === 'draft' ? (
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.primaryBtn, { flex: 1 }, sending && styles.btnDisabled]}
              onPress={handleSend} disabled={sending}>
              {sending ? <ActivityIndicator color="white" size="small" />
                : <Text style={styles.primaryBtnText}>Send to Customer →</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.sentStatusCard}>
            <Text style={styles.sentStatusText}>
              {quote.status === 'approved' ? '✅ Customer approved this quote' : `Quote is ${quote.status}`}
            </Text>
          </View>
        )}

      </ScrollView>

      {/* Window picker modal */}
      <Modal visible={showWindowPicker} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Windows</Text>
            <TouchableOpacity onPress={() => setShowWindowPicker(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {windowsAvailable.length === 0 ? (
              <View style={styles.emptyWindows}>
                <Text style={styles.emptyWindowsText}>No windows available to add.</Text>
                <Text style={styles.emptyWindowsHint}>
                  {windowsWithProducts.length === 0
                    ? 'Go to Rooms, scan windows, and assign products before building a quote.'
                    : 'All windows with products have been added to this quote.'}
                </Text>
              </View>
            ) : (
              rooms.map((room: any) => {
                const roomWindows = (room.windows ?? []).filter((w: any) => w.product && !addedWindowIds.has(w.id));
                if (roomWindows.length === 0) return null;
                return (
                  <View key={room.id} style={styles.roomSection}>
                    <Text style={styles.roomSectionTitle}>{room.name}</Text>
                    {roomWindows.map((w: any) => (
                      <TouchableOpacity key={w.id} style={styles.windowPickerItem}
                        onPress={() => { handleAddWindow(w); setShowWindowPicker(false); }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.windowPickerName}>{w.label ?? 'Window'}</Text>
                          <Text style={styles.windowPickerSub}>
                            {w.width_in && w.height_in ? `${w.width_in}" × ${w.height_in}"  ·  ` : ''}
                            {w.product?.name ?? ''}
                          </Text>
                        </View>
                        <Text style={styles.windowPickerPrice}>
                          ${((w.product?.custom_price_cents ?? w.product?.base_price_cents ?? 0) / 100).toFixed(0)}
                        </Text>
                        <Text style={styles.addChevron}>+</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080C14' },
  centered: { flex: 1, backgroundColor: '#080C14', alignItems: 'center', justifyContent: 'center' },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: 'white', fontSize: 24, lineHeight: 30 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: '800', flex: 1 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  content: { padding: 20, gap: 20, paddingBottom: 40 },
  section: { gap: 10 },
  sectionLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addWindowBtn: { backgroundColor: 'rgba(10,132,255,0.15)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(10,132,255,0.3)' },
  addWindowBtnText: { color: '#0A84FF', fontWeight: '700', fontSize: 13 },
  selectedCustomer: { backgroundColor: '#0D1520', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(10,132,255,0.3)', padding: 14, flexDirection: 'row', justifyContent: 'space-between' },
  selectedCustomerName: { color: 'white', fontWeight: '700', fontSize: 15 },
  selectedCustomerSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  changeText: { color: '#0A84FF', fontWeight: '600', fontSize: 13 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center' },
  tabActive: { backgroundColor: 'rgba(10,132,255,0.15)', borderWidth: 1, borderColor: '#0A84FF' },
  tabText: { color: 'rgba(255,255,255,0.4)', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#0A84FF' },
  formFields: { gap: 10 },
  fieldLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 4 },
  textInput: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, color: 'white', fontSize: 15, padding: 12 },
  customerOption: { backgroundColor: '#0D1520', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 12, marginTop: 6 },
  customerOptionName: { color: 'white', fontWeight: '600', fontSize: 14 },
  customerOptionSub: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 },
  emptyWindows: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 20, alignItems: 'center', gap: 8 },
  emptyWindowsText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' },
  emptyWindowsHint: { color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  lineItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  lineItemName: { color: 'white', fontWeight: '600', fontSize: 14 },
  lineItemSub: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 },
  lineItemPriceCol: { alignItems: 'flex-end', justifyContent: 'flex-start', marginLeft: 12 },
  lineItemPrice: { color: 'white', fontWeight: '700', fontSize: 15 },
  lineItemBase: { color: 'rgba(255,255,255,0.25)', fontSize: 10, marginTop: 2 },
  itemMarginRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  itemMarginLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 11 },
  itemMarginBtn: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  itemMarginVal: { color: '#0A84FF', fontWeight: '700', fontSize: 12, minWidth: 32, textAlign: 'center' },
  removeText: { color: 'rgba(255,69,58,0.7)', fontSize: 10, fontWeight: '600', marginLeft: 4 },
  marginBtnText: { color: 'white', fontSize: 16, fontWeight: '600', lineHeight: 20 },
  marginCard: { backgroundColor: '#0D1520', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', padding: 16, gap: 12 },
  marginRow: { flexDirection: 'column', gap: 12 },
  marginField: { flex: 1, gap: 6 },
  marginLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600' },
  marginInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  marginBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  marginInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, color: 'white', fontSize: 15, padding: 6, textAlign: 'center' },
  totalsCard: { backgroundColor: '#0D1520', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', padding: 16, gap: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  totalVal: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 4 },
  grandTotalLabel: { color: 'white', fontWeight: '700', fontSize: 16 },
  grandTotalVal: { color: '#0A84FF', fontWeight: '800', fontSize: 22 },
  btnRow: { flexDirection: 'row', gap: 10 },
  primaryBtn: { backgroundColor: '#0A84FF', borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
  sentStatusCard: { backgroundColor: 'rgba(48,209,88,0.08)', borderWidth: 1, borderColor: 'rgba(48,209,88,0.2)', borderRadius: 14, padding: 16, alignItems: 'center' },
  sentStatusText: { color: '#30D158', fontWeight: '600', fontSize: 14 },
  modalContainer: { flex: 1, backgroundColor: '#080C14' },
  modalHeader: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  modalTitle: { color: 'white', fontSize: 20, fontWeight: '800' },
  modalClose: { color: '#0A84FF', fontSize: 16, fontWeight: '600' },
  modalContent: { padding: 20, gap: 16, paddingBottom: 40 },
  roomSection: { gap: 8 },
  roomSectionTitle: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  windowPickerItem: { backgroundColor: '#0D1520', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  windowPickerName: { color: 'white', fontWeight: '600', fontSize: 15 },
  windowPickerSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  windowPickerPrice: { color: '#30D158', fontWeight: '700', fontSize: 15 },
  addChevron: { color: '#0A84FF', fontSize: 22, fontWeight: '700', marginLeft: 4 },
});
