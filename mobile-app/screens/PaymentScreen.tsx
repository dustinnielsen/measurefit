import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, ScrollView, Modal,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';

const Alert = {
  alert: (title: string, message?: string, buttons?: Array<{ text: string; onPress?: () => void }>) => {
    if (buttons && buttons.length > 1) {
      const result = window.confirm(`${title}\n\n${message ?? ''}`);
      if (result) { buttons[1]?.onPress?.(); } else { buttons[0]?.onPress?.(); }
    } else {
      window.alert(`${title}${message ? '\n\n' + message : ''}`);
      buttons?.[0]?.onPress?.();
    }
  },
};

const API_BASE = 'https://windowfit-production.up.railway.app';

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  unpaid:      'rgba(255,255,255,0.3)',
  link_sent:   '#FF9F0A',
  deposit_paid: '#30D158',
  paid_in_full: '#30D158',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid:       'Unpaid',
  link_sent:    'Link Sent',
  deposit_paid: 'Deposit Paid ✓',
  paid_in_full: 'Paid in Full ✓',
};

export default function PaymentScreen({ route, navigation }: any) {
  const { quoteId, quoteNumber, totalCents, depositCents, paymentStatus: initialStatus } = route.params ?? {};
  const { dealer } = useAuth();
  const { tenantConfig } = useTenant();
  const brandColor = tenantConfig.primary_color;

  const [loading, setLoading]           = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string>(initialStatus ?? 'unpaid');
  const [checkoutUrl, setCheckoutUrl]   = useState<string | null>(null);
  const [showManual, setShowManual]     = useState(false);
  const [manualMethod, setManualMethod] = useState<'manual_cash' | 'manual_check'>('manual_cash');
  const [manualNotes, setManualNotes]   = useState('');
  const [savingManual, setSavingManual] = useState(false);
  const [showSuccess, setShowSuccess]   = useState(false);

  const deposit = depositCents ?? Math.round((totalCents ?? 0) * 0.5);
  const total   = totalCents ?? 0;

  const handleSendLink = async () => {
    if (!dealer) return;
    setLoading(true);
    console.log('DEBUG payment:', { quoteId, deposit, total, dealerId: dealer?.id });
    try {
      const res = await fetch(`${API_BASE}/api/payments/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId, dealerId: dealer.id, depositCents: deposit }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to create payment link');

      setCheckoutUrl(json.url);
      setPaymentStatus('link_sent');

      // Open in browser
      window.open(json.url, '_blank');

      Alert.alert(
        'Payment Link Created',
        `A Stripe checkout link has been opened. You can also copy it to send to your customer directly.\n\nDeposit: $${(json.depositCents / 100).toFixed(2)}`,
        [{ text: 'OK' }]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordManual = async () => {
    if (!dealer) return;
    setSavingManual(true);
    try {
      const res = await fetch(`${API_BASE}/api/payments/record-manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId,
          dealerId: dealer.id,
          amountCents: deposit,
          paymentMethod: manualMethod,
          notes: manualNotes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to record payment');

      setPaymentStatus(json.payment_status);
      setShowManual(false);
      setShowSuccess(true);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingManual(false);
    }
  };

  const statusColor = PAYMENT_STATUS_COLORS[paymentStatus] ?? 'rgba(255,255,255,0.3)';
  const statusLabel = PAYMENT_STATUS_LABELS[paymentStatus] ?? paymentStatus;
  const isPaid = paymentStatus === 'deposit_paid' || paymentStatus === 'paid_in_full';

  return (
    <View style={styles.container}>

      {/* Manual Payment Modal */}
      <Modal visible={showManual} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Record Payment</Text>
            <TouchableOpacity onPress={() => setShowManual(false)}>
              <Text style={[styles.modalClose, { color: brandColor }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.manualAmountLabel}>Amount</Text>
            <Text style={[styles.manualAmount, { color: brandColor }]}>
              ${(deposit / 100).toFixed(2)}
            </Text>
            <Text style={styles.manualAmountSub}>50% deposit of ${(total / 100).toFixed(2)} total</Text>

            <Text style={styles.fieldLabel}>Payment Method</Text>
            <View style={styles.methodRow}>
              {(['manual_cash', 'manual_check'] as const).map(m => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.methodBtn,
                    manualMethod === m && { backgroundColor: brandColor + '26', borderColor: brandColor },
                  ]}
                  onPress={() => setManualMethod(m)}
                >
                  <Text style={[styles.methodBtnText, manualMethod === m && { color: brandColor }]}>
                    {m === 'manual_cash' ? '💵 Cash' : '📝 Check'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput
              value={manualNotes}
              onChangeText={setManualNotes}
              style={styles.textInput}
              placeholder="Check #, reference number, etc."
              placeholderTextColor="rgba(255,255,255,0.25)"
              multiline
            />

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: brandColor }, savingManual && styles.btnDisabled]}
              onPress={handleRecordManual}
              disabled={savingManual}
            >
              {savingManual
                ? <ActivityIndicator color="white" size="small" />
                : <Text style={styles.primaryBtnText}>Record Payment →</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Collect Payment</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Quote Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryQuoteNumber}>{quoteNumber}</Text>
          <View style={styles.summaryAmounts}>
            <View style={styles.summaryAmountBlock}>
              <Text style={styles.summaryAmountLabel}>Quote Total</Text>
              <Text style={styles.summaryAmountValue}>${(total / 100).toFixed(2)}</Text>
            </View>
            <View style={[styles.summaryDivider]} />
            <View style={styles.summaryAmountBlock}>
              <Text style={styles.summaryAmountLabel}>50% Deposit</Text>
              <Text style={[styles.summaryAmountValue, { color: brandColor }]}>
                ${(deposit / 100).toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Payment Status Badge */}
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor + '50' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        {/* Success State */}
        {(isPaid || showSuccess) ? (
          <View style={styles.successCard}>
            <Text style={styles.successEmoji}>💰</Text>
            <Text style={styles.successTitle}>Payment Recorded</Text>
            <Text style={styles.successDesc}>
              {paymentStatus === 'paid_in_full'
                ? 'This quote has been paid in full.'
                : 'The deposit has been recorded. You\'re ready to order!'}
            </Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: brandColor, marginTop: 8 }]}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.primaryBtnText}>Back to Quote</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Option 1 — Send Payment Link */}
            <View style={styles.optionCard}>
              <View style={styles.optionHeader}>
                <Text style={styles.optionEmoji}>🔗</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>Send Payment Link</Text>
                  <Text style={styles.optionDesc}>
                    Generate a Stripe checkout link. Customer pays securely online.
                  </Text>
                </View>
              </View>

              {checkoutUrl && (
                <View style={styles.linkBox}>
                  <Text style={styles.linkBoxLabel}>CHECKOUT URL</Text>
                  <Text style={styles.linkBoxUrl} numberOfLines={1}>{checkoutUrl}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(checkoutUrl);
                        Alert.alert('Copied', 'Payment link copied to clipboard.');
                      }
                    }}
                  >
                    <Text style={[styles.copyBtn, { color: brandColor }]}>Copy Link</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.optionBtn,
                  { backgroundColor: brandColor },
                  loading && styles.btnDisabled,
                  paymentStatus === 'link_sent' && styles.optionBtnSent,
                ]}
                onPress={handleSendLink}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="white" size="small" />
                  : <Text style={styles.optionBtnText}>
                      {paymentStatus === 'link_sent' ? '🔄 Resend Link' : '→ Generate Link'}
                    </Text>
                }
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.orLine} />
            </View>

            {/* Option 2 — Record Cash / Check */}
            <View style={styles.optionCard}>
              <View style={styles.optionHeader}>
                <Text style={styles.optionEmoji}>💵</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>Record Cash or Check</Text>
                  <Text style={styles.optionDesc}>
                    Payment collected in person. Log it here to update the quote status.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.optionBtn, styles.optionBtnOutline, { borderColor: brandColor }]}
                onPress={() => setShowManual(true)}
              >
                <Text style={[styles.optionBtnText, { color: brandColor }]}>→ Record Payment</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: '#0A0F1A' },
  header:              { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn:             { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  backIcon:            { color: 'white', fontSize: 24, lineHeight: 30 },
  headerTitle:         { color: 'white', fontSize: 20, fontWeight: '800', flex: 1 },
  content:             { padding: 20, gap: 16, paddingBottom: 60 },
  summaryCard:         { backgroundColor: '#111827', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', padding: 20, gap: 16, alignItems: 'center' },
  summaryQuoteNumber:  { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  summaryAmounts:      { flexDirection: 'row', gap: 0, width: '100%' },
  summaryAmountBlock:  { flex: 1, alignItems: 'center', gap: 4 },
  summaryDivider:      { width: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  summaryAmountLabel:  { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600' },
  summaryAmountValue:  { color: 'white', fontSize: 22, fontWeight: '800' },
  statusBadge:         { borderWidth: 1, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 5 },
  statusText:          { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  optionCard:          { backgroundColor: '#111827', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', padding: 18, gap: 14 },
  optionHeader:        { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  optionEmoji:         { fontSize: 28, lineHeight: 32 },
  optionTitle:         { color: 'white', fontWeight: '700', fontSize: 16, marginBottom: 4 },
  optionDesc:          { color: 'rgba(255,255,255,0.4)', fontSize: 13, lineHeight: 18 },
  optionBtn:           { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  optionBtnOutline:    { backgroundColor: 'transparent', borderWidth: 1 },
  optionBtnSent:       { opacity: 0.75 },
  optionBtnText:       { color: 'white', fontWeight: '700', fontSize: 14 },
  linkBox:             { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 12, gap: 6 },
  linkBoxLabel:        { color: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  linkBoxUrl:          { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
  copyBtn:             { fontWeight: '700', fontSize: 13 },
  orRow:               { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orLine:              { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  orText:              { color: 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: '600' },
  successCard:         { backgroundColor: 'rgba(48,209,88,0.06)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(48,209,88,0.2)', padding: 28, alignItems: 'center', gap: 10 },
  successEmoji:        { fontSize: 48 },
  successTitle:        { color: 'white', fontWeight: '800', fontSize: 20 },
  successDesc:         { color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  primaryBtn:          { borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText:      { color: 'white', fontWeight: '700', fontSize: 15 },
  btnDisabled:         { opacity: 0.5 },
  modalContainer:      { flex: 1, backgroundColor: '#0A0F1A' },
  modalHeader:         { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  modalTitle:          { color: 'white', fontSize: 20, fontWeight: '800' },
  modalClose:          { fontSize: 16, fontWeight: '600' },
  modalContent:        { padding: 24, gap: 14, paddingBottom: 40 },
  manualAmountLabel:   { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' },
  manualAmount:        { fontSize: 42, fontWeight: '800', textAlign: 'center' },
  manualAmountSub:     { color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', marginBottom: 8 },
  fieldLabel:          { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600' },
  methodRow:           { flexDirection: 'row', gap: 10 },
  methodBtn:           { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.04)', paddingVertical: 12, alignItems: 'center' },
  methodBtnText:       { color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 14 },
  textInput:           { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, color: 'white', fontSize: 15, padding: 12, minHeight: 72, textAlignVertical: 'top' },
});