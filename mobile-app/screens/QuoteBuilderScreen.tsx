import React, { useState, useEffect } from 'react';
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
import { quotesService, customersService, roomsService } from '../lib/supabase';
import type { Quote, Customer } from '../lib/supabase';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const DEFAULT_MARKUP  = 40;
const DEFAULT_INSTALL = 15;
const API_BASE        = 'https://windowfit-production.up.railway.app';

// ─── PRICING TYPES ────────────────────────────────────────────────────────────

interface PricingDefault {
  category: string;
  cost_multiplier: number;
  markup_percent: number;
}

interface PricingOverride {
  product_id: string;
  cost_multiplier: number | null;
  markup_percent: number | null;
  custom_price_cents: number | null;
}

interface DealerPricing {
  defaults: PricingDefault[];
  overrides: PricingOverride[];
}

// ─── PRICING ENGINE ───────────────────────────────────────────────────────────

function computeDealerPrice(
  product: any,
  pricing: DealerPricing
): { dealerCostCents: number; quotePriceCents: number; markupPercent: number } {
  const msrp = product.msrp_cents ?? product.base_price_cents ?? 0;

  const override = pricing.overrides.find(o => o.product_id === product.id);

  if (override?.custom_price_cents != null) {
    return {
      dealerCostCents: override.custom_price_cents,
      quotePriceCents: override.custom_price_cents,
      markupPercent: 0,
    };
  }

  const categoryDefault = pricing.defaults.find(d => d.category === product.category);

  const costMultiplier =
    override?.cost_multiplier ?? categoryDefault?.cost_multiplier ?? 0.31;

  const markupPercent =
    override?.markup_percent ?? categoryDefault?.markup_percent ?? DEFAULT_MARKUP;

  const dealerCostCents = Math.round(msrp * costMultiplier);
  const quotePriceCents = Math.round(dealerCostCents * (1 + markupPercent / 100));

  return { dealerCostCents, quotePriceCents, markupPercent };
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function QuoteBuilderScreen({ route, navigation }: any) {
  const { quoteId } = route.params ?? {};
  const { dealer } = useAuth();
  const { tenantConfig } = useTenant();
  const { tier, canExportPDF } = usePlanGating();

  const [quote, setQuote]         = useState<Quote | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rooms, setRooms]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(!!quoteId);
  const [saving, setSaving]       = useState(false);
  const [sending, setSending]     = useState(false);

  // PDF state
  const [showPDFGate, setShowPDFGate]           = useState(false);
  const [showPDFOptions, setShowPDFOptions]     = useState(false);
  const [exportingPDF, setExportingPDF]         = useState(false);
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [showMarkup, setShowMarkup]             = useState(false);

  const [dealerPricing, setDealerPricing] = useState<DealerPricing>({ defaults: [], overrides: [] });
  const [pricingLoaded, setPricingLoaded] = useState(false);

  const [customerSearch, setCustomerSearch]             = useState('');
  const [selectedCustomer, setSelectedCustomer]         = useState<Customer | null>(null);
  const [newCustomerFirstName, setNewCustomerFirstName] = useState('');
  const [newCustomerLastName, setNewCustomerLastName]   = useState('');
  const [newCustomerEmail, setNewCustomerEmail]         = useState('');
  const [newCustomerPhone, setNewCustomerPhone]         = useState('');
  const [newCustomerAddress, setNewCustomerAddress]     = useState('');
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [notes, setNotes]                 = useState('');

  const [globalMarkup, setGlobalMarkup]     = useState(DEFAULT_MARKUP);
  const [installPercent, setInstallPercent] = useState(DEFAULT_INSTALL);
  const [itemMarkups, setItemMarkups]       = useState<Record<string, number>>({});

  const [showWindowPicker, setShowWindowPicker] = useState(false);
  const [addedWindowIds, setAddedWindowIds]     = useState<Set<string>>(new Set());

  const brandColor = tenantConfig.primary_color;

  // ── Init ──────────────────────────────────────────────────────────────────

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
        const ids = new Set<string>(
          (q.line_items ?? []).map((li: any) => li.window_id).filter(Boolean)
        );
        setAddedWindowIds(ids);
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
      setDealerPricing({
        defaults: json.defaults ?? [],
        overrides: json.overrides ?? [],
      });
      if (json.defaults?.length > 0) {
        setGlobalMarkup(Math.round(json.defaults[0].markup_percent));
      }
    } catch (e) {
      console.warn('Could not load dealer pricing, using defaults:', e);
    } finally {
      setPricingLoaded(true);
    }
  };

  // ── Pricing helpers ───────────────────────────────────────────────────────

  const getLineDealerCost = (item: any): number => item.unit_price_cents;
  const getItemMarkup     = (itemId: string) => itemMarkups[itemId] ?? globalMarkup;
  const getQuotePrice     = (item: any): number =>
    Math.round(item.unit_price_cents * (1 + getItemMarkup(item.id ?? '') / 100));
  const getPickerPrice    = (product: any): number => {
    if (!pricingLoaded || (dealerPricing.defaults.length === 0 && dealerPricing.overrides.length === 0)) {
      return product.base_price_cents ?? 0;
    }
    return computeDealerPrice(product, dealerPricing).quotePriceCents;
  };

  // ── Computed totals ───────────────────────────────────────────────────────

  const lineItems = quote?.line_items ?? [];

  const computedSubtotal = lineItems.reduce(
    (sum: number, item: any) => sum + getQuotePrice(item), 0
  );
  const computedInstall = Math.round(computedSubtotal * installPercent / 100);
  const computedTotal   = computedSubtotal + computedInstall;

  // ── Customer helpers ──────────────────────────────────────────────────────

  const filteredCustomers = customers.filter(c =>
    customerFullName(c).toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.email ?? '').toLowerCase().includes(customerSearch.toLowerCase())
  );

  // ── PDF Export ────────────────────────────────────────────────────────────

  const openPDFOptions = () => {
    if (!canExportPDF) { setShowPDFGate(true); return; }
    setShowPDFOptions(true);
  };

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
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${quote.quote_number ?? 'quote'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      Alert.alert('Export failed', e.message ?? 'Could not generate PDF. Please try again.');
    } finally {
      setExportingPDF(false);
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

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
      Alert.alert(
        'No product assigned',
        `Assign a product to this ${tenantConfig.product_noun} in the Rooms screen first.`
      );
      return;
    }

    const { dealerCostCents, markupPercent } = pricingLoaded
      ? computeDealerPrice(window.product, dealerPricing)
      : { dealerCostCents: window.product.base_price_cents ?? 0, markupPercent: DEFAULT_MARKUP };

    setSaving(true);
    try {
      await quotesService.addLineItem(quote.id, {
        window_id: window.id,
        product_id: window.product.id,
        description: `${cap(tenantConfig.product_noun_plural)} — ${window.product.name}`,
        width_in: window.width_in,
        height_in: window.height_in,
        unit_price_cents: dealerCostCents,
        quantity: 1,
      });

      const updated = await quotesService.getQuote(quote.id);
      setQuote(updated);
      setAddedWindowIds(prev => new Set([...prev, window.id]));

      const newItem = (updated.line_items ?? []).find(
        (li: any) => li.window_id === window.id
      );
      if (newItem?.id) {
        setItemMarkups(prev => ({ ...prev, [newItem.id]: Math.round(markupPercent) }));
      }

    } catch (e: any) {
      Alert.alert(`Failed to add ${tenantConfig.product_noun}`, e.message);
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
      setItemMarkups(prev => { const n = { ...prev }; delete n[lineItemId]; return n; });
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

  // ── Derived data ──────────────────────────────────────────────────────────

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const allWindows          = rooms.flatMap((r: any) =>
    (r.windows ?? []).map((w: any) => ({ ...w, roomName: r.name }))
  );
  const windowsWithProducts = allWindows.filter((w: any) => w.product);
  const windowsAvailable    = windowsWithProducts.filter((w: any) => !addedWindowIds.has(w.id));

  // ── PDF button (reusable) ─────────────────────────────────────────────────

  const PDFButton = ({ full = false }: { full?: boolean }) => (
    <TouchableOpacity
      style={[
        styles.pdfBtn,
        full && styles.pdfBtnFull,
        canExportPDF
          ? { borderColor: brandColor + '66', backgroundColor: brandColor + '18' }
          : styles.pdfBtnLocked,
      ]}
      onPress={openPDFOptions}
      disabled={exportingPDF}
    >
      {exportingPDF
        ? <ActivityIndicator color={canExportPDF ? brandColor : 'rgba(255,255,255,0.3)'} size="small" />
        : (
          <View style={styles.pdfBtnInner}>
            <Text style={[
              styles.pdfBtnText,
              { color: canExportPDF ? brandColor : 'rgba(255,255,255,0.35)' },
            ]}>
              {canExportPDF ? '📄 Export PDF' : '🔒 Export PDF'}
            </Text>
            {!canExportPDF && (
              <View style={styles.pdfProPill}>
                <Text style={styles.pdfProPillText}>PRO</Text>
              </View>
            )}
          </View>
        )
      }
    </TouchableOpacity>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={brandColor} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* ── PDF Gate Wall Modal ───────────────────────────────────────── */}
      <Modal visible={showPDFGate} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.gateCard}>
            <Text style={styles.gateEmoji}>📄</Text>
            <Text style={styles.gateTitle}>PDF Export is a Pro Feature</Text>
            <Text style={styles.gateDesc}>
              Export polished, branded quote PDFs to share with customers.
              Upgrade to Pro to unlock PDF export, in-app payments, and unlimited scans.
            </Text>
            <View style={styles.featureList}>
              {[
                'PDF quote export',
                'In-app payment processing',
                'Unlimited scans',
                'Full product catalog',
              ].map(label => (
                <View key={label} style={styles.featureRow}>
                  <Text style={[styles.featureCheck, { color: brandColor }]}>✓</Text>
                  <Text style={styles.featureLabel}>{label}</Text>
                  <View style={[styles.proBadge, { backgroundColor: brandColor + '22', borderColor: brandColor + '55' }]}>
                    <Text style={[styles.proBadgeText, { color: brandColor }]}>PRO</Text>
                  </View>
                </View>
              ))}
            </View>
            <View style={[styles.currentPlanBadge, { backgroundColor: brandColor + '22', borderColor: brandColor + '55' }]}>
              <Text style={[styles.currentPlanText, { color: brandColor }]}>
                Current plan: {tier.toUpperCase()}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.upgradeBtn, { backgroundColor: brandColor }]}
              onPress={() => { setShowPDFGate(false); navigation.navigate('Settings'); }}
            >
              <Text style={styles.upgradeBtnText}>Upgrade to Pro →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.gateDismissBtn} onPress={() => setShowPDFGate(false)}>
              <Text style={styles.gateDismissText}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── PDF Options Modal ─────────────────────────────────────────── */}
      <Modal visible={showPDFOptions} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Export Options</Text>
            <TouchableOpacity onPress={() => setShowPDFOptions(false)}>
              <Text style={[styles.modalClose, { color: brandColor }]}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.optionsBody}>
            <Text style={styles.optionsHint}>
              Configure what appears on the customer-facing PDF. Measurements and markup are hidden by default.
            </Text>

            <View style={styles.optionRow}>
              <View style={styles.optionRowText}>
                <Text style={styles.optionRowTitle}>Show measurements</Text>
                <Text style={styles.optionRowDesc}>
                  Display width × height dimensions on each line item
                </Text>
              </View>
              <Switch
                value={showMeasurements}
                onValueChange={setShowMeasurements}
                trackColor={{ false: 'rgba(255,255,255,0.1)', true: brandColor + '88' }}
                thumbColor={showMeasurements ? brandColor : 'rgba(255,255,255,0.4)'}
              />
            </View>

            <View style={styles.optionDivider} />

            <View style={styles.optionRow}>
              <View style={styles.optionRowText}>
                <Text style={styles.optionRowTitle}>Show markup %</Text>
                <Text style={styles.optionRowDesc}>
                  Display the markup percentage next to each item price
                </Text>
              </View>
              <Switch
                value={showMarkup}
                onValueChange={setShowMarkup}
                trackColor={{ false: 'rgba(255,255,255,0.1)', true: brandColor + '88' }}
                thumbColor={showMarkup ? brandColor : 'rgba(255,255,255,0.4)'}
              />
            </View>

            {/* Live preview of what will be included */}
            <View style={styles.optionsPreview}>
              <Text style={styles.optionsPreviewLabel}>PDF WILL INCLUDE</Text>
              {[
                { label: 'Product names',           on: true },
                { label: 'Window measurements',     on: showMeasurements },
                { label: 'Markup %',                on: showMarkup },
                { label: 'Pricing & totals',        on: true },
                { label: 'Customer & dealer info',  on: true },
              ].map(item => (
                <View key={item.label} style={styles.optionsPreviewRow}>
                  <Text style={[
                    styles.optionsPreviewCheck,
                    { color: item.on ? '#30D158' : 'rgba(255,255,255,0.15)' },
                  ]}>
                    {item.on ? '✓' : '○'}
                  </Text>
                  <Text style={[
                    styles.optionsPreviewItem,
                    { color: item.on ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)' },
                  ]}>
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.generateBtn, { backgroundColor: brandColor }]}
              onPress={handleExportPDF}
            >
              <Text style={styles.generateBtnText}>Generate PDF →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{quote ? quote.quote_number : 'New Quote'}</Text>
        {quote && (
          <View style={[styles.statusBadge, {
            backgroundColor: quote.status === 'sent' ? brandColor + '26' : 'rgba(255,255,255,0.08)',
            borderColor: quote.status === 'sent' ? brandColor : 'rgba(255,255,255,0.15)',
          }]}>
            <Text style={[styles.statusText, {
              color: quote.status === 'sent' ? brandColor : 'rgba(255,255,255,0.5)',
            }]}>
              {quote.status.toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Customer section ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Customer</Text>
          {selectedCustomer && !isNewCustomer ? (
            <View style={[styles.selectedCustomer, { borderColor: brandColor + '4D' }]}>
              <View>
                <Text style={styles.selectedCustomerName}>{customerFullName(selectedCustomer)}</Text>
                <Text style={styles.selectedCustomerSub}>
                  {selectedCustomer.email ?? selectedCustomer.phone ?? ''}
                </Text>
              </View>
              {!quote && (
                <TouchableOpacity onPress={() => setSelectedCustomer(null)}>
                  <Text style={[styles.changeText, { color: brandColor }]}>Change</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : !quote ? (
            <View style={styles.section}>
              <View style={styles.tabRow}>
                <TouchableOpacity
                  style={[styles.tab, !isNewCustomer && {
                    backgroundColor: brandColor + '26', borderWidth: 1, borderColor: brandColor,
                  }]}
                  onPress={() => setIsNewCustomer(false)}
                >
                  <Text style={[styles.tabText, !isNewCustomer && { color: brandColor }]}>Existing</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, isNewCustomer && {
                    backgroundColor: brandColor + '26', borderWidth: 1, borderColor: brandColor,
                  }]}
                  onPress={() => setIsNewCustomer(true)}
                >
                  <Text style={[styles.tabText, isNewCustomer && { color: brandColor }]}>New Customer</Text>
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
                    <TouchableOpacity
                      key={c.id}
                      style={styles.customerOption}
                      onPress={() => setSelectedCustomer(c)}
                    >
                      <Text style={styles.customerOptionName}>{customerFullName(c)}</Text>
                      <Text style={styles.customerOptionSub}>{c.email ?? c.phone ?? ''}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.formFields}>
                  {([
                    ['First Name *', newCustomerFirstName, setNewCustomerFirstName],
                    ['Last Name',    newCustomerLastName,  setNewCustomerLastName],
                    ['Email',        newCustomerEmail,     setNewCustomerEmail],
                    ['Phone',        newCustomerPhone,     setNewCustomerPhone],
                    ['Address',      newCustomerAddress,   setNewCustomerAddress],
                  ] as const).map(([label, value, setter]: any) => (
                    <View key={label}>
                      <Text style={styles.fieldLabel}>{label}</Text>
                      <TextInput
                        value={value}
                        onChangeText={setter}
                        style={styles.textInput}
                        placeholderTextColor="rgba(255,255,255,0.25)"
                        placeholder={label}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : null}
        </View>

        {/* ── Line items ───────────────────────────────────────────────── */}
        {quote && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>{cap(tenantConfig.product_noun_plural)}</Text>
              <TouchableOpacity
                style={[styles.addWindowBtn, { backgroundColor: brandColor + '26', borderColor: brandColor + '4D' }]}
                onPress={() => setShowWindowPicker(true)}
              >
                <Text style={[styles.addWindowBtnText, { color: brandColor }]}>
                  + Add {cap(tenantConfig.product_noun_plural)}
                </Text>
              </TouchableOpacity>
            </View>

            {lineItems.length === 0 ? (
              <View style={styles.emptyWindows}>
                <Text style={styles.emptyWindowsText}>No {tenantConfig.product_noun_plural} added yet.</Text>
                <Text style={styles.emptyWindowsHint}>
                  Tap "+ Add {cap(tenantConfig.product_noun_plural)}" to add scanned{' '}
                  {tenantConfig.product_noun_plural} with assigned products.
                </Text>
              </View>
            ) : (
              lineItems.map((item: any) => {
                const itemId          = item.id ?? '';
                const markup          = getItemMarkup(itemId);
                const costCents       = getLineDealerCost(item);
                const quotePriceCents = getQuotePrice(item);

                return (
                  <View key={itemId} style={styles.lineItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lineItemName}>
                        {item.product_name ?? item.description ?? cap(tenantConfig.product_noun_plural)}
                      </Text>
                      {item.width_in && item.height_in && (
                        <Text style={styles.lineItemSub}>{item.width_in}" × {item.height_in}"</Text>
                      )}
                      <View style={styles.itemMarginRow}>
                        <Text style={styles.itemMarginLabel}>Markup:</Text>
                        <TouchableOpacity
                          style={styles.itemMarginBtn}
                          onPress={() => setItemMarkups(p => ({ ...p, [itemId]: Math.max(0, markup - 5) }))}
                        >
                          <Text style={styles.marginBtnText}>−</Text>
                        </TouchableOpacity>
                        <Text style={[styles.itemMarginVal, { color: brandColor }]}>{markup}%</Text>
                        <TouchableOpacity
                          style={styles.itemMarginBtn}
                          onPress={() => setItemMarkups(p => ({ ...p, [itemId]: Math.min(200, markup + 5) }))}
                        >
                          <Text style={styles.marginBtnText}>+</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleRemoveLineItem(itemId, item.window_id)}>
                          <Text style={styles.removeText}>remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.lineItemPriceCol}>
                      <Text style={styles.lineItemPrice}>${(quotePriceCents / 100).toFixed(0)}</Text>
                      <Text style={styles.lineItemBase}>cost ${(costCents / 100).toFixed(0)}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ── Markup / Install controls ────────────────────────────────── */}
        {quote && lineItems.length > 0 && (
          <View style={styles.marginCard}>
            <View style={styles.pricingLegend}>
              <Text style={styles.pricingLegendText}>
                💡 Prices are based on your dealer cost settings. Adjust markup per item or globally below.
              </Text>
            </View>
            <View style={styles.marginRow}>
              <View style={styles.marginField}>
                <Text style={styles.marginLabel}>Global Markup %</Text>
                <View style={styles.marginInputRow}>
                  <TouchableOpacity
                    style={styles.marginBtn}
                    onPress={() => { setGlobalMarkup(m => Math.max(0, m - 5)); setItemMarkups({}); }}
                  >
                    <Text style={styles.marginBtnText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    value={String(globalMarkup)}
                    onChangeText={v => {
                      const n = parseInt(v.replace(/[^0-9]/g, '')) || 0;
                      setGlobalMarkup(Math.min(200, Math.max(0, n)));
                      setItemMarkups({});
                    }}
                    style={styles.marginInput}
                    keyboardType="numeric"
                    selectTextOnFocus
                  />
                  <TouchableOpacity
                    style={styles.marginBtn}
                    onPress={() => { setGlobalMarkup(m => Math.min(200, m + 5)); setItemMarkups({}); }}
                  >
                    <Text style={styles.marginBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.marginField}>
                <Text style={styles.marginLabel}>Install %</Text>
                <View style={styles.marginInputRow}>
                  <TouchableOpacity
                    style={styles.marginBtn}
                    onPress={() => setInstallPercent(p => Math.max(0, p - 5))}
                  >
                    <Text style={styles.marginBtnText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    value={String(installPercent)}
                    onChangeText={v => {
                      const n = parseInt(v.replace(/[^0-9]/g, '')) || 0;
                      setInstallPercent(Math.min(100, Math.max(0, n)));
                    }}
                    style={styles.marginInput}
                    keyboardType="numeric"
                    selectTextOnFocus
                  />
                  <TouchableOpacity
                    style={styles.marginBtn}
                    onPress={() => setInstallPercent(p => Math.min(100, p + 5))}
                  >
                    <Text style={styles.marginBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ── Totals ───────────────────────────────────────────────────── */}
        {quote && lineItems.length > 0 && (
          <View style={styles.totalsCard}>
            {lineItems.map((item: any) => {
              const cost  = getLineDealerCost(item);
              const price = getQuotePrice(item);
              return (
                <View key={item.id} style={styles.totalRow}>
                  <Text style={styles.totalLabel} numberOfLines={1}>
                    {(item.product_name ?? item.description ?? cap(tenantConfig.product_noun_plural))
                      .split('—').pop()?.trim()}
                  </Text>
                  <View style={styles.totalValGroup}>
                    <Text style={styles.totalCost}>cost ${(cost / 100).toFixed(0)}</Text>
                    <Text style={styles.totalVal}>${(price / 100).toFixed(0)}</Text>
                  </View>
                </View>
              );
            })}

            <View style={styles.divider} />

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
              <Text style={[styles.grandTotalVal, { color: brandColor }]}>
                ${(computedTotal / 100).toFixed(0)}
              </Text>
            </View>
          </View>
        )}

        {/* ── Notes ────────────────────────────────────────────────────── */}
        {!quote && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notes (optional)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
              multiline
              placeholder="Any special notes..."
              placeholderTextColor="rgba(255,255,255,0.25)"
            />
          </View>
        )}

        {/* ── Actions ──────────────────────────────────────────────────── */}
        {!quote ? (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: brandColor }, saving && styles.btnDisabled]}
            onPress={handleCreateQuote}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="white" size="small" />
              : <Text style={styles.primaryBtnText}>Create Quote</Text>}
          </TouchableOpacity>
        ) : quote.status === 'draft' ? (
          <View style={styles.btnRow}>
            <PDFButton />
            <TouchableOpacity
              style={[styles.primaryBtn, { flex: 1, backgroundColor: brandColor }, sending && styles.btnDisabled]}
              onPress={handleSend}
              disabled={sending}
            >
              {sending
                ? <ActivityIndicator color="white" size="small" />
                : <Text style={styles.primaryBtnText}>Send to Customer →</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <PDFButton full />
            <View style={styles.sentStatusCard}>
              <Text style={styles.sentStatusText}>
                {quote.status === 'approved'
                  ? '✅ Customer approved this quote'
                  : `Quote is ${quote.status}`}
              </Text>
            </View>
          </>
        )}

      </ScrollView>

      {/* ── Window picker modal ───────────────────────────────────────── */}
      <Modal visible={showWindowPicker} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add {cap(tenantConfig.product_noun_plural)}</Text>
            <TouchableOpacity onPress={() => setShowWindowPicker(false)}>
              <Text style={[styles.modalClose, { color: brandColor }]}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            {windowsAvailable.length === 0 ? (
              <View style={styles.emptyWindows}>
                <Text style={styles.emptyWindowsText}>
                  No {tenantConfig.product_noun_plural} available to add.
                </Text>
                <Text style={styles.emptyWindowsHint}>
                  {windowsWithProducts.length === 0
                    ? `Go to Rooms, scan ${tenantConfig.product_noun_plural}, and assign products before building a quote.`
                    : `All ${tenantConfig.product_noun_plural} with products have been added to this quote.`}
                </Text>
              </View>
            ) : (
              rooms.map((room: any) => {
                const roomWindows = (room.windows ?? []).filter(
                  (w: any) => w.product && !addedWindowIds.has(w.id)
                );
                if (roomWindows.length === 0) return null;
                return (
                  <View key={room.id} style={styles.roomSection}>
                    <Text style={styles.roomSectionTitle}>{room.name}</Text>
                    {roomWindows.map((w: any) => {
                      const pickerPrice = getPickerPrice(w.product);
                      return (
                        <TouchableOpacity
                          key={w.id}
                          style={styles.windowPickerItem}
                          onPress={() => { handleAddWindow(w); setShowWindowPicker(false); }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.windowPickerName}>
                              {w.label ?? cap(tenantConfig.product_noun_plural)}
                            </Text>
                            <Text style={styles.windowPickerSub}>
                              {w.width_in && w.height_in ? `${w.width_in}" × ${w.height_in}"  ·  ` : ''}
                              {w.product?.name ?? ''}
                            </Text>
                          </View>
                          <View style={styles.windowPickerPriceCol}>
                            <Text style={styles.windowPickerPrice}>
                              ${(pickerPrice / 100).toFixed(0)}
                            </Text>
                            <Text style={styles.windowPickerPriceSub}>quote price</Text>
                          </View>
                          <Text style={[styles.addChevron, { color: brandColor }]}>+</Text>
                        </TouchableOpacity>
                      );
                    })}
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

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: '#080C14' },
  centered:             { flex: 1, backgroundColor: '#080C14', alignItems: 'center', justifyContent: 'center' },
  header:               { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn:              { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  backIcon:             { color: 'white', fontSize: 24, lineHeight: 30 },
  headerTitle:          { color: 'white', fontSize: 20, fontWeight: '800', flex: 1 },
  statusBadge:          { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  statusText:           { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  content:              { padding: 20, gap: 20, paddingBottom: 40 },
  section:              { gap: 10 },
  sectionLabel:         { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  sectionHeaderRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addWindowBtn:         { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  addWindowBtnText:     { fontWeight: '700', fontSize: 13 },
  selectedCustomer:     { backgroundColor: '#0D1520', borderRadius: 14, borderWidth: 1, padding: 14, flexDirection: 'row', justifyContent: 'space-between' },
  selectedCustomerName: { color: 'white', fontWeight: '700', fontSize: 15 },
  selectedCustomerSub:  { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  changeText:           { fontWeight: '600', fontSize: 13 },
  tabRow:               { flexDirection: 'row', gap: 8, marginBottom: 4 },
  tab:                  { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center' },
  tabText:              { color: 'rgba(255,255,255,0.4)', fontWeight: '600', fontSize: 13 },
  formFields:           { gap: 10 },
  fieldLabel:           { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 4 },
  textInput:            { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, color: 'white', fontSize: 15, padding: 12 },
  customerOption:       { backgroundColor: '#0D1520', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 12, marginTop: 6 },
  customerOptionName:   { color: 'white', fontWeight: '600', fontSize: 14 },
  customerOptionSub:    { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 },
  emptyWindows:         { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 20, alignItems: 'center', gap: 8 },
  emptyWindowsText:     { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' },
  emptyWindowsHint:     { color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  lineItem:             { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  lineItemName:         { color: 'white', fontWeight: '600', fontSize: 14 },
  lineItemSub:          { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 },
  lineItemPriceCol:     { alignItems: 'flex-end', justifyContent: 'flex-start', marginLeft: 12 },
  lineItemPrice:        { color: 'white', fontWeight: '700', fontSize: 15 },
  lineItemBase:         { color: 'rgba(255,255,255,0.25)', fontSize: 10, marginTop: 2 },
  itemMarginRow:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  itemMarginLabel:      { color: 'rgba(255,255,255,0.35)', fontSize: 11 },
  itemMarginBtn:        { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  itemMarginVal:        { fontWeight: '700', fontSize: 12, minWidth: 32, textAlign: 'center' },
  removeText:           { color: 'rgba(255,69,58,0.7)', fontSize: 10, fontWeight: '600', marginLeft: 4 },
  pricingLegend:        { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 10 },
  pricingLegendText:    { color: 'rgba(255,255,255,0.35)', fontSize: 11, lineHeight: 16 },
  marginCard:           { backgroundColor: '#0D1520', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', padding: 16, gap: 12 },
  marginRow:            { flexDirection: 'column', gap: 12 },
  marginField:          { flex: 1, gap: 6 },
  marginLabel:          { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600' },
  marginInputRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  marginBtn:            { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  marginBtnText:        { color: 'white', fontSize: 16, fontWeight: '600', lineHeight: 20 },
  marginInput:          { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, color: 'white', fontSize: 15, padding: 6, textAlign: 'center' },
  totalsCard:           { backgroundColor: '#0D1520', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', padding: 16, gap: 8 },
  totalRow:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel:           { color: 'rgba(255,255,255,0.5)', fontSize: 13, flex: 1, marginRight: 8 },
  totalValGroup:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  totalCost:            { color: 'rgba(255,255,255,0.2)', fontSize: 11 },
  totalVal:             { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  divider:              { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 4 },
  grandTotalLabel:      { color: 'white', fontWeight: '700', fontSize: 16 },
  grandTotalVal:        { fontWeight: '800', fontSize: 22 },
  btnRow:               { flexDirection: 'row', gap: 10 },
  pdfBtn:               { borderRadius: 14, paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  pdfBtnFull:           { marginBottom: 10 },
  pdfBtnLocked:         { borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)' },
  pdfBtnInner:          { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pdfBtnText:           { fontWeight: '700', fontSize: 14 },
  pdfProPill:           { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  pdfProPillText:       { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  primaryBtn:           { borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText:       { color: 'white', fontWeight: '700', fontSize: 15 },
  btnDisabled:          { opacity: 0.5 },
  sentStatusCard:       { backgroundColor: 'rgba(48,209,88,0.08)', borderWidth: 1, borderColor: 'rgba(48,209,88,0.2)', borderRadius: 14, padding: 16, alignItems: 'center' },
  sentStatusText:       { color: '#30D158', fontWeight: '600', fontSize: 14 },
  optionsBody:          { padding: 24, gap: 20 },
  optionsHint:          { color: 'rgba(255,255,255,0.4)', fontSize: 13, lineHeight: 20 },
  optionRow:            { flexDirection: 'row', alignItems: 'center', gap: 16 },
  optionRowText:        { flex: 1, gap: 4 },
  optionRowTitle:       { color: 'white', fontWeight: '600', fontSize: 15 },
  optionRowDesc:        { color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 18 },
  optionDivider:        { height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  optionsPreview:       { backgroundColor: '#0D1520', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', padding: 16, gap: 10 },
  optionsPreviewLabel:  { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  optionsPreviewRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionsPreviewCheck:  { fontSize: 14, fontWeight: '700', width: 18 },
  optionsPreviewItem:   { fontSize: 13 },
  generateBtn:          { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  generateBtnText:      { color: 'white', fontWeight: '700', fontSize: 15 },
  gateCard:             { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  gateEmoji:            { fontSize: 64 },
  gateTitle:            { color: 'white', fontSize: 24, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  gateDesc:             { color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 22, textAlign: 'center', maxWidth: 300 },
  featureList:          { width: '100%', gap: 10, backgroundColor: '#0D1520', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  featureRow:           { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureCheck:         { fontSize: 16, fontWeight: '700', width: 20 },
  featureLabel:         { color: 'rgba(255,255,255,0.7)', fontSize: 14, flex: 1 },
  proBadge:             { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  proBadgeText:         { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  currentPlanBadge:     { borderWidth: 1, borderRadius: 100, paddingVertical: 6, paddingHorizontal: 16 },
  currentPlanText:      { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  upgradeBtn:           { width: '100%', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  upgradeBtnText:       { color: 'white', fontWeight: '700', fontSize: 15 },
  gateDismissBtn:       { paddingVertical: 12 },
  gateDismissText:      { color: 'rgba(255,255,255,0.3)', fontSize: 14 },
  modalContainer:       { flex: 1, backgroundColor: '#080C14' },
  modalHeader:          { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  modalTitle:           { color: 'white', fontSize: 20, fontWeight: '800' },
  modalClose:           { fontSize: 16, fontWeight: '600' },
  modalContent:         { padding: 20, gap: 16, paddingBottom: 40 },
  roomSection:          { gap: 8 },
  roomSectionTitle:     { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  windowPickerItem:     { backgroundColor: '#0D1520', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  windowPickerName:     { color: 'white', fontWeight: '600', fontSize: 15 },
  windowPickerSub:      { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  windowPickerPriceCol: { alignItems: 'flex-end' },
  windowPickerPrice:    { color: '#30D158', fontWeight: '700', fontSize: 15 },
  windowPickerPriceSub: { color: 'rgba(255,255,255,0.25)', fontSize: 10, marginTop: 1 },
  addChevron:           { fontSize: 22, fontWeight: '700', marginLeft: 4 },
});