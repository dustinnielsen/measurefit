import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, FlatList, TextInput,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { roomsService, productsService, supabase } from '../lib/supabase';
import type { Window as WFWindow } from '../lib/supabase';

const SCREEN_WIDTH = Dimensions.get('window').width;

// ─────────────────────────────────────────────────────────────────────────────
// COLOR NAME → HEX LOOKUP
// ─────────────────────────────────────────────────────────────────────────────
const COLOR_MAP: Record<string, string> = {
  'White':          '#F5F5F0',
  'Bright White':   '#FAFAFA',
  'Antique White':  '#F5EDD6',
  'Cotton':         '#F0EDE4',
  'Ivory':          '#FFF8E7',
  'Cream':          '#FDF6E3',
  'Linen':          '#E8DCC8',
  'Almond':         '#EFDECD',
  'Antique':        '#E8D5B0',
  'Parchment':      '#F2E8D5',
  'Stone':          '#B0A898',
  'Pebble':         '#9E9890',
  'Driftwood':      '#A89880',
  'Warm Gray':      '#9E9488',
  'Slate':          '#7A8490',
  'Slate Gray':     '#6E7F80',
  'Pewter':         '#8A8A8A',
  'Silver':         '#C0C0C0',
  'Satin Silver':   '#B8B8C0',
  'Matte White':    '#F0F0F0',
  'Charcoal':       '#4A4A4A',
  'Graphite':       '#3D3D3D',
  'Sand':           '#C8B89A',
  'Dune':           '#C4A882',
  'Caramel':        '#C68642',
  'Mocha':          '#6F4E37',
  'Espresso':       '#3C2415',
  'Chestnut':       '#954535',
  'Walnut':         '#5C4033',
  'Mahogany':       '#C04000',
  'Natural Stain':  '#A0785A',
  'Golden Oak':     '#C8A060',
  'Bamboo':         '#D4C5A9',
  'Wheat':          '#F5DEB3',
  'Honey':          '#D4A020',
  'Terra':          '#C17A50',
  'Terra Cotta':    '#C26A4A',
  'Sienna':         '#A0522D',
  'Rust':           '#B7410E',
  'Navy':           '#1B2A4A',
  'Midnight':       '#1A1A2E',
  'Indigo':         '#3D3580',
  'Ocean':          '#006994',
  'Sky':            '#87CEEB',
  'Sage':           '#8FAF8F',
  'Moss':           '#6B7C4F',
  'Forest':         '#355E3B',
  'Jade':           '#00A86B',
  'Mint':           '#98D4C0',
  'Burgundy':       '#800020',
  'Wine':           '#722F37',
  'Rose':           '#E8A0A0',
  'Blush':          '#F4C2C2',
  'Black':          '#1A1A1A',
  'Onyx':           '#0F0F0F',
  'Ebony':          '#555D50',
  'Dusk':           '#8B7D8B',
  'Champagne':      '#F7E7CE',
  'Natural Linen':  '#DDD0B8',
  'Warm White':     '#FDF8F0',
  'Alabaster':      '#F2F0EB',
  'Bronze':         '#8C6A3F',
  'Custom Paint Match': '#D0CCC8',
};

function colorNameToHex(name: string): string {
  if (COLOR_MAP[name]) return COLOR_MAP[name];
  const lower = name.toLowerCase();
  const match = Object.keys(COLOR_MAP).find(
    k => lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)
  );
  return match ? COLOR_MAP[match] : '#C8C0B8';
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTDOOR SCENE
// ─────────────────────────────────────────────────────────────────────────────
function OutdoorScene({ paneW, paneH }: { paneW: number; paneH: number }) {
  return (
    <>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#87CEEB' }} />
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: paneH * 0.45, backgroundColor: '#B8DFF5' }} />
      <View style={{ position: 'absolute', top: paneH * 0.08, right: paneW * 0.2, width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFE566' }} />
      <View style={{ position: 'absolute', bottom: paneH * 0.22, left: -10, width: paneW * 0.6, height: paneH * 0.28, backgroundColor: '#8BB88A', borderTopLeftRadius: 80, borderTopRightRadius: 120 }} />
      <View style={{ position: 'absolute', bottom: paneH * 0.2, right: -10, width: paneW * 0.55, height: paneH * 0.24, backgroundColor: '#7AAD79', borderTopLeftRadius: 100, borderTopRightRadius: 60 }} />
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: paneH * 0.22, backgroundColor: '#6B9E5E' }} />
      <View style={{ position: 'absolute', bottom: paneH * 0.22, left: paneW * 0.15, width: 10, height: paneH * 0.25, backgroundColor: '#7B5C3A' }} />
      <View style={{ position: 'absolute', bottom: paneH * 0.38, left: paneW * 0.04, width: 56, height: 56, borderRadius: 28, backgroundColor: '#4A8C45' }} />
      <View style={{ position: 'absolute', bottom: paneH * 0.22, right: paneW * 0.22, width: 7, height: paneH * 0.18, backgroundColor: '#7B5C3A' }} />
      <View style={{ position: 'absolute', bottom: paneH * 0.33, right: paneW * 0.13, width: 40, height: 40, borderRadius: 20, backgroundColor: '#5A9E55' }} />
      <View style={{ position: 'absolute', bottom: paneH * 0.22, right: paneW * 0.05, width: 60, height: 40, backgroundColor: '#C0856A' }} />
      <View style={{ position: 'absolute', bottom: paneH * 0.355, right: paneW * 0.02, width: 0, height: 0, borderLeftWidth: 33, borderRightWidth: 33, borderBottomWidth: 22, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#A0654A' }} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW CONFIGURATOR
// ─────────────────────────────────────────────────────────────────────────────
interface ConfiguratorProps {
  colorName: string | null;
  category: string;
  productName: string;
  brandColor: string;
}

function WindowConfigurator({ colorName, category, productName, brandColor }: ConfiguratorProps) {
  const hex = colorName ? colorNameToHex(colorName) : '#E8DCC8';
  const isShutter = category === 'Shutter';
  const isCellular = category === 'Cellular';
  const isRoman = category === 'Roman';

  const nameLower = productName.toLowerCase();
  const isLightFiltering =
    nameLower.includes('sheer') ||
    nameLower.includes('light filter') ||
    nameLower.includes('solar') ||
    nameLower.includes('privacy') ||
    nameLower.includes('silhouette') ||
    nameLower.includes('pirouette') ||
    nameLower.includes('luminette');
  const isBlackout =
    nameLower.includes('blackout') ||
    nameLower.includes('room dark');

  const W = SCREEN_WIDTH - 64;
  const H = Math.round(W * 0.62);
  const FRAME = 14;
  const paneW = W - FRAME * 2;
  const paneH = H - FRAME * 2;

  const darken = (h: string, amount: number) => {
    const num = parseInt(h.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - amount);
    const g = Math.max(0, ((num >> 8) & 0xff) - amount);
    const b = Math.max(0, (num & 0xff) - amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };
  const shadeDark = darken(hex, 20);

  const renderBlindOverlay = (pW: number, pH: number) => {
    if (isShutter) {
      const slatCount = 8;
      const slatH = pH / slatCount;
      return Array.from({ length: slatCount }).map((_, i) => (
        <View key={i} style={{
          position: 'absolute', left: 0, right: 0,
          top: i * slatH, height: slatH - 1.5,
          backgroundColor: i % 2 === 0 ? hex : shadeDark,
          borderRadius: 2,
        }} />
      ));
    }
    if (isCellular) {
      const cellH = 18;
      const rows = Math.floor(pH / cellH);
      return Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={{
          position: 'absolute', left: 0, right: 0,
          top: i * cellH, height: cellH - 2,
          backgroundColor: hex,
          borderBottomWidth: 1.5, borderBottomColor: shadeDark,
        }} />
      ));
    }
    if (isRoman) {
      const foldCount = 5;
      const foldH = pH / foldCount;
      return Array.from({ length: foldCount }).map((_, i) => (
        <View key={i} style={{
          position: 'absolute', left: 0, right: 0,
          top: i * foldH, height: foldH,
          backgroundColor: i % 2 === 0 ? hex : shadeDark,
          borderBottomWidth: 2, borderBottomColor: 'rgba(0,0,0,0.08)',
        }} />
      ));
    }
    const lineCount = 20;
    const lineH = pH / lineCount;
    return (
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: hex }} />
        {Array.from({ length: lineCount }).map((_, i) => (
          <View key={i} style={{
            position: 'absolute', left: 0, right: 0,
            top: i * lineH, height: 0.5,
            backgroundColor: 'rgba(0,0,0,0.06)',
          }} />
        ))}
      </View>
    );
  };

  const modeLabel = isLightFiltering
    ? '☀️ Light filtering'
    : isBlackout
    ? '🌙 Blackout / Room darkening'
    : isShutter
    ? '🏠 Shutter'
    : isCellular
    ? '🔷 Cellular'
    : isRoman
    ? '📋 Roman'
    : '🪟 Standard';

  return (
    <View style={configuratorStyles.wrapper}>
      <View style={configuratorStyles.labelRow}>
        <View style={[configuratorStyles.colorDot, { backgroundColor: hex }]} />
        <Text style={configuratorStyles.colorLabel}>
          {colorName ?? 'Select a color to preview'}
        </Text>
        <Text style={[configuratorStyles.categoryTag, {
          color: brandColor,
          backgroundColor: brandColor + '1F',
        }]}>{category}</Text>
      </View>

      <View style={[configuratorStyles.frame, { width: W, height: H }]}>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#2C2C2C', borderRadius: 4 }} />
        <View style={{ position: 'absolute', top: FRAME, left: FRAME, right: FRAME, bottom: FRAME, overflow: 'hidden' }}>
          {isBlackout && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: hex }} />
          )}
          {!isBlackout && (
            <>
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                <OutdoorScene paneW={paneW} paneH={paneH} />
              </View>
              {isLightFiltering && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000000', opacity: 0.72 }} />
              )}
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', opacity: isLightFiltering ? 0.55 : 0.78 }}>
                {renderBlindOverlay(paneW, paneH)}
              </View>
              {isLightFiltering && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,240,200,0.08)' }} />
              )}
              <View style={{ position: 'absolute', top: 0, left: 0, width: paneW * 0.25, height: paneH, backgroundColor: 'rgba(255,255,255,0.04)' }} />
            </>
          )}
        </View>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 4, borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)' }} />
      </View>

      <Text style={configuratorStyles.productLabel} numberOfLines={1}>
        {modeLabel} · {productName}
      </Text>
    </View>
  );
}

const configuratorStyles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
    alignItems: 'center', backgroundColor: '#0A0F1E',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', gap: 10,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  colorDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  colorLabel: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  categoryTag: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  frame: { borderRadius: 4, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  productLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 11, alignSelf: 'flex-start', fontStyle: 'italic' },
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORIES = ['All', 'Roller', 'Shutter', 'Cellular', 'Roman', 'Natural', 'Other'];
const BRANDS = ['All Brands', 'Norman', 'Hunter Douglas', 'Other'];

function detectBrand(name: string): string {
  if (name.startsWith('Norman')) return 'Norman';
  const hd = ['Silhouette', 'Pirouette', 'Duette', 'Vignette', 'Provenance',
    'Luminette', 'Parkland', 'EverWood', 'Precious Metals', 'Palm Beach',
    'NewStyle', 'Sonnette', 'Designer Roller'];
  if (hd.some(k => name.includes(k))) return 'Hunter Douglas';
  return 'Other';
}

function categoryEmoji(cat: string) {
  const map: Record<string, string> = {
    Roller: '🪟', Shutter: '🏠', Cellular: '🔷', Roman: '📋',
    Natural: '🌿', Other: '🪞',
  };
  return map[cat] ?? '🪟';
}

function parseColors(raw: any): { name: string }[] {
  if (!raw) return [];
  let arr = raw;
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(arr)) return [];
  return arr.map((c: any) => typeof c === 'string' ? { name: c } : c);
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOM DETAIL SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function RoomDetailScreen({ route, navigation }: any) {
  const { roomId, roomName } = route.params;
  const { dealer } = useAuth();
  const { tenantConfig } = useTenant();

  const [windows, setWindows] = useState<WFWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [targetWindowId, setTargetWindowId] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeBrand, setActiveBrand] = useState('All Brands');

  const [colorPickerProduct, setColorPickerProduct] = useState<any | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  const [scopeVisible, setScopeVisible] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<{ id: string; name: string } | null>(null);

  const [assigning, setAssigning] = useState(false);
  const [toast, setToast] = useState('');

  const lastProductRef = useRef<{ id: string; name: string } | null>(null);
  const windowsRef = useRef<WFWindow[]>([]);
  windowsRef.current = windows;

  const brandColor = tenantConfig.primary_color;
  const productNoun = tenantConfig.product_noun;
  const productNounPlural = tenantConfig.product_noun_plural;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const loadWindows = async () => {
    if (!dealer) return;
    try {
      const rooms = await roomsService.getRooms(dealer.id);
      const room = rooms.find((r: any) => r.id === roomId);
      setWindows(room?.windows ?? []);
    } catch (e) {
      console.error('loadWindows', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadWindows(); }, [dealer, roomId]));

  const onRefresh = () => { setRefreshing(true); loadWindows(); };

  const openPicker = async (windowId: string) => {
    setTargetWindowId(windowId);
    setSearch('');
    setActiveCategory('All');
    setActiveBrand('All Brands');
    setColorPickerProduct(null);
    setSelectedColor(null);
    setPickerVisible(true);
    if (products.length === 0) {
      setProductsLoading(true);
      try {
        const data = await productsService.getDealerCatalog(dealer!.id);
        setProducts(data.filter((p: any) => p.is_visible !== false));
      } catch (e) { console.error('loadProducts', e); }
      finally { setProductsLoading(false); }
    }
  };

  const handleProductSelect = (product: any, color: string | null = null) => {
    const label = color ? `${product.name} — ${color}` : product.name;
    setPendingProduct({ id: product.id, name: label });
    setColorPickerProduct(null);
    setPickerVisible(false);
    setScopeVisible(true);
    lastProductRef.current = { id: product.id, name: label };
  };

  const applyProduct = async (scope: 'single' | 'unassigned' | 'all') => {
    if (!pendingProduct || !dealer) return;
    setAssigning(true);
    setScopeVisible(false);
    try {
      let targetIds: string[] = [];
      const wins = windowsRef.current;
      if (scope === 'single') targetIds = [targetWindowId!];
      else if (scope === 'unassigned') targetIds = wins.filter(w => !w.product_id).map(w => w.id);
      else targetIds = wins.map(w => w.id);

      for (const id of targetIds) {
        await supabase.from('windows').update({ product_id: pendingProduct.id }).eq('id', id);
      }
      await loadWindows();
      showToast(`✓ ${pendingProduct.name} applied to ${targetIds.length} ${targetIds.length > 1 ? productNounPlural : productNoun}`);
    } catch (e) {
      console.error('applyProduct', e);
    } finally {
      setAssigning(false);
      setPendingProduct(null);
    }
  };

  const removeProduct = async (windowId: string) => {
    try {
      await supabase.from('windows').update({ product_id: null }).eq('id', windowId);
      await loadWindows();
    } catch (e) { console.error('removeProduct', e); }
  };

  const deleteWindow = async (windowId: string) => {
    try {
      await roomsService.deleteWindow(windowId);
      setWindows(prev => prev.filter(w => w.id !== windowId));
    } catch (e) { console.error('deleteWindow', e); }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const quickApply = async (windowId: string) => {
    if (!lastProductRef.current) return;
    setPendingProduct(lastProductRef.current);
    setTargetWindowId(windowId);
    setScopeVisible(true);
  };

  const filteredProducts = products.filter(p => {
    if (activeCategory !== 'All' && p.category !== activeCategory) return false;
    if (activeBrand !== 'All Brands' && detectBrand(p.name) !== activeBrand) return false;
    if (search) {
      const q = search.toLowerCase();
      const inName = p.name.toLowerCase().includes(q);
      const inDesc = (p.description ?? '').toLowerCase().includes(q);
      const inColors = parseColors(p.available_colors).some((c: any) =>
        (typeof c === 'string' ? c : c.name).toLowerCase().includes(q)
      );
      if (!inName && !inDesc && !inColors) return false;
    }
    return true;
  });

  const unassignedCount = windows.filter(w => !w.product_id).length;

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={[styles.backBtnText, { color: brandColor }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{roomName}</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.centered}><ActivityIndicator color={brandColor} size="large" /></View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: brandColor }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{roomName}</Text>
        <View style={{ width: 60 }} />
      </View>

      {assigning && (
        <View style={[styles.assigningBanner, { backgroundColor: brandColor }]}>
          <ActivityIndicator color="white" size="small" />
          <Text style={styles.assigningText}>Applying product...</Text>
        </View>
      )}

      {toast ? (
        <View style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={brandColor} />}
      >
        {windows.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🪟</Text>
            <Text style={styles.emptyTitle}>No {cap(productNounPlural)} Yet</Text>
            <Text style={styles.emptyDesc}>Scan a {productNoun} and save it to this room to get started.</Text>
          </View>
        ) : (
          <>
            {lastProductRef.current && unassignedCount > 0 && (
              <View style={styles.lastProductBanner}>
                <Text style={styles.lastProductLabel}>Last used:</Text>
                <Text style={styles.lastProductName} numberOfLines={1}>{lastProductRef.current.name}</Text>
              </View>
            )}

            {windows.map(w => {
              const prod = (w as any).product;
              return (
                <View key={w.id} style={styles.windowCard}>
                  <View style={styles.windowCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.windowLabel}>{w.label}</Text>
                      <Text style={styles.windowMeta}>
                        {w.width_in}"×{w.height_in}" · {w.mount_type} mount
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => deleteWindow(w.id)} style={styles.deleteBtn}>
                      <Text style={styles.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  {prod ? (
                    <View style={[styles.productAssigned, { backgroundColor: brandColor + '14', borderColor: brandColor + '33' }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.productAssignedName}>{prod.name}</Text>
                        <View style={styles.brandRow}>
                          <View style={[styles.brandBadge, detectBrand(prod.name) === 'Hunter Douglas' && styles.brandBadgeHD]}>
                            <Text style={styles.brandBadgeText}>{detectBrand(prod.name) === 'Hunter Douglas' ? 'HD' : 'NWF'}</Text>
                          </View>
                          <Text style={[styles.productAssignedPrice, { color: brandColor }]}>
                            {prod.base_price_cents ? `$${(prod.base_price_cents / 100).toFixed(0)}` : ''}
                          </Text>
                        </View>
                      </View>
                      <View style={{ gap: 6 }}>
                        <TouchableOpacity style={[styles.changeBtn, { backgroundColor: brandColor + '26' }]} onPress={() => openPicker(w.id)}>
                          <Text style={[styles.changeBtnText, { color: brandColor }]}>Change</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.removeBtn} onPress={() => removeProduct(w.id)}>
                          <Text style={styles.removeBtnText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.productUnassigned}>
                      <TouchableOpacity style={[styles.assignBtn, { backgroundColor: brandColor }]} onPress={() => openPicker(w.id)}>
                        <Text style={styles.assignBtnText}>+ Assign Product</Text>
                      </TouchableOpacity>
                      {lastProductRef.current && (
                        <TouchableOpacity style={styles.quickApplyBtn} onPress={() => quickApply(w.id)}>
                          <Text style={styles.quickApplyText} numberOfLines={1}>
                            ↩ {lastProductRef.current.name.split(' — ')[0]}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })}

            {unassignedCount > 1 && lastProductRef.current && (
              <TouchableOpacity
                style={styles.applyAllBtn}
                onPress={() => {
                  setPendingProduct(lastProductRef.current!);
                  setTargetWindowId(null);
                  setScopeVisible(true);
                }}
              >
                <Text style={styles.applyAllBtnText}>
                  Apply last product to {unassignedCount} unassigned {productNounPlural} →
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Product Picker Modal ─────────────────────────────────── */}
      <Modal visible={pickerVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Product</Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setPickerVisible(false)}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalSearch}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={`Search products, colors, fabrics...`}
              placeholderTextColor="rgba(255,255,255,0.25)"
              style={styles.searchInput}
            />
          </View>

          {productsLoading ? (
            <View style={styles.centered}><ActivityIndicator color={brandColor} size="large" /></View>
          ) : (
            <FlatList
              data={filteredProducts}
              keyExtractor={p => p.id}
              contentContainerStyle={styles.productList}
              ListEmptyComponent={<Text style={styles.emptyText}>No products match your filters</Text>}
              ListHeaderComponent={
                <View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                    {BRANDS.map(brand => (
                      <TouchableOpacity
                        key={brand}
                        style={[styles.brandChip, activeBrand === brand && styles.brandChipActive]}
                        onPress={() => setActiveBrand(brand)}
                      >
                        <Text style={[styles.brandChipText, activeBrand === brand && styles.brandChipTextActive]}>
                          {brand}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
                    {CATEGORIES.map(cat => (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.catChip, activeCategory === cat && { backgroundColor: brandColor + '33', borderColor: brandColor }]}
                        onPress={() => setActiveCategory(cat)}
                      >
                        <Text style={[styles.catChipText, activeCategory === cat && { color: brandColor, fontWeight: '700' }]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              }
              renderItem={({ item: p }) => {
                const price = p.dealer_price_cents
                  ? (p.dealer_price_cents / 100).toFixed(0)
                  : p.base_price_cents ? (p.base_price_cents / 100).toFixed(0) : null;
                const brand = detectBrand(p.name);
                const colors = parseColors(p.available_colors);
                return (
                  <TouchableOpacity
                    style={styles.productRow}
                    onPress={() => {
                      if (colors.length > 0) {
                        setColorPickerProduct(p);
                        setSelectedColor(null);
                      } else {
                        handleProductSelect(p, null);
                      }
                    }}
                  >
                    <Text style={styles.productRowEmoji}>{categoryEmoji(p.category)}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.productRowName}>{p.name}</Text>
                        <View style={[styles.brandBadge, brand === 'Hunter Douglas' && styles.brandBadgeHD]}>
                          <Text style={styles.brandBadgeText}>{brand === 'Hunter Douglas' ? 'HD' : 'NWF'}</Text>
                        </View>
                      </View>
                      {p.description ? (
                        <Text style={styles.productRowDesc} numberOfLines={2}>{p.description}</Text>
                      ) : null}
                      {colors.length > 0 && (
                        <View style={{ flexDirection: 'row', gap: 4, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          {colors.slice(0, 8).map((c: any) => {
                            const cName = typeof c === 'string' ? c : c.name;
                            return (
                              <View key={cName} style={[styles.colorSwatch, { backgroundColor: colorNameToHex(cName) }]} />
                            );
                          })}
                          {colors.length > 8 && (
                            <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>+{colors.length - 8}</Text>
                          )}
                        </View>
                      )}
                    </View>
                    {price ? <Text style={[styles.productRowPrice, { color: brandColor }]}>${price}</Text> : null}
                  </TouchableOpacity>
                );
              }}
              ListFooterComponent={<View style={{ height: 40 }} />}
            />
          )}
        </View>
      </Modal>

      {/* ── Color Picker Modal with Configurator ─────────────────── */}
      <Modal visible={!!colorPickerProduct} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Select Color / Fabric</Text>
              {colorPickerProduct && (
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                  {colorPickerProduct.name}
                </Text>
              )}
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setColorPickerProduct(null)}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          {colorPickerProduct && (
            <WindowConfigurator
              colorName={selectedColor}
              category={colorPickerProduct.category ?? 'Roller'}
              productName={colorPickerProduct.name}
              brandColor={brandColor}
            />
          )}

          <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
            {parseColors(colorPickerProduct?.available_colors).map((c: any) => {
              const cName = typeof c === 'string' ? c : c.name;
              const cHex = colorNameToHex(cName);
              return (
                <TouchableOpacity
                  key={cName}
                  style={[styles.colorRow, selectedColor === cName && styles.colorRowActive]}
                  onPress={() => setSelectedColor(cName)}
                >
                  <View style={[styles.colorSwatchLarge, { backgroundColor: cHex }]} />
                  <Text style={styles.colorRowName}>{cName}</Text>
                  {selectedColor === cName && <Text style={{ color: '#30D158', fontSize: 20 }}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 100 }} />
          </ScrollView>

          <View style={{ padding: 16, paddingBottom: 40, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', gap: 10 }}>
            {selectedColor && (
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: brandColor }]}
                onPress={() => handleProductSelect(colorPickerProduct, selectedColor)}
              >
                <Text style={styles.confirmBtnText}>Use {selectedColor} →</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.skipColorBtn}
              onPress={() => handleProductSelect(colorPickerProduct, null)}
            >
              <Text style={styles.skipColorText}>Select Without Color</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Scope Chooser Modal ──────────────────────────────────── */}
      <Modal visible={scopeVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Apply To...</Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setScopeVisible(false)}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={{ padding: 20, gap: 12 }}>
            {pendingProduct && (
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 4 }}>
                {pendingProduct.name}
              </Text>
            )}
            <TouchableOpacity style={styles.scopeOption} onPress={() => applyProduct('single')}>
              <Text style={styles.scopeOptionTitle}>This {productNoun} only</Text>
              <Text style={styles.scopeOptionDesc}>Apply to the selected {productNoun}</Text>
            </TouchableOpacity>
            {unassignedCount > 1 && (
              <TouchableOpacity style={styles.scopeOption} onPress={() => applyProduct('unassigned')}>
                <Text style={styles.scopeOptionTitle}>All unassigned {productNounPlural}</Text>
                <Text style={styles.scopeOptionDesc}>{unassignedCount} {productNounPlural} without a product</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.scopeOption, styles.scopeOptionAll]} onPress={() => applyProduct('all')}>
              <Text style={styles.scopeOptionTitle}>All {windows.length} {productNounPlural} in room</Text>
              <Text style={styles.scopeOptionDesc}>Replaces existing assignments</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080C14' },
  header: {
    paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '800' },
  backBtn: { paddingVertical: 6, paddingRight: 12 },
  backBtnText: { fontSize: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 60, gap: 12 },
  assigningBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, paddingHorizontal: 20 },
  assigningText: { color: 'white', fontWeight: '600', fontSize: 14 },
  toast: { backgroundColor: '#30D158', marginHorizontal: 16, borderRadius: 12, padding: 12, alignItems: 'center' },
  toastText: { color: 'white', fontWeight: '700', fontSize: 13 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { color: 'white', fontSize: 20, fontWeight: '800' },
  emptyDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center', lineHeight: 22, maxWidth: 280 },
  lastProductBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(48,209,88,0.08)', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: 'rgba(48,209,88,0.2)' },
  lastProductLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  lastProductName: { color: '#30D158', fontSize: 12, fontWeight: '700', flex: 1 },
  windowCard: { backgroundColor: '#0D1520', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', gap: 12 },
  windowCardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  windowLabel: { color: 'white', fontSize: 16, fontWeight: '700' },
  windowMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  deleteBtn: { padding: 4 },
  deleteBtnText: { color: 'rgba(255,255,255,0.25)', fontSize: 16 },
  productAssigned: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 12, padding: 12, borderWidth: 1, gap: 10 },
  productAssignedName: { color: 'white', fontSize: 13, fontWeight: '600', flex: 1 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  productAssignedPrice: { fontSize: 13, fontWeight: '700' },
  changeBtn: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  changeBtnText: { fontSize: 12, fontWeight: '700' },
  removeBtn: { backgroundColor: 'rgba(255,69,58,0.1)', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  removeBtnText: { color: 'rgba(255,69,58,0.8)', fontSize: 12, fontWeight: '600' },
  productUnassigned: { flexDirection: 'row', gap: 10 },
  assignBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  assignBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  quickApplyBtn: { flex: 1, backgroundColor: 'rgba(48,209,88,0.1)', borderRadius: 12, paddingVertical: 12, alignItems: 'center', paddingHorizontal: 8, borderWidth: 1, borderColor: 'rgba(48,209,88,0.2)' },
  quickApplyText: { color: '#30D158', fontWeight: '600', fontSize: 12 },
  applyAllBtn: { backgroundColor: 'rgba(48,209,88,0.08)', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(48,209,88,0.2)' },
  applyAllBtnText: { color: '#30D158', fontSize: 12, fontWeight: '700' },
  modal: { flex: 1, backgroundColor: '#080C14' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  modalTitle: { color: 'white', fontSize: 18, fontWeight: '800' },
  modalCloseBtn: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  modalSearch: { padding: 16, paddingBottom: 8 },
  searchInput: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, color: 'white', fontSize: 15, padding: 12 },
  filterRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  brandChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  brandChipActive: { backgroundColor: 'rgba(255,214,10,0.15)', borderColor: '#FFD60A' },
  brandChipText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },
  brandChipTextActive: { color: '#FFD60A', fontWeight: '700' },
  categories: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  catChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  catChipText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },
  productList: { paddingHorizontal: 16, paddingTop: 4 },
  emptyText: { color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 40, fontSize: 14 },
  productRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', gap: 12 },
  productRowEmoji: { fontSize: 28, marginTop: 2 },
  productRowName: { color: 'white', fontSize: 14, fontWeight: '700', flexShrink: 1 },
  productRowDesc: { color: 'rgba(255,255,255,0.35)', fontSize: 11, lineHeight: 16, marginTop: 3 },
  productRowPrice: { fontWeight: '700', fontSize: 14, minWidth: 44, textAlign: 'right' },
  brandBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(48,209,88,0.15)' },
  brandBadgeHD: { backgroundColor: 'rgba(10,132,255,0.15)' },
  brandBadgeText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '700' },
  colorSwatch: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  colorSwatchLarge: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  colorRowActive: { borderColor: '#30D158', backgroundColor: 'rgba(48,209,88,0.08)' },
  colorRowName: { color: 'white', fontSize: 15, fontWeight: '600', flex: 1 },
  confirmBtn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  confirmBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  skipColorBtn: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  skipColorText: { color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 14 },
  scopeOption: { backgroundColor: '#0D1520', borderRadius: 14, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  scopeOptionAll: { borderColor: 'rgba(48,209,88,0.2)' },
  scopeOptionTitle: { color: 'white', fontWeight: '700', fontSize: 16, marginBottom: 4 },
  scopeOptionDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
});