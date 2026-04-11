import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Switch, Alert, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { dealersService } from '../lib/supabase';

const BRAND_COLORS = ['#0A84FF', '#30D158', '#FF9F0A', '#FF453A', '#BF5AF2', '#636366'];
const PLAN_LIMITS: Record<string, string[]> = {
  basic: ['Unlimited scans', '1 user', 'Basic catalog', 'Email quotes'],
  pro: ['Unlimited scans', '5 users', 'Full catalog', 'Email + PDF quotes', 'Quote analytics', 'Priority support'],
  enterprise: ['Unlimited scans', 'Unlimited users', 'Full catalog', 'White-label portal', 'API access', 'Dedicated support'],
};

export default function SettingsScreen() {
  const { dealer, signOut, refreshDealer } = useAuth();
  const { tenantConfig } = useTenant();
  const [brandName, setBrandName] = useState(dealer?.name ?? '');
  const [brandColor, setBrandColor] = useState(dealer?.brand_color ?? tenantConfig.primary_color);
  const [arEnabled, setArEnabled] = useState(dealer?.features?.ar_scanner !== false);
  const [autoQuote, setAutoQuote] = useState(dealer?.features?.auto_quote !== false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const plan = dealer?.plan ?? 'basic';
  const planFeatures = PLAN_LIMITS[plan] ?? PLAN_LIMITS.basic;
  const activeBrandColor = brandColor || tenantConfig.primary_color;

  const handleSave = async () => {
    if (!dealer) return;
    setSaving(true);
    try {
      await dealersService.updateBranding(dealer.id, {
        app_name: brandName.trim(),
        brand_color: brandColor,
      });
      await dealersService.updateFeatures(dealer.id, {
        ar_scanner: arEnabled,
        auto_quote: autoQuote,
      });
      await refreshDealer();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      Alert.alert('Save failed', e.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSub}>Dealer configuration</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Brand Identity</Text>
          <Text style={styles.fieldLabel}>Business Name</Text>
          <TextInput
            value={brandName}
            onChangeText={setBrandName}
            style={styles.textInput}
            placeholderTextColor="rgba(255,255,255,0.25)"
          />
          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Brand Color</Text>
          <View style={styles.colorRow}>
            {BRAND_COLORS.map(c => (
              <TouchableOpacity
                key={c}
                onPress={() => setBrandColor(c)}
                style={[styles.colorSwatch, { backgroundColor: c }, brandColor === c && styles.colorSwatchActive]}
              />
            ))}
          </View>
        </View>

        <View style={[styles.card, { borderColor: activeBrandColor + '40' }]}>
          <Text style={styles.cardLabel}>App Preview</Text>
          <View style={styles.previewRow}>
            <View style={[styles.previewIcon, { backgroundColor: activeBrandColor }]}>
              <Text style={styles.previewIconText}>
                {(brandName || 'WF').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
              </Text>
            </View>
            <View>
              <Text style={styles.previewName}>{brandName || tenantConfig.dealer_name}</Text>
              <Text style={[styles.previewPowered, { color: activeBrandColor }]}>
                Powered by {tenantConfig.brand_name}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Features</Text>
          {[
            ['AR Scanner', `Use phone camera for ${tenantConfig.product_noun} measurements`, arEnabled, setArEnabled],
            ['Auto Quote', 'Generate quotes from scan data', autoQuote, setAutoQuote],
          ].map(([label, desc, val, set]: any) => (
            <View key={label} style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>{label}</Text>
                <Text style={styles.toggleDesc}>{desc}</Text>
              </View>
              <Switch
                value={val}
                onValueChange={set}
                trackColor={{ false: 'rgba(255,255,255,0.15)', true: activeBrandColor }}
                thumbColor="white"
              />
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>{tenantConfig.brand_name} License</Text>
          <View style={styles.planRow}>
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>{plan.toUpperCase()}</Text>
            </View>
            <View style={[styles.planBadge, styles.planBadgeGreen]}>
              <Text style={[styles.planBadgeText, { color: '#30D158' }]}>{dealer?.status?.toUpperCase() ?? 'ACTIVE'}</Text>
            </View>
          </View>
          <View style={styles.featureList}>
            {planFeatures.map(f => (
              <Text key={f} style={styles.featureItem}>✓  {f}</Text>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Account</Text>
          <Text style={styles.accountInfo}>Dealer ID: <Text style={styles.accountInfoVal}>{dealer?.id?.slice(0, 8)}...</Text></Text>
          <Text style={styles.accountInfo}>Joined: <Text style={styles.accountInfoVal}>{dealer?.joined_at ? new Date(dealer.joined_at).toLocaleDateString() : '—'}</Text></Text>
          <Text style={styles.accountInfo}>Trade: <Text style={styles.accountInfoVal}>{tenantConfig.brand_name}</Text></Text>
        </View>

        <TouchableOpacity
          style={[
            styles.saveBtn,
            { backgroundColor: activeBrandColor },
            saved && styles.saveBtnSuccess,
            saving && styles.btnDisabled,
          ]}
          onPress={handleSave}
          disabled={saving || saved}
        >
          {saving
            ? <ActivityIndicator color="white" size="small" />
            : <Text style={styles.saveBtnText}>{saved ? '✓ Saved!' : 'Save Settings'}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0F1A' },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  headerSub: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 2 },
  content: { padding: 20, gap: 14, paddingBottom: 60 },
  card: {
    backgroundColor: '#111827', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', padding: 16, gap: 10,
  },
  cardLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  fieldLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10,
    color: 'white', fontSize: 15, padding: 12,
  },
  colorRow: { flexDirection: 'row', gap: 10 },
  colorSwatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'transparent' },
  colorSwatchActive: { borderColor: 'white', borderWidth: 3 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#0A0F1A', borderRadius: 12, padding: 12 },
  previewIcon: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  previewIconText: { color: 'white', fontWeight: '800', fontSize: 16 },
  previewName: { color: 'white', fontWeight: '700', fontSize: 15 },
  previewPowered: { fontSize: 12, marginTop: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', gap: 12 },
  toggleLabel: { color: 'white', fontWeight: '600', fontSize: 14 },
  toggleDesc: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 },
  planRow: { flexDirection: 'row', gap: 8 },
  planBadge: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  planBadgeGreen: { backgroundColor: 'rgba(48,209,88,0.1)' },
  planBadgeText: { color: 'white', fontWeight: '800', fontSize: 11, letterSpacing: 0.5 },
  featureList: { gap: 6 },
  featureItem: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  accountInfo: { color: 'rgba(255,255,255,0.35)', fontSize: 12 },
  accountInfoVal: { color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnSuccess: { backgroundColor: '#30D158' },
  saveBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
  signOutBtn: { alignItems: 'center', paddingVertical: 12 },
  signOutText: { color: 'rgba(255,69,58,0.7)', fontWeight: '600', fontSize: 14 },
});