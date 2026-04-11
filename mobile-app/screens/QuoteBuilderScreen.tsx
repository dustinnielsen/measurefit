import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, Switch,
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
import { useTenant } from '../context/TenantContext';
import { usePlanGating } from '../hooks/usePlanGating';
import { quotesService, customersService, roomsService, supabase } from '../lib/supabase';
import type { Quote, Customer } from '../lib/supabase';

const DEFAULT_MARKUP  = 40;
const DEFAULT_INSTALL = 15;
const API_BASE        = 'https://windowfit-production.up.railway.app';

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  unpaid:       'rgba(255,255,255,0.3)',
  link_sent:    '#FF9F0A',
  deposit_paid: '#30D158',
  paid_in_full: '#30D158',
};
const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid:       'Unpaid',
  link_sent:    'Link Sent',
  deposit_paid: 'Deposit Paid ✓',
  paid_in_full: 'Paid in Full ✓',
};

interface PricingDefault { category: string; cost_multiplier: number; markup_percent: number; }
interface PricingOverride { product_id: string; cost_multiplier: number | null; markup_percent: number | null; custom_price_cents: number | null; }
interface DealerPricing { defaults: PricingDefault[]; overrides: PricingOverride[]; }
interface ParsedMeasurement { label: string; width_inches: number; height_inches: number; mount_type: 'inside' | 'outside'; error?: string; }
type VoiceState = 'idle' | 'recording' | 'processing' | 'confirm' | 'error';

function computeDealerPrice(product: any, pricing: DealerPricing) {
  const msrp = product.msrp_cents ?? product.base_price_cents ?? 0;
  const override = pricing.overrides.find(o => o.product_id === product.id);
  if (override?.custom_price_cents != null) return { dealerCostCents: override.custom_price_cents, quotePriceCents: override.custom_price_cents, markupPercent: 0 };
  const categoryDefault = pricing.defaults.find(d => d.category === product.category);
  const costMultiplier = override?.cost_multiplier ?? categoryDefault?.cost_multiplier ?? 0.31;
  const markupPercent = override?.markup_percent ?? categoryDefault?.markup_percent ?? DEFAULT_MARKUP;
  const dealerCostCents = Math.round(msrp * costMultiplier);
  const quotePriceCents = Math.round(dealerCostCents * (1 + markupPercent / 100));
  return { dealerCostCents, quotePriceCents, markupPercent };
}

export default function QuoteBuilderScreen({ route, navigation }: any) {
  const { quoteId } = route.params ?? {};
  const { dealer } = useAuth();
  const { tenantConfig } = useTenant();
  const { tier, canExportPDF } = usePlanGating();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(!!quoteId);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const [showPDFGate, setShowPDFGate] = useState(false);
  const [showPDFOptions, setShowPDFOptions] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [showMarkup, setShowMarkup] = useState(false);

  const [dealerPricing, setDealerPricing] = useState<DealerPricing>({ defaults: [], overrides: [] });
  const [pricingLoaded, setPricingLoaded] = useState(false);

  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomerFirstName, setNewCustomerFirstName] = useState('');
  const [newCustomerLastName, setNewCustomerLastName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [notes, setNotes] = useState('');

  const [globalMarkup, setGlobalMarkup] = useState(DEFAULT_MARKUP);
  const [installPercent, setInstallPercent] = useState(DEFAULT_INSTALL);
  const [itemMarkups, setItemMarkups] = useState<Record<string, number>>({});

  const [showWindowPicker, setShowWindowPicker] = useState(false);

  // Voice measurement state
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [parsed, setParsed] = useState<ParsedMeasurement | null>(null);
  const [voiceError, setVoiceError] = useState('');
  const [autoSave, setAutoSave] = useState(false);
  const [lastSavedWindowId, setLastSavedWindowId] = useState<string | null>(null);
  const [windowToast, setWindowToast] = useState('');
  const recognitionRef = useRef<any>(null);
  const autoSaveRef = useRef(false);
  autoSaveRef.current = autoSave;

  // Manual entry state
  const [manualVisible, setManualVisible] = useState(false);
  const [manualLabel, setManualLabel] = useState('');
  const [manualWidth, setManualWidth] = useState('');
  const [manualHeight, setManualHeight] = useState('');
  const [manualMount, setManualMount] = useState<'inside' | 'outside'>('inside');
  const [manualSaving, setManualSaving] = useState(false);

  const brandColor = tenantConfig.primary_color;

  useEffect(() => { init(); }, [quoteId]);

  const customerFullName = (c: Customer) => `${c.first_name} ${c.last_name}`.trim();

  const init = async () => {
    if (!dealer) return;
    try {
      const [custData] = await Promise.all([customersService.getCustomers(dealer.id)]);
      setCustomers(custData);
      if (quoteId) {
        const q = await quotesService.getQuote(quoteId);
        setQuote(q);
        if (q.customer) setSelectedCustomer(q.customer as Customer);
      }
      await loadDealerPricing(dealer.id);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDealerPricing = async (dealerId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/dealer/pricing/${dealerId}`);
      if (!res.ok) throw new Error(`Pricing fetch failed: ${res.status}`);
      const json = await res.json();
      setDealerPricing({ defaults: json.defaults ?? [], overrides: json.overrides ?? [] });
      if (json.defaults?.length > 0) setGlobalMarkup(Math.round(json.defaults[0].markup_percent));
    } catch (e) {
      console.warn('Could not load dealer pricing, using defaults:', e);
    } finally {
      setPricingLoaded(true);
    }
  };

  // ── Get or create a default room for this quote ────────────────────────────
  const getOrCreateQuoteRoom = async (): Promise<string> => {
    if (!dealer || !quote) throw new Error('No dealer or quote');
    const roomName = `Quote ${quote.quote_number ?? quoteId}`;
    const { data: existing } = await supabase
      .from('rooms')
      .select('id')
      .eq('dealer_id', dealer.id)
      .eq('name', roomName)
      .single();
    if (existing) return existing.id;
    const newRoom = await roomsService.createRoom({ dealer_id: dealer.id, name: roomName });
    return newRoom.id;
  };

  // ── Save a new window and add as line item ─────────────────────────────────
  const saveWindowToQuote = async (data: ParsedMeasurement) => {
    if (!dealer || !quote) return;
    try {
      const roomId = await getOrCreateQuoteRoom();
      const { data: newWindow, error } = await supabase.from('windows').insert({
        room_id: roomId,
        dealer_id: dealer.id,
        label: data.label,
        width_in: data.width_inches,
        height_in: data.height_inches,
        mount_type: data.mount_type,
      }).select().single();
      if (error) throw error;
      setLastSavedWindowId(newWindow.id);

      // Add as line item with no product (price 0, dealer can assign later)
      await quotesService.addLineItem(quote.id, {
        window_id: newWindow.id,
        product_id: null,
        description: data.label,
        width_in: data.width_inches,
        height_in: data.height_inches,
        unit_price_cents: 0,
        quantity: 1,
      });

      const updated = await quotesService.getQuote(quote.id);
      setQuote(updated);
      return newWindow.id;
    } catch (e) { console.error('saveWindowToQuote', e); }
  };

  // ── Voice measurement ──────────────────────────────────────────────────────
  const openVoiceModal = () => {
    setVoiceState('idle');
    setTranscript('');
    setParsed(null);
    setVoiceError('');
    setVoiceModalVisible(true);
  };

  const showWindowToast = (msg: string) => {
    setWindowToast(msg);
    setTimeout(() => setWindowToast(''), 3000);
  };

  const saveVoiceMeasurement = async (parsedData?: ParsedMeasurement) => {
    const data = parsedData ?? parsed;
    if (!data) return;
    await saveWindowToQuote(data);
    if (autoSaveRef.current) {
      setVoiceState('idle');
      setParsed(null);
      setTranscript('');
      showWindowToast(`✓ ${data.label} added`);
      setTimeout(() => startRecording(), 1000);
    } else {
      setVoiceModalVisible(false);
      showWindowToast(`✓ ${data.label} added`);
    }
  };

  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError('Voice input is not supported on this browser. Please enter manually.');
      setVoiceState('error');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onstart = () => { setVoiceState('recording'); };
    recognition.onresult = async (e: any) => {
      const text = e.results[0][0].transcript;
      setTranscript(text);
      setVoiceState('processing');
      try {
        const res = await fetch(`${API_BASE}/api/voice/parse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: text }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Server error');
        if (data.parsed?.error) {
          setVoiceError(`Couldn't parse: "${text}". Try again or enter manually.`);
          setVoiceState('error');
        } else {
          setParsed(data.parsed);
          if (autoSaveRef.current) {
            await saveVoiceMeasurement(data.parsed);
          } else {
            setVoiceState('confirm');
          }
        }
      } catch (err: any) {
        setVoiceError(err.message || 'Something went wrong. Try again.');
        setVoiceState('error');
      }
    };
    recognition.onerror = (e: any) => {
      setVoiceError(`Could not capture audio: ${e.error}. Try again or enter manually.`);
      setVoiceState('error');
    };
    recognition.onend = () => {
      setVoiceState(prev => prev === 'recording' ? 'processing' : prev);
    };
    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopRecording = () => { if (recognitionRef.current) recognitionRef.current.stop(); };

  const editVoiceInManual = () => {
    if (parsed) { setManualLabel(parsed.label); setManualWidth(String(parsed.width_inches)); setManualHeight(String(parsed.height_inches)); setManualMount(parsed.mount_type); }
    setVoiceModalVisible(false);
    setManualVisible(true);
  };

  const openManual = () => {
    setManualLabel(''); setManualWidth(''); setManualHeight(''); setManualMount('inside');
    setVoiceModalVisible(false);
    setManualVisible(true);
  };

  const saveManual = async () => {
    if (!manualWidth || !manualHeight) return;
    setManualSaving(true);
    try {
      await saveWindowToQuote({
        label: manualLabel || 'Window',
        width_inches: parseFloat(manualWidth),
        height_inches: parseFloat(manualHeight),
        mount_type: manualMount,
      });
      setManualVisible(false);
      showWindowToast(`✓ ${manualLabel || 'Window'} added`);
    } catch (e) { console.error('saveManual', e); }
    finally { setManualSaving(false); }
  };

  // ── Pricing helpers ────────────────────────────────────────────────────────
  const getLineDealerCost = (item: any): number => item.unit_price_cents;
  const getItemMarkup = (itemId: string) => itemMarkups[itemId] ?? globalMarkup;
  const getQuotePrice = (item: any): number => Math.round(item.unit_price_cents * (1 + getItemMarkup(item.id ?? '') / 100));

  const lineItems = quote?.line_items ?? [];
  const computedSubtotal = lineItems.reduce((sum: number, item: any) => sum + getQuotePrice(item), 0);
  const computedInstall = Math.round(computedSubtotal * installPercent / 100);
  const computedTotal = computedSubtotal + computedInstall;

  const filteredCustomers = customers.filter(c =>
    customerFullName(c).toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.email ?? '').toLowerCase().includes(customerSearch.toLowerCase())
  );

  const openPDFOptions = () => { if (!canExportPDF) { setShowPDFGate(true); return; } setShowPDFOptions(true); };

  const handleExportPDF = async () => {
    if (!quote) return;
    setShowPDFOptions(false);
    setExportingPDF(true);
    try {
      const res = await fetch(`${API_BASE}/api/quotes/${quote.id}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealerId: dealer?.id,
          subtotalCents: computedSubtotal,
          installCents: computedInstall,
          totalCents: computedTotal,
          showMeasurements,
          showMarkup,
          lineItems: lineItems.map((item: any) => ({
            ...item,
            quotePriceCents: getQuotePrice(item),
            markupPercent: getItemMarkup(item.id ?? ''),
          })),
        }),
      });
      if (!res.ok) throw new Error(`PDF generation failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${quote.quote_number ?? 'quote'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      Alert.alert('Export failed', e.message ?? 'Could not generate PDF.');
    } finally {
      setExportingPDF(false);
    }
  };

  const handleCreateQuote = async () => {
    if (!dealer) return;
    if (!selectedCustomer && !newCustomerFirstName.trim()) { Alert.alert('Customer required', 'Select or create a customer first.'); return; }
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

  const handleRemoveLineItem = async (lineItemId: string) => {
    if (!quote) return;
    setSaving(true);
    try {
      await quotesService.removeLineItem(quote.id, lineItemId);
      const updated = await quotesService.getQuote(quote.id);
      setQuote(updated);
      setItemMarkups(prev => { const n = { ...prev }; delete n[lineItemId]; return n; });
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

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const PDFButton = ({ full = false }: { full?: boolean }) => (
    <TouchableOpacity
      style={[styles.pdfBtn, full && styles.pdfBtnFull, canExportPDF ? { borderColor: brandColor + '66', backgroundColor: brandColor + '18' } : styles.pdfBtnLocked]}
      onPress={openPDFOptions}
      disabled={exportingPDF}
    >
      {exportingPDF
        ? <ActivityIndicator color={canExportPDF ? brandColor : 'rgba(255,255,255,0.3)'} size="small" />
        : <View style={styles.pdfBtnInner}>
            <Text style={[styles.pdfBtnText, { color: canExportPDF ? brandColor : 'rgba(255,255,255,0.35)' }]}>
              {canExportPDF ? '📄 Export PDF' : '🔒 Export PDF'}
            </Text>
            {!canExportPDF && <View style={styles.pdfProPill}><Text style={styles.pdfProPillText}>PRO</Text></View>}
          </View>
      }
    </TouchableOpacity>
  );

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={brandColor} size="large" /></View>;
  }

  return (
    <View style={styles.container}>

      {/* PDF Gate Modal */}
      <Modal visible={showPDFGate} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.gateCard}>
            <Text style={styles.gateEmoji}>📄</Text>
            <Text style={styles.gateTitle}>PDF Export is a Pro Feature</Text>
            <Text style={styles.gateDesc}>Export polished, branded quote PDFs to share with customers.</Text>
            <TouchableOpacity style={[styles.upgradeBtn, { backgroundColor: brandColor }]} onPress={() => { setShowPDFGate(false); navigation.navigate('Settings'); }}>
              <Text style={styles.upgradeBtnText}>Upgrade to Pro →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.gateDismissBtn} onPress={() => setShowPDFGate(false)}>
              <Text style={styles.gateDismissText}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PDF Options Modal */}
      <Modal visible={showPDFOptions} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Export Options</Text>
            <TouchableOpacity onPress={() => setShowPDFOptions(false)}><Text style={[styles.modalClose, { color: brandColor }]}>Cancel</Text></TouchableOpacity>
          </View>
          <View style={styles.optionsBody}>
            <View style={styles.optionRow}>
              <View style={styles.optionRowText}>
                <Text style={styles.optionRowTitle}>Show measurements</Text>
                <Text style={styles.optionRowDesc}>Display width × height on each line item</Text>
              </View>
              <Switch value={showMeasurements} onValueChange={setShowMeasurements} trackColor={{ false: 'rgba(255,255,255,0.1)', true: brandColor + '88' }} thumbColor={showMeasurements ? brandColor : 'rgba(255,255,255,0.4)'} />
            </View>
            <View style={styles.optionDivider} />
            <View style={styles.optionRow}>
              <View style={styles.optionRowText}>
                <Text style={styles.optionRowTitle}>Show markup %</Text>
                <Text style={styles.optionRowDesc}>Display markup percentage next to each price</Text>
              </View>
              <Switch value={showMarkup} onValueChange={setShowMarkup} trackColor={{ false: 'rgba(255,255,255,0.1)', true: brandColor + '88' }} thumbColor={showMarkup ? brandColor : 'rgba(255,255,255,0.4)'} />
            </View>
            <TouchableOpacity style={[styles.generateBtn, { backgroundColor: brandColor }]} onPress={handleExportPDF}>
              <Text style={styles.generateBtnText}>Generate PDF →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Voice Modal */}
      <Modal visible={voiceModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Measure Window</Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setVoiceModalVisible(false)}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.voiceContent}>
            {voiceState === 'idle' && (
              <>
                <Text style={styles.voiceHint}>Say the window name and dimensions</Text>
                <Text style={styles.voiceExample}>"Master center, 36 and a half wide by 48 tall, inside mount"</Text>
                <TouchableOpacity
                  style={[styles.autoSaveToggle, autoSave && { backgroundColor: brandColor + '22', borderColor: brandColor }]}
                  onPress={() => setAutoSave(prev => !prev)}
                >
                  <View style={[styles.autoSaveIndicator, { backgroundColor: autoSave ? brandColor : 'rgba(255,255,255,0.2)' }]} />
                  <Text style={[styles.autoSaveText, autoSave && { color: 'white' }]}>
                    {autoSave ? 'Auto-saving on' : 'Auto-save (skip confirm)'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.micBtn, { backgroundColor: brandColor }]} onPress={startRecording}>
                  <Text style={styles.micIcon}>🎙</Text>
                </TouchableOpacity>
                <Text style={styles.micLabel}>Tap to speak</Text>
                <TouchableOpacity onPress={openManual}>
                  <Text style={styles.manualLink}>Enter manually instead</Text>
                </TouchableOpacity>
              </>
            )}
            {voiceState === 'recording' && (
              <>
                <Text style={styles.voiceHint}>Listening...</Text>
                <TouchableOpacity style={[styles.micBtn, styles.micBtnRecording]} onPress={stopRecording}>
                  <Text style={styles.micIcon}>⏹</Text>
                </TouchableOpacity>
                <Text style={styles.micLabel}>Stop talking to submit</Text>
              </>
            )}
            {voiceState === 'processing' && (
              <>
                <ActivityIndicator color={brandColor} size="large" style={{ marginBottom: 16 }} />
                <Text style={styles.voiceHint}>Parsing measurement...</Text>
                {transcript ? <Text style={styles.transcriptText}>"{transcript}"</Text> : null}
              </>
            )}
            {voiceState === 'confirm' && parsed && (
              <>
                <Text style={styles.voiceHint}>Does this look right?</Text>
                {transcript ? <Text style={styles.transcriptText}>"{transcript}"</Text> : null}
                <View style={styles.confirmCard}>
                  <View style={styles.confirmRow}><Text style={styles.confirmFieldLabel}>LABEL</Text><Text style={styles.confirmFieldValue}>{parsed.label}</Text></View>
                  <View style={styles.confirmDivider} />
                  <View style={styles.confirmRow}><Text style={styles.confirmFieldLabel}>WIDTH</Text><Text style={styles.confirmFieldValue}>{parsed.width_inches}"</Text></View>
                  <View style={styles.confirmDivider} />
                  <View style={styles.confirmRow}><Text style={styles.confirmFieldLabel}>HEIGHT</Text><Text style={styles.confirmFieldValue}>{parsed.height_inches}"</Text></View>
                  <View style={styles.confirmDivider} />
                  <View style={styles.confirmRow}><Text style={styles.confirmFieldLabel}>MOUNT</Text><Text style={styles.confirmFieldValue}>{parsed.mount_type === 'inside' ? 'Inside' : 'Outside'} Mount</Text></View>
                </View>
                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: brandColor }]} onPress={() => saveVoiceMeasurement()}>
                  <Text style={styles.saveBtnText}>Add to Quote</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editBtn} onPress={editVoiceInManual}>
                  <Text style={styles.editBtnText}>Edit before saving</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setVoiceState('idle')} style={{ marginTop: 8 }}>
                  <Text style={styles.manualLink}>Try again</Text>
                </TouchableOpacity>
              </>
            )}
            {voiceState === 'error' && (
              <>
                <Text style={styles.voiceError}>{voiceError}</Text>
                <TouchableOpacity style={[styles.micBtn, { backgroundColor: brandColor }]} onPress={() => setVoiceState('idle')}>
                  <Text style={styles.micIcon}>🎙</Text>
                </TouchableOpacity>
                <Text style={styles.micLabel}>Try again</Text>
                <TouchableOpacity onPress={openManual}>
                  <Text style={styles.manualLink}>Enter manually instead</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Manual Entry Modal */}
      <Modal visible={manualVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Enter Manually</Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setManualVisible(false)}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <View>
              <Text style={styles.fieldLabel}>WINDOW LABEL</Text>
              <TextInput style={styles.textInput} value={manualLabel} onChangeText={setManualLabel} placeholder="e.g. Master Center" placeholderTextColor="rgba(255,255,255,0.25)" />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>WIDTH (inches)</Text>
                <TextInput style={styles.textInput} value={manualWidth} onChangeText={setManualWidth} placeholder="36.5" placeholderTextColor="rgba(255,255,255,0.25)" keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>HEIGHT (inches)</Text>
                <TextInput style={styles.textInput} value={manualHeight} onChangeText={setManualHeight} placeholder="48" placeholderTextColor="rgba(255,255,255,0.25)" keyboardType="decimal-pad" />
              </View>
            </View>
            <View>
              <Text style={styles.fieldLabel}>MOUNT TYPE</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={[styles.mountToggle, manualMount === 'inside' && { backgroundColor: brandColor, borderColor: brandColor }]} onPress={() => setManualMount('inside')}>
                  <Text style={[styles.mountToggleText, manualMount === 'inside' && { color: 'white' }]}>Inside</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.mountToggle, manualMount === 'outside' && { backgroundColor: brandColor, borderColor: brandColor }]} onPress={() => setManualMount('outside')}>
                  <Text style={[styles.mountToggleText, manualMount === 'outside' && { color: 'white' }]}>Outside</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: (!manualWidth || !manualHeight) ? 'rgba(255,255,255,0.1)' : brandColor, marginTop: 8 }]}
              onPress={saveManual}
              disabled={!manualWidth || !manualHeight || manualSaving}
            >
              {manualSaving ? <ActivityIndicator color="white" /> : <Text style={styles.saveBtnText}>Add to Quote</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{quote ? quote.quote_number : 'New Quote'}</Text>
        {quote && (
          <View style={[styles.statusBadge, { backgroundColor: quote.status === 'sent' ? brandColor + '26' : 'rgba(255,255,255,0.08)', borderColor: quote.status === 'sent' ? brandColor : 'rgba(255,255,255,0.15)' }]}>
            <Text style={[styles.statusText, { color: quote.status === 'sent' ? brandColor : 'rgba(255,255,255,0.5)' }]}>{quote.status.toUpperCase()}</Text>
          </View>
        )}
      </View>

      {windowToast ? <View style={styles.toast}><Text style={styles.toastText}>{windowToast}</Text></View> : null}

      <ScrollView contentContainerStyle={styles.content}>

        {/* Customer section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Customer</Text>
          {selectedCustomer && !isNewCustomer ? (
            <View style={[styles.selectedCustomer, { borderColor: brandColor + '4D' }]}>
              <View>
                <Text style={styles.selectedCustomerName}>{customerFullName(selectedCustomer)}</Text>
                <Text style={styles.selectedCustomerSub}>{selectedCustomer.email ?? selectedCustomer.phone ?? ''}</Text>
              </View>
              {!quote && <TouchableOpacity onPress={() => setSelectedCustomer(null)}><Text style={[styles.changeText, { color: brandColor }]}>Change</Text></TouchableOpacity>}
            </View>
          ) : !quote ? (
            <View style={styles.section}>
              <View style={styles.tabRow}>
                <TouchableOpacity style={[styles.tab, !isNewCustomer && { backgroundColor: brandColor + '26', borderWidth: 1, borderColor: brandColor }]} onPress={() => setIsNewCustomer(false)}>
                  <Text style={[styles.tabText, !isNewCustomer && { color: brandColor }]}>Existing</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, isNewCustomer && { backgroundColor: brandColor + '26', borderWidth: 1, borderColor: brandColor }]} onPress={() => setIsNewCustomer(true)}>
                  <Text style={[styles.tabText, isNewCustomer && { color: brandColor }]}>New Customer</Text>
                </TouchableOpacity>
              </View>
              {!isNewCustomer ? (
                <View>
                  <TextInput value={customerSearch} onChangeText={setCustomerSearch} style={styles.textInput} placeholder="Search customers..." placeholderTextColor="rgba(255,255,255,0.25)" />
                  {filteredCustomers.slice(0, 5).map(c => (
                    <TouchableOpacity key={c.id} style={styles.customerOption} onPress={() => setSelectedCustomer(c)}>
                      <Text style={styles.customerOptionName}>{customerFullName(c)}</Text>
                      <Text style={styles.customerOptionSub}>{c.email ?? c.phone ?? ''}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.formFields}>
                  {([['First Name *', newCustomerFirstName, setNewCustomerFirstName], ['Last Name', newCustomerLastName, setNewCustomerLastName], ['Email', newCustomerEmail, setNewCustomerEmail], ['Phone', newCustomerPhone, setNewCustomerPhone], ['Address', newCustomerAddress, setNewCustomerAddress]] as const).map(([label, value, setter]: any) => (
                    <View key={label}>
                      <Text style={styles.fieldLabel}>{label}</Text>
                      <TextInput value={value} onChangeText={setter} style={styles.textInput} placeholderTextColor="rgba(255,255,255,0.25)" placeholder={label} />
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : null}
        </View>

        {/* Windows section */}
        {quote && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>{cap(tenantConfig.product_noun_plural)}</Text>
              <TouchableOpacity style={[styles.addWindowBtn, { backgroundColor: brandColor + '26', borderColor: brandColor + '4D' }]} onPress={openVoiceModal}>
                <Text style={[styles.addWindowBtnText, { color: brandColor }]}>🎙 Measure Window</Text>
              </TouchableOpacity>
            </View>

            {lineItems.length === 0 ? (
              <View style={styles.emptyWindows}>
                <Text style={styles.emptyWindowsText}>No windows added yet.</Text>
                <Text style={styles.emptyWindowsHint}>Tap "Measure Window" to add your first measurement.</Text>
              </View>
            ) : (
              lineItems.map((item: any) => {
                const itemId = item.id ?? '';
                const markup = getItemMarkup(itemId);
                const costCents = getLineDealerCost(item);
                const quotePriceCents = getQuotePrice(item);
                const hasProduct = item.unit_price_cents > 0;
                return (
                  <View key={itemId} style={styles.lineItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lineItemName}>{item.product_name ?? item.description ?? cap(tenantConfig.product_noun)}</Text>
                      {item.width_in && item.height_in && (
                        <Text style={styles.lineItemSub}>{item.width_in}" × {item.height_in}"</Text>
                      )}
                      {!hasProduct && (
                        <Text style={styles.noProductHint}>No product assigned · $0</Text>
                      )}
                      {hasProduct && (
                        <View style={styles.itemMarginRow}>
                          <Text style={styles.itemMarginLabel}>Markup:</Text>
                          <TouchableOpacity style={styles.itemMarginBtn} onPress={() => setItemMarkups(p => ({ ...p, [itemId]: Math.max(0, markup - 5) }))}>
                            <Text style={styles.marginBtnText}>−</Text>
                          </TouchableOpacity>
                          <Text style={[styles.itemMarginVal, { color: brandColor }]}>{markup}%</Text>
                          <TouchableOpacity style={styles.itemMarginBtn} onPress={() => setItemMarkups(p => ({ ...p, [itemId]: Math.min(200, markup + 5) }))}>
                            <Text style={styles.marginBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      <TouchableOpacity onPress={() => handleRemoveLineItem(itemId)}>
                        <Text style={styles.removeText}>remove</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.lineItemPriceCol}>
                      <Text style={styles.lineItemPrice}>{hasProduct ? `$${(quotePriceCents / 100).toFixed(0)}` : '—'}</Text>
                      {hasProduct && <Text style={styles.lineItemBase}>cost ${(costCents / 100).toFixed(0)}</Text>}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* Markup / Install controls */}
        {quote && lineItems.some((i: any) => i.unit_price_cents > 0) && (
          <View style={styles.marginCard}>
            <View style={styles.marginRow}>
              <View style={styles.marginField}>
                <Text style={styles.marginLabel}>Global Markup %</Text>
                <View style={styles.marginInputRow}>
                  <TouchableOpacity style={styles.marginBtn} onPress={() => { setGlobalMarkup(m => Math.max(0, m - 5)); setItemMarkups({}); }}><Text style={styles.marginBtnText}>−</Text></TouchableOpacity>
                  <TextInput value={String(globalMarkup)} onChangeText={v => { const n = parseInt(v.replace(/[^0-9]/g, '')) || 0; setGlobalMarkup(Math.min(200, Math.max(0, n))); setItemMarkups({}); }} style={styles.marginInput} keyboardType="numeric" selectTextOnFocus />
                  <TouchableOpacity style={styles.marginBtn} onPress={() => { setGlobalMarkup(m => Math.min(200, m + 5)); setItemMarkups({}); }}><Text style={styles.marginBtnText}>+</Text></TouchableOpacity>
                </View>
              </View>
              <View style={styles.marginField}>
                <Text style={styles.marginLabel}>Install %</Text>
                <View style={styles.marginInputRow}>
                  <TouchableOpacity style={styles.marginBtn} onPress={() => setInstallPercent(p => Math.max(0, p - 5))}><Text style={styles.marginBtnText}>−</Text></TouchableOpacity>
                  <TextInput value={String(installPercent)} onChangeText={v => { const n = parseInt(v.replace(/[^0-9]/g, '')) || 0; setInstallPercent(Math.min(100, Math.max(0, n))); }} style={styles.marginInput} keyboardType="numeric" selectTextOnFocus />
                  <TouchableOpacity style={styles.marginBtn} onPress={() => setInstallPercent(p => Math.min(100, p + 5))}><Text style={styles.marginBtnText}>+</Text></TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Totals */}
        {quote && lineItems.some((i: any) => i.unit_price_cents > 0) && (
          <View style={styles.totalsCard}>
            {lineItems.filter((i: any) => i.unit_price_cents > 0).map((item: any) => (
              <View key={item.id} style={styles.totalRow}>
                <Text style={styles.totalLabel} numberOfLines={1}>{(item.product_name ?? item.description ?? cap(tenantConfig.product_noun)).split('—').pop()?.trim()}</Text>
                <View style={styles.totalValGroup}>
                  <Text style={styles.totalCost}>cost ${(getLineDealerCost(item) / 100).toFixed(0)}</Text>
                  <Text style={styles.totalVal}>${(getQuotePrice(item) / 100).toFixed(0)}</Text>
                </View>
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalVal}>${(computedSubtotal / 100).toFixed(0)}</Text></View>
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Installation ({installPercent}%)</Text><Text style={styles.totalVal}>${(computedInstall / 100).toFixed(0)}</Text></View>
            <View style={styles.divider} />
            <View style={styles.totalRow}><Text style={styles.grandTotalLabel}>Total</Text><Text style={[styles.grandTotalVal, { color: brandColor }]}>${(computedTotal / 100).toFixed(0)}</Text></View>
          </View>
        )}

        {/* Notes */}
        {!quote && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notes (optional)</Text>
            <TextInput value={notes} onChangeText={setNotes} style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]} multiline placeholder="Any special notes..." placeholderTextColor="rgba(255,255,255,0.25)" />
          </View>
        )}

        {/* Actions */}
        {!quote ? (
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: brandColor }, saving && styles.btnDisabled]} onPress={handleCreateQuote} disabled={saving}>
            {saving ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.primaryBtnText}>Create Quote</Text>}
          </TouchableOpacity>
        ) : quote.status === 'draft' ? (
          <View style={styles.btnRow}>
            <PDFButton />
            <TouchableOpacity style={[styles.primaryBtn, { flex: 1, backgroundColor: brandColor }, sending && styles.btnDisabled]} onPress={handleSend} disabled={sending}>
              {sending ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.primaryBtnText}>Send to Customer →</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <PDFButton full />
            {(() => {
              const ps = (quote as any).payment_status ?? 'unpaid';
              const isPaid = ps === 'deposit_paid' || ps === 'paid_in_full';
              return (
                <>
                  <TouchableOpacity
                    style={[styles.paymentBtn, isPaid ? { backgroundColor: 'rgba(48,209,88,0.1)', borderColor: 'rgba(48,209,88,0.3)' } : { backgroundColor: brandColor + '18', borderColor: brandColor + '66' }]}
                    onPress={() => navigation.navigate('Payment', { quoteId: quote.id, quoteNumber: quote.quote_number, totalCents: computedTotal, depositCents: Math.round(computedTotal * 0.5), paymentStatus: ps })}
                  >
                    <Text style={[styles.paymentBtnText, { color: isPaid ? '#30D158' : brandColor }]}>{isPaid ? `💰 ${PAYMENT_STATUS_LABELS[ps]}` : '💳 Collect Payment'}</Text>
                    {!isPaid && <Text style={[styles.paymentBtnSub, { color: brandColor + 'AA' }]}>50% deposit · ${(Math.round(computedTotal * 0.5) / 100).toFixed(2)}</Text>}
                  </TouchableOpacity>
                  <View style={styles.sentStatusCard}>
                    <Text style={styles.sentStatusText}>{quote.status === 'approved' ? '✅ Customer approved this quote' : `Quote is ${quote.status}`}</Text>
                  </View>
                </>
              );
            })()}
          </>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0F1A' },
  centered: { flex: 1, backgroundColor: '#0A0F1A', alignItems: 'center', justifyContent: 'center' },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: 'white', fontSize: 24, lineHeight: 30 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: '800', flex: 1 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  content: { padding: 20, gap: 20, paddingBottom: 40 },
  toast: { backgroundColor: '#30D158', marginHorizontal: 16, borderRadius: 12, padding: 12, alignItems: 'center' },
  toastText: { color: 'white', fontWeight: '700', fontSize: 13 },
  section: { gap: 10 },
  sectionLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addWindowBtn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  addWindowBtnText: { fontWeight: '700', fontSize: 13 },
  selectedCustomer: { backgroundColor: '#111827', borderRadius: 14, borderWidth: 1, padding: 14, flexDirection: 'row', justifyContent: 'space-between' },
  selectedCustomerName: { color: 'white', fontWeight: '700', fontSize: 15 },
  selectedCustomerSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  changeText: { fontWeight: '600', fontSize: 13 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center' },
  tabText: { color: 'rgba(255,255,255,0.4)', fontWeight: '600', fontSize: 13 },
  formFields: { gap: 10 },
  fieldLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 4 },
  textInput: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, color: 'white', fontSize: 15, padding: 12 },
  customerOption: { backgroundColor: '#111827', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 12, marginTop: 6 },
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
  noProductHint: { color: 'rgba(255,165,0,0.7)', fontSize: 11, marginTop: 3 },
  itemMarginRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  itemMarginLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 11 },
  itemMarginBtn: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  itemMarginVal: { fontWeight: '700', fontSize: 12, minWidth: 32, textAlign: 'center' },
  removeText: { color: 'rgba(255,69,58,0.7)', fontSize: 10, fontWeight: '600', marginTop: 4 },
  marginCard: { backgroundColor: '#111827', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', padding: 16, gap: 12 },
  marginRow: { flexDirection: 'column', gap: 12 },
  marginField: { flex: 1, gap: 6 },
  marginLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600' },
  marginInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  marginBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  marginBtnText: { color: 'white', fontSize: 16, fontWeight: '600', lineHeight: 20 },
  marginInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, color: 'white', fontSize: 15, padding: 6, textAlign: 'center' },
  totalsCard: { backgroundColor: '#111827', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', padding: 16, gap: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 13, flex: 1, marginRight: 8 },
  totalValGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  totalCost: { color: 'rgba(255,255,255,0.2)', fontSize: 11 },
  totalVal: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 4 },
  grandTotalLabel: { color: 'white', fontWeight: '700', fontSize: 16 },
  grandTotalVal: { fontWeight: '800', fontSize: 22 },
  btnRow: { flexDirection: 'row', gap: 10 },
  pdfBtn: { borderRadius: 14, paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  pdfBtnFull: { marginBottom: 10 },
  pdfBtnLocked: { borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)' },
  pdfBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pdfBtnText: { fontWeight: '700', fontSize: 14 },
  pdfProPill: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  pdfProPillText: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  primaryBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
  sentStatusCard: { backgroundColor: 'rgba(48,209,88,0.08)', borderWidth: 1, borderColor: 'rgba(48,209,88,0.2)', borderRadius: 14, padding: 16, alignItems: 'center' },
  sentStatusText: { color: '#30D158', fontWeight: '600', fontSize: 14 },
  optionsBody: { padding: 24, gap: 20 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  optionRowText: { flex: 1, gap: 4 },
  optionRowTitle: { color: 'white', fontWeight: '600', fontSize: 15 },
  optionRowDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 18 },
  optionDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  generateBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  generateBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  gateCard: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  gateEmoji: { fontSize: 64 },
  gateTitle: { color: 'white', fontSize: 24, fontWeight: '800', textAlign: 'center' },
  gateDesc: { color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 22, textAlign: 'center', maxWidth: 300 },
  upgradeBtn: { width: '100%', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  upgradeBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  gateDismissBtn: { paddingVertical: 12 },
  gateDismissText: { color: 'rgba(255,255,255,0.3)', fontSize: 14 },
  modalContainer: { flex: 1, backgroundColor: '#0A0F1A' },
  modalHeader: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  modalTitle: { color: 'white', fontSize: 20, fontWeight: '800', flex: 1 },
  modalClose: { fontSize: 16, fontWeight: '600' },
  modalCloseBtn: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  voiceContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  voiceHint: { color: 'white', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  voiceExample: { color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', lineHeight: 20, fontStyle: 'italic' },
  voiceError: { color: '#FF453A', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  micBtn: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  micBtnRecording: { backgroundColor: '#FF453A' },
  micIcon: { fontSize: 40 },
  micLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  manualLink: { color: 'rgba(255,255,255,0.35)', fontSize: 13, textDecorationLine: 'underline', marginTop: 4 },
  transcriptText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontStyle: 'italic', textAlign: 'center' },
  autoSaveToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)' },
  autoSaveIndicator: { width: 10, height: 10, borderRadius: 5 },
  autoSaveText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600' },
  confirmCard: { width: '100%', backgroundColor: '#111827', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  confirmDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 16 },
  confirmFieldLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  confirmFieldValue: { color: 'white', fontSize: 16, fontWeight: '700' },
  saveBtn: { width: '100%', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { color: 'white', fontWeight: '800', fontSize: 16 },
  editBtn: { width: '100%', borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  editBtnText: { color: 'rgba(255,255,255,0.6)', fontWeight: '600', fontSize: 14 },
  mountToggle: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  mountToggleText: { color: 'rgba(255,255,255,0.5)', fontWeight: '700', fontSize: 15 },
  paymentBtn: { borderRadius: 14, paddingVertical: 16, paddingHorizontal: 18, borderWidth: 1, alignItems: 'center', gap: 4 },
  paymentBtnText: { fontWeight: '700', fontSize: 15 },
  paymentBtnSub: { fontSize: 12, fontWeight: '500' },
});