import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, FlatList, TextInput,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { roomsService, supabase } from '../lib/supabase';
import type { Window as WFWindow } from '../lib/supabase';

const SCREEN_WIDTH = Dimensions.get('window').width;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Colorway { name: string; hex: string; }
interface FabricCollection {
  id: string;
  brand: string;
  product_type: string;
  collection_name: string;
  light_control: 'light_filtering' | 'room_darkening' | 'solar_screen';
  price_group: number;
  material: string;
  colorways: Colorway[];
}
interface FabricSelection {
  collection: FabricCollection;
  colorway: Colorway;
}

type PickerStep = 'brand' | 'product_type' | 'light_control' | 'collection' | 'colorway';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const BRAND_OPTIONS = [
  { key: 'norman',         label: 'Norman',         badge: 'NWF' },
  { key: 'hunter_douglas', label: 'Hunter Douglas', badge: 'HD'  },
];

const PRODUCT_TYPE_OPTIONS = [
  { key: 'roller_shade', label: 'Roller Shade', emoji: '🪟' },
  { key: 'cellular',     label: 'Cellular',     emoji: '🔷' },
  { key: 'roman',        label: 'Roman Shade',  emoji: '📋' },
  { key: 'shutter',      label: 'Shutter',      emoji: '🏠' },
  { key: 'blind',        label: 'Blind',        emoji: '🔲' },
  { key: 'perfectsheer', label: 'PerfectSheer', emoji: '✨' },
];

const LIGHT_CONTROL_OPTIONS = [
  { key: 'light_filtering', label: 'Light Filtering', color: '#FFD60A', desc: 'Softens light, maintains view' },
  { key: 'room_darkening',  label: 'Room Darkening',  color: '#FF9F0A', desc: 'Blocks most incoming light'   },
  { key: 'solar_screen',    label: 'Solar Screen',    color: '#30D158', desc: 'UV protection, view-through'  },
];

function gradeLabel(n: number) { return `Grade ${n}`; }
function gradeColor(n: number) {
  switch (n) {
    case 1: return '#30D158';
    case 2: return '#0A84FF';
    case 3: return '#FF9F0A';
    case 4: return '#FF453A';
    default: return '#8E8E93';
  }
}
function lightControlLabel(lc: string) {
  switch (lc) {
    case 'light_filtering': return 'Light Filtering';
    case 'room_darkening':  return 'Room Darkening';
    case 'solar_screen':    return 'Solar Screen';
    default: return lc;
  }
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
function WindowConfigurator({ hex, lightControl, brandColor }: { hex: string; lightControl: string; brandColor: string }) {
  const isRoomDarkening  = lightControl === 'room_darkening';
  const isLightFiltering = !isRoomDarkening;
  const W = SCREEN_WIDTH - 64;
  const H = Math.round(W * 0.62);
  const FRAME = 14;
  const paneW = W - FRAME * 2;
  const paneH = H - FRAME * 2;
  const lineCount = 20;
  const lineH = paneH / lineCount;

  return (
    <View style={[cfgStyles.frame, { width: W, height: H }]}>
      <View style={{ position: 'absolute', inset: 0, backgroundColor: '#2C2C2C', borderRadius: 4 } as any} />
      <View style={{ position: 'absolute', top: FRAME, left: FRAME, right: FRAME, bottom: FRAME, overflow: 'hidden' }}>
        {isRoomDarkening ? (
          <View style={{ position: 'absolute', inset: 0, backgroundColor: hex } as any} />
        ) : (
          <>
            <OutdoorScene paneW={paneW} paneH={paneH} />
            <View style={{ position: 'absolute', inset: 0, backgroundColor: '#000', opacity: 0.65 } as any} />
            <View style={{ position: 'absolute', inset: 0, opacity: 0.55 } as any}>
              <View style={{ position: 'absolute', inset: 0, backgroundColor: hex } as any} />
              {Array.from({ length: lineCount }).map((_, i) => (
                <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: i * lineH, height: 0.5, backgroundColor: 'rgba(0,0,0,0.06)' }} />
              ))}
            </View>
          </>
        )}
      </View>
      <View style={{ position: 'absolute', inset: 0, borderRadius: 4, borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)' } as any} />
    </View>
  );
}

const cfgStyles = StyleSheet.create({
  frame: { borderRadius: 4, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
});

// ─────────────────────────────────────────────────────────────────────────────
// ROOM DETAIL SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function RoomDetailScreen({ route, navigation }: any) {
  const { roomId, roomName } = route.params;
  const { dealer }     = useAuth();
  const { tenantConfig } = useTenant();

  const [windows, setWindows]     = useState<WFWindow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Picker state
  const [pickerVisible, setPickerVisible]             = useState(false);
  const [targetWindowId, setTargetWindowId]           = useState<string | null>(null);
  const [fabricCollections, setFabricCollections]     = useState<FabricCollection[]>([]);
  const [collectionsLoading, setCollectionsLoading]   = useState(false);
  const [pickerStep, setPickerStep]                   = useState<PickerStep>('brand');
  const [selectedBrand, setSelectedBrand]             = useState<string | null>(null);
  const [selectedProductType, setSelectedProductType] = useState<string | null>(null);
  const [selectedLightControl, setSelectedLightControl] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection]   = useState<FabricCollection | null>(null);
  const [selectedColorway, setSelectedColorway]       = useState<Colorway | null>(null);
  const [fabricSearch, setFabricSearch]               = useState('');

  // Scope / apply state
  const [scopeVisible, setScopeVisible]       = useState(false);
  const [pendingSelection, setPendingSelection] = useState<FabricSelection | null>(null);
  const [assigning, setAssigning]             = useState(false);
  const [toast, setToast]                     = useState('');

  const lastSelectionRef = useRef<FabricSelection | null>(null);
  const windowsRef       = useRef<WFWindow[]>([]);
  windowsRef.current = windows;

  const brandColor        = tenantConfig.primary_color;
  const productNoun       = tenantConfig.product_noun;
  const productNounPlural = tenantConfig.product_noun_plural;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadWindows = async () => {
    if (!dealer) return;
    try {
      const rooms = await roomsService.getRooms(dealer.id);
      const room  = rooms.find((r: any) => r.id === roomId);
      setWindows(room?.windows ?? []);
    } catch (e) { console.error('loadWindows', e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { loadWindows(); }, [dealer, roomId]));
  const onRefresh = () => { setRefreshing(true); loadWindows(); };

  const loadCollections = async () => {
    if (fabricCollections.length > 0) return;
    setCollectionsLoading(true);
    try {
      const { data, error } = await supabase
        .from('fabric_collections')
        .select('*')
        .eq('is_active', true)
        .order('price_group')
        .order('collection_name');
      if (error) throw error;
      setFabricCollections(data ?? []);
    } catch (e) { console.error('loadCollections', e); }
    finally { setCollectionsLoading(false); }
  };

  // ── Picker helpers ─────────────────────────────────────────────────────────
  const openPicker = (windowId: string) => {
    setTargetWindowId(windowId);
    setPickerStep('brand');
    setSelectedBrand(null);
    setSelectedProductType(null);
    setSelectedLightControl(null);
    setSelectedCollection(null);
    setSelectedColorway(null);
    setFabricSearch('');
    setPickerVisible(true);
    loadCollections();
  };

  const goBack = () => {
    setFabricSearch('');
    if (pickerStep === 'colorway')     { setPickerStep('collection');   setSelectedColorway(null);     return; }
    if (pickerStep === 'collection')   { setPickerStep('light_control'); setSelectedCollection(null);   return; }
    if (pickerStep === 'light_control'){ setPickerStep('product_type');  setSelectedLightControl(null); return; }
    if (pickerStep === 'product_type') { setPickerStep('brand');         setSelectedProductType(null);  return; }
    setPickerVisible(false);
  };

  // Filtered collections for current brand + product type
  const collectionsForStep = useMemo(() =>
    fabricCollections.filter(c =>
      c.brand === selectedBrand && c.product_type === selectedProductType
    ),
  [fabricCollections, selectedBrand, selectedProductType]);

  // Search: collection name OR colorway name
  const searchResults = useMemo(() => {
    if (!fabricSearch.trim() || !selectedBrand || !selectedProductType) return null;
    const q = fabricSearch.toLowerCase();
    const out: { collection: FabricCollection; colorway: Colorway }[] = [];
    collectionsForStep.forEach(c => {
      c.colorways.forEach(cw => {
        if (c.collection_name.toLowerCase().includes(q) || cw.name.toLowerCase().includes(q)) {
          out.push({ collection: c, colorway: cw });
        }
      });
    });
    return out;
  }, [fabricSearch, collectionsForStep]);

  const collectionsForLC = useMemo(() =>
    collectionsForStep.filter(c => c.light_control === selectedLightControl),
  [collectionsForStep, selectedLightControl]);

  // ── Apply ──────────────────────────────────────────────────────────────────
  const confirmSelection = (collection: FabricCollection, colorway: Colorway) => {
    const sel: FabricSelection = { collection, colorway };
    setPendingSelection(sel);
    lastSelectionRef.current = sel;
    setPickerVisible(false);
    setScopeVisible(true);
  };

  const applySelection = async (scope: 'single' | 'unassigned' | 'all') => {
    if (!pendingSelection || !dealer) return;
    setAssigning(true);
    setScopeVisible(false);
    try {
      const wins = windowsRef.current;
      let ids: string[] = [];
      if (scope === 'single')      ids = [targetWindowId!];
      else if (scope === 'unassigned') ids = wins.filter((w: any) => !w.fabric_collection_name).map(w => w.id);
      else                         ids = wins.map(w => w.id);

      for (const id of ids) {
        await supabase.from('windows').update({
          fabric_collection_id:   pendingSelection.collection.id,
          fabric_collection_name: pendingSelection.collection.collection_name,
          fabric_colorway_name:   pendingSelection.colorway.name,
          fabric_colorway_hex:    pendingSelection.colorway.hex,
          fabric_price_group:     pendingSelection.collection.price_group,
          product_id: null,
        }).eq('id', id);
      }
      await loadWindows();
      showToast(`✓ ${selectionLabel(pendingSelection)} applied to ${ids.length} ${ids.length > 1 ? productNounPlural : productNoun}`);
    } catch (e) { console.error('applySelection', e); }
    finally { setAssigning(false); setPendingSelection(null); }
  };

  const removeSelection = async (windowId: string) => {
    try {
      await supabase.from('windows').update({
        fabric_collection_id: null, fabric_collection_name: null,
        fabric_colorway_name: null, fabric_colorway_hex: null,
        fabric_price_group: null,
      }).eq('id', windowId);
      await loadWindows();
    } catch (e) { console.error('removeSelection', e); }
  };

  const deleteWindow = async (windowId: string) => {
    try {
      await roomsService.deleteWindow(windowId);
      setWindows(prev => prev.filter(w => w.id !== windowId));
    } catch (e) { console.error('deleteWindow', e); }
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const quickApply = (windowId: string) => {
    if (!lastSelectionRef.current) return;
    setPendingSelection(lastSelectionRef.current);
    setTargetWindowId(windowId);
    setScopeVisible(true);
  };

  const selectionLabel = (sel: FabricSelection) =>
    `${sel.collection.collection_name} — ${sel.colorway.name}`;

  // Breadcrumb string
  const breadcrumb = () => {
    const parts: string[] = [];
    if (selectedBrand)        parts.push(selectedBrand === 'norman' ? 'Norman' : 'Hunter Douglas');
    if (selectedProductType)  parts.push(PRODUCT_TYPE_OPTIONS.find(p => p.key === selectedProductType)?.label ?? '');
    if (selectedLightControl) parts.push(lightControlLabel(selectedLightControl));
    if (selectedCollection)   parts.push(selectedCollection.collection_name);
    return parts.join(' › ');
  };

  const unassignedCount = windows.filter((w: any) => !w.fabric_collection_name).length;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={S.container}>
        <View style={S.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={S.backBtn}>
            <Text style={[S.backBtnText, { color: brandColor }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={S.headerTitle}>{roomName}</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={S.centered}><ActivityIndicator color={brandColor} size="large" /></View>
      </View>
    );
  }

  return (
    <View style={S.container}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={S.backBtn}>
          <Text style={[S.backBtnText, { color: brandColor }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={S.headerTitle}>{roomName}</Text>
        <View style={{ width: 60 }} />
      </View>

      {assigning && (
        <View style={[S.assigningBanner, { backgroundColor: brandColor }]}>
          <ActivityIndicator color="white" size="small" />
          <Text style={S.assigningText}>Applying selection...</Text>
        </View>
      )}
      {toast ? <View style={S.toast}><Text style={S.toastText}>{toast}</Text></View> : null}

      {/* ── Window list ── */}
      <ScrollView
        contentContainerStyle={S.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={brandColor} />}
      >
        {windows.length === 0 ? (
          <View style={S.emptyState}>
            <Text style={S.emptyEmoji}>🪟</Text>
            <Text style={S.emptyTitle}>No {cap(productNounPlural)} Yet</Text>
            <Text style={S.emptyDesc}>Scan a {productNoun} and save it to this room to get started.</Text>
          </View>
        ) : (
          <>
            {lastSelectionRef.current && unassignedCount > 0 && (
              <View style={S.lastBanner}>
                <View style={[S.lastSwatch, { backgroundColor: lastSelectionRef.current.colorway.hex }]} />
                <Text style={S.lastLabel}>Last:</Text>
                <Text style={S.lastName} numberOfLines={1}>{selectionLabel(lastSelectionRef.current)}</Text>
              </View>
            )}

            {windows.map(w => {
              const fw = w as any;
              const hasFabric = !!fw.fabric_collection_name;
              return (
                <View key={w.id} style={S.windowCard}>
                  <View style={S.windowCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={S.windowLabel}>{w.label}</Text>
                      <Text style={S.windowMeta}>{w.width_in}"×{w.height_in}" · {w.mount_type} mount</Text>
                    </View>
                    <TouchableOpacity onPress={() => deleteWindow(w.id)} style={S.deleteBtn}>
                      <Text style={S.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  {hasFabric ? (
                    <View style={[S.fabricAssigned, { backgroundColor: brandColor + '14', borderColor: brandColor + '33' }]}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          {fw.fabric_colorway_hex && (
                            <View style={[S.fabricColorSquare, { backgroundColor: fw.fabric_colorway_hex }]} />
                          )}
                          <Text style={S.fabricAssignedName} numberOfLines={2}>
                            {fw.fabric_collection_name} — {fw.fabric_colorway_name}
                          </Text>
                        </View>
                        {fw.fabric_price_group && (
                          <View style={[S.gradeBadge, { backgroundColor: gradeColor(fw.fabric_price_group) + '22' }]}>
                            <Text style={[S.gradeBadgeText, { color: gradeColor(fw.fabric_price_group) }]}>
                              {gradeLabel(fw.fabric_price_group)}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={{ gap: 6 }}>
                        <TouchableOpacity style={[S.changeBtn, { backgroundColor: brandColor + '26' }]} onPress={() => openPicker(w.id)}>
                          <Text style={[S.changeBtnText, { color: brandColor }]}>Change</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={S.removeBtn} onPress={() => removeSelection(w.id)}>
                          <Text style={S.removeBtnText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={S.unassigned}>
                      <TouchableOpacity style={[S.assignBtn, { backgroundColor: brandColor }]} onPress={() => openPicker(w.id)}>
                        <Text style={S.assignBtnText}>+ Select Fabric</Text>
                      </TouchableOpacity>
                      {lastSelectionRef.current && (
                        <TouchableOpacity style={S.quickApplyBtn} onPress={() => quickApply(w.id)}>
                          <View style={[S.quickSwatch, { backgroundColor: lastSelectionRef.current.colorway.hex }]} />
                          <Text style={S.quickApplyText} numberOfLines={1}>
                            ↩ {lastSelectionRef.current.collection.collection_name}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })}

            {unassignedCount > 1 && lastSelectionRef.current && (
              <TouchableOpacity
                style={S.applyAllBtn}
                onPress={() => { setPendingSelection(lastSelectionRef.current!); setTargetWindowId(null); setScopeVisible(true); }}
              >
                <Text style={S.applyAllBtnText}>
                  Apply last selection to {unassignedCount} unassigned {productNounPlural} →
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      {/* ════════════════════════════════════════════════════════════
          FABRIC PICKER MODAL
      ════════════════════════════════════════════════════════════ */}
      <Modal visible={pickerVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={S.modal}>
          {/* Header */}
          <View style={S.modalHeader}>
            <View style={{ flex: 1 }}>
              {pickerStep !== 'brand' && (
                <TouchableOpacity onPress={goBack} style={{ marginBottom: 4 }}>
                  <Text style={[S.backChevronText, { color: brandColor }]}>← Back</Text>
                </TouchableOpacity>
              )}
              <Text style={S.modalTitle}>
                {pickerStep === 'brand'         ? 'Select Brand'      :
                 pickerStep === 'product_type'  ? 'Product Type'      :
                 pickerStep === 'light_control' ? 'Light Control'     :
                 pickerStep === 'collection'    ? 'Select Collection' :
                                                  'Select Colorway'  }
              </Text>
              {breadcrumb() ? <Text style={S.breadcrumb} numberOfLines={1}>{breadcrumb()}</Text> : null}
            </View>
            <TouchableOpacity style={S.modalCloseBtn} onPress={() => setPickerVisible(false)}>
              <Text style={S.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search — visible from product_type onward */}
          {pickerStep !== 'brand' && (
            <View style={S.searchWrap}>
              <TextInput
                value={fabricSearch}
                onChangeText={setFabricSearch}
                placeholder="Search collection or colorway..."
                placeholderTextColor="rgba(255,255,255,0.25)"
                style={S.searchInput}
              />
            </View>
          )}

          {collectionsLoading ? (
            <View style={S.centered}><ActivityIndicator color={brandColor} size="large" /></View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>

              {/* Search results */}
              {fabricSearch.trim().length > 0 && searchResults !== null && (
                <>
                  <Text style={S.sectionLabel}>
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{fabricSearch}"
                  </Text>
                  {searchResults.length === 0
                    ? <Text style={S.emptyText}>No collections or colorways match</Text>
                    : searchResults.map((r, i) => (
                        <TouchableOpacity
                          key={`${r.collection.id}-${r.colorway.name}-${i}`}
                          style={S.searchResultRow}
                          onPress={() => confirmSelection(r.collection, r.colorway)}
                        >
                          <View style={[S.searchSwatch, { backgroundColor: r.colorway.hex }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={S.searchResultName}>{r.collection.collection_name} — {r.colorway.name}</Text>
                            <Text style={S.searchResultMeta}>{lightControlLabel(r.collection.light_control)} · {gradeLabel(r.collection.price_group)}</Text>
                          </View>
                          <View style={[S.gradeBadgeSmall, { backgroundColor: gradeColor(r.collection.price_group) + '22' }]}>
                            <Text style={[S.gradeBadgeSmallText, { color: gradeColor(r.collection.price_group) }]}>G{r.collection.price_group}</Text>
                          </View>
                        </TouchableOpacity>
                      ))
                  }
                </>
              )}

              {/* ── STEP: Brand ── */}
              {pickerStep === 'brand' && !fabricSearch.trim() && (
                <>
                  <Text style={S.sectionLabel}>WHO MAKES IT?</Text>
                  {BRAND_OPTIONS.map(b => (
                    <TouchableOpacity
                      key={b.key}
                      style={S.stepCard}
                      onPress={() => { setSelectedBrand(b.key); setPickerStep('product_type'); }}
                    >
                      <View style={[S.stepBadge, b.key === 'hunter_douglas' && S.stepBadgeHD]}>
                        <Text style={S.stepBadgeText}>{b.badge}</Text>
                      </View>
                      <Text style={S.stepCardLabel}>{b.label}</Text>
                      <Text style={S.chevron}>›</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* ── STEP: Product Type ── */}
              {pickerStep === 'product_type' && !fabricSearch.trim() && (
                <>
                  <Text style={S.sectionLabel}>WHAT TYPE OF COVERING?</Text>
                  {PRODUCT_TYPE_OPTIONS.map(pt => {
                    const has = fabricCollections.some(c => c.brand === selectedBrand && c.product_type === pt.key);
                    return (
                      <TouchableOpacity
                        key={pt.key}
                        style={[S.stepCard, !has && S.stepCardDisabled]}
                        onPress={() => { if (!has) return; setSelectedProductType(pt.key); setPickerStep('light_control'); }}
                      >
                        <Text style={{ fontSize: 24, width: 36, textAlign: 'center' }}>{pt.emoji}</Text>
                        <Text style={[S.stepCardLabel, !has && { color: 'rgba(255,255,255,0.3)' }]}>{pt.label}</Text>
                        {!has ? <Text style={S.comingSoon}>Coming soon</Text> : <Text style={S.chevron}>›</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}

              {/* ── STEP: Light Control ── */}
              {pickerStep === 'light_control' && !fabricSearch.trim() && (
                <>
                  <Text style={S.sectionLabel}>LIGHT CONTROL</Text>
                  {LIGHT_CONTROL_OPTIONS.map(lc => {
                    const count = collectionsForStep.filter(c => c.light_control === lc.key).length;
                    if (count === 0) return null;
                    return (
                      <TouchableOpacity
                        key={lc.key}
                        style={S.lcCard}
                        onPress={() => { setSelectedLightControl(lc.key); setPickerStep('collection'); }}
                      >
                        <View style={[S.lcDot, { backgroundColor: lc.color }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={S.lcLabel}>{lc.label}</Text>
                          <Text style={S.lcDesc}>{lc.desc}</Text>
                        </View>
                        <Text style={S.lcCount}>{count} collections</Text>
                        <Text style={S.chevron}>›</Text>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}

              {/* ── STEP: Collections ── */}
              {pickerStep === 'collection' && !fabricSearch.trim() && (
                <>
                  <Text style={S.sectionLabel}>{collectionsForLC.length} COLLECTIONS</Text>
                  {collectionsForLC.map(c => (
                    <TouchableOpacity
                      key={c.id}
                      style={S.collectionCard}
                      onPress={() => { setSelectedCollection(c); setSelectedColorway(null); setPickerStep('colorway'); }}
                    >
                      {/* Swatch strip */}
                      <View style={S.swatchStrip}>
                        {c.colorways.slice(0, 12).map((cw, i) => (
                          <View key={i} style={[S.stripSwatch, { backgroundColor: cw.hex }]} />
                        ))}
                      </View>
                      <View style={S.collectionBody}>
                        <View style={{ flex: 1 }}>
                          <Text style={S.collectionName}>{c.collection_name}</Text>
                          <Text style={S.collectionMat} numberOfLines={1}>{c.material}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <View style={[S.gradeBadge, { backgroundColor: gradeColor(c.price_group) + '22' }]}>
                            <Text style={[S.gradeBadgeText, { color: gradeColor(c.price_group) }]}>{gradeLabel(c.price_group)}</Text>
                          </View>
                          <Text style={S.colorCount}>{c.colorways.length} colors ›</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* ── STEP: Colorways ── */}
              {pickerStep === 'colorway' && selectedCollection && !fabricSearch.trim() && (
                <>
                  {/* Live preview */}
                  <View style={{ alignItems: 'center', marginBottom: 4 }}>
                    <WindowConfigurator
                      hex={selectedColorway?.hex ?? selectedCollection.colorways[0]?.hex ?? '#E8DCC8'}
                      lightControl={selectedCollection.light_control}
                      brandColor={brandColor}
                    />
                    <Text style={S.previewHint}>
                      {selectedColorway
                        ? `${selectedCollection.collection_name} — ${selectedColorway.name}`
                        : 'Tap a colorway to preview'}
                    </Text>
                  </View>

                  <Text style={S.sectionLabel}>
                    {selectedCollection.colorways.length} COLORWAYS · {gradeLabel(selectedCollection.price_group)}
                  </Text>

                  {selectedCollection.colorways.map(cw => (
                    <TouchableOpacity
                      key={cw.name}
                      style={[S.colorwayRow, selectedColorway?.name === cw.name && S.colorwayRowActive]}
                      onPress={() => setSelectedColorway(cw)}
                    >
                      <View style={[S.colorwaySquare, { backgroundColor: cw.hex }]} />
                      <Text style={S.colorwayName}>{cw.name}</Text>
                      {selectedColorway?.name === cw.name && <Text style={{ color: '#30D158', fontSize: 20 }}>✓</Text>}
                    </TouchableOpacity>
                  ))}

                  <View style={{ height: 16 }} />

                  {selectedColorway && (
                    <TouchableOpacity
                      style={[S.confirmBtn, { backgroundColor: brandColor }]}
                      onPress={() => confirmSelection(selectedCollection, selectedColorway)}
                    >
                      <View style={[S.confirmSwatch, { backgroundColor: selectedColorway.hex }]} />
                      <Text style={S.confirmBtnText}>
                        Use {selectedCollection.collection_name} — {selectedColorway.name}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={S.skipBtn}
                    onPress={() => {
                      const fb = selectedCollection.colorways[0];
                      if (fb) confirmSelection(selectedCollection, fb);
                    }}
                  >
                    <Text style={S.skipBtnText}>Select Without Specific Color</Text>
                  </TouchableOpacity>
                </>
              )}

              <View style={{ height: 60 }} />
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* ── Scope Modal ── */}
      <Modal visible={scopeVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={S.modal}>
          <View style={S.modalHeader}>
            <Text style={S.modalTitle}>Apply To...</Text>
            <TouchableOpacity style={S.modalCloseBtn} onPress={() => setScopeVisible(false)}>
              <Text style={S.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 20, gap: 12 }}>
            {pendingSelection && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <View style={[S.scopeSwatch, { backgroundColor: pendingSelection.colorway.hex }]} />
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, flex: 1 }} numberOfLines={1}>
                  {selectionLabel(pendingSelection)}
                </Text>
                <View style={[S.gradeBadge, { backgroundColor: gradeColor(pendingSelection.collection.price_group) + '22' }]}>
                  <Text style={[S.gradeBadgeText, { color: gradeColor(pendingSelection.collection.price_group) }]}>
                    {gradeLabel(pendingSelection.collection.price_group)}
                  </Text>
                </View>
              </View>
            )}
            <TouchableOpacity style={S.scopeOption} onPress={() => applySelection('single')}>
              <Text style={S.scopeTitle}>This {productNoun} only</Text>
              <Text style={S.scopeDesc}>Apply to the selected {productNoun}</Text>
            </TouchableOpacity>
            {unassignedCount > 1 && (
              <TouchableOpacity style={S.scopeOption} onPress={() => applySelection('unassigned')}>
                <Text style={S.scopeTitle}>All unassigned {productNounPlural}</Text>
                <Text style={S.scopeDesc}>{unassignedCount} {productNounPlural} without a selection</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[S.scopeOption, S.scopeOptionAll]} onPress={() => applySelection('all')}>
              <Text style={S.scopeTitle}>All {windows.length} {productNounPlural} in room</Text>
              <Text style={S.scopeDesc}>Replaces existing selections</Text>
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
const S = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#080C14' },
  header:           { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle:      { color: 'white', fontSize: 18, fontWeight: '800' },
  backBtn:          { paddingVertical: 6, paddingRight: 12 },
  backBtnText:      { fontSize: 16 },
  centered:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content:          { padding: 16, paddingBottom: 60, gap: 12 },
  assigningBanner:  { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, paddingHorizontal: 20 },
  assigningText:    { color: 'white', fontWeight: '600', fontSize: 14 },
  toast:            { backgroundColor: '#30D158', marginHorizontal: 16, borderRadius: 12, padding: 12, alignItems: 'center' },
  toastText:        { color: 'white', fontWeight: '700', fontSize: 13 },
  emptyState:       { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyEmoji:       { fontSize: 56 },
  emptyTitle:       { color: 'white', fontSize: 20, fontWeight: '800' },
  emptyDesc:        { color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center', lineHeight: 22, maxWidth: 280 },

  lastBanner:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(48,209,88,0.08)', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: 'rgba(48,209,88,0.2)' },
  lastSwatch:       { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  lastLabel:        { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  lastName:         { color: '#30D158', fontSize: 12, fontWeight: '700', flex: 1 },

  windowCard:       { backgroundColor: '#0D1520', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', gap: 12 },
  windowCardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  windowLabel:      { color: 'white', fontSize: 16, fontWeight: '700' },
  windowMeta:       { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  deleteBtn:        { padding: 4 },
  deleteBtnText:    { color: 'rgba(255,255,255,0.25)', fontSize: 16 },

  fabricAssigned:   { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 12, padding: 12, borderWidth: 1, gap: 10 },
  fabricAssignedName:{ color: 'white', fontSize: 13, fontWeight: '600', flex: 1 },
  fabricColorSquare:{ width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', flexShrink: 0 },
  gradeBadge:       { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  gradeBadgeText:   { fontSize: 10, fontWeight: '700' },
  changeBtn:        { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  changeBtnText:    { fontSize: 12, fontWeight: '700' },
  removeBtn:        { backgroundColor: 'rgba(255,69,58,0.1)', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  removeBtnText:    { color: 'rgba(255,69,58,0.8)', fontSize: 12, fontWeight: '600' },

  unassigned:       { flexDirection: 'row', gap: 10 },
  assignBtn:        { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  assignBtnText:    { color: 'white', fontWeight: '700', fontSize: 14 },
  quickApplyBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(48,209,88,0.1)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 8, borderWidth: 1, borderColor: 'rgba(48,209,88,0.2)' },
  quickSwatch:      { width: 14, height: 14, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  quickApplyText:   { color: '#30D158', fontWeight: '600', fontSize: 12 },
  applyAllBtn:      { backgroundColor: 'rgba(48,209,88,0.08)', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(48,209,88,0.2)' },
  applyAllBtnText:  { color: '#30D158', fontSize: 12, fontWeight: '700' },

  modal:            { flex: 1, backgroundColor: '#080C14' },
  modalHeader:      { padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', alignItems: 'flex-start' },
  modalTitle:       { color: 'white', fontSize: 18, fontWeight: '800' },
  modalCloseBtn:    { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  modalCloseText:   { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  searchWrap:       { padding: 16, paddingBottom: 4 },
  searchInput:      { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, color: 'white', fontSize: 15, padding: 12 },
  backChevronText:  { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  breadcrumb:       { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 },
  sectionLabel:     { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 },
  emptyText:        { color: 'rgba(255,255,255,0.3)', textAlign: 'center', paddingVertical: 24, fontSize: 14 },

  stepCard:         { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#0D1520', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  stepCardDisabled: { opacity: 0.4 },
  stepBadge:        { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(48,209,88,0.15)', alignItems: 'center', justifyContent: 'center' },
  stepBadgeHD:      { backgroundColor: 'rgba(10,132,255,0.15)' },
  stepBadgeText:    { color: 'white', fontSize: 10, fontWeight: '800' },
  stepCardLabel:    { flex: 1, color: 'white', fontSize: 16, fontWeight: '700' },
  chevron:          { color: 'rgba(255,255,255,0.3)', fontSize: 20 },
  comingSoon:       { color: 'rgba(255,255,255,0.25)', fontSize: 11, fontWeight: '600' },

  lcCard:           { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#0D1520', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  lcDot:            { width: 14, height: 14, borderRadius: 7, flexShrink: 0 },
  lcLabel:          { color: 'white', fontSize: 15, fontWeight: '700' },
  lcDesc:           { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  lcCount:          { color: 'rgba(255,255,255,0.3)', fontSize: 11 },

  collectionCard:   { backgroundColor: '#0D1520', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  swatchStrip:      { flexDirection: 'row', height: 10 },
  stripSwatch:      { flex: 1 },
  collectionBody:   { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  collectionName:   { color: 'white', fontSize: 15, fontWeight: '700' },
  collectionMat:    { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 },
  colorCount:       { color: 'rgba(255,255,255,0.3)', fontSize: 11 },

  colorwayRow:      { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  colorwayRowActive:{ borderColor: '#30D158', backgroundColor: 'rgba(48,209,88,0.08)' },
  colorwaySquare:   { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', flexShrink: 0 },
  colorwayName:     { flex: 1, color: 'white', fontSize: 15, fontWeight: '600' },
  previewHint:      { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 8, fontStyle: 'italic' },

  confirmBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 14, paddingVertical: 15 },
  confirmSwatch:    { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  confirmBtnText:   { color: 'white', fontWeight: '700', fontSize: 15 },
  skipBtn:          { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  skipBtnText:      { color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 14 },

  searchResultRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#0D1520', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  searchSwatch:     { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', flexShrink: 0 },
  searchResultName: { color: 'white', fontSize: 14, fontWeight: '600' },
  searchResultMeta: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 },
  gradeBadgeSmall:  { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  gradeBadgeSmallText:{ fontSize: 9, fontWeight: '700' },

  scopeSwatch:      { width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', flexShrink: 0 },
  scopeOption:      { backgroundColor: '#0D1520', borderRadius: 14, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  scopeOptionAll:   { borderColor: 'rgba(48,209,88,0.2)' },
  scopeTitle:       { color: 'white', fontWeight: '700', fontSize: 16, marginBottom: 4 },
  scopeDesc:        { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
});