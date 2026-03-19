import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, FlatList, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { roomsService, productsService, supabase } from '../lib/supabase';
import type { Window as WFWindow } from '../lib/supabase';

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

function parseColors(raw: any): { name: string; hex: string }[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

export default function RoomDetailScreen({ route, navigation }: any) {
  const { roomId, roomName } = route.params;
  const { dealer } = useAuth();

  const [windows, setWindows] = useState<WFWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Product picker
  const [pickerVisible, setPickerVisible] = useState(false);
  const [targetWindowId, setTargetWindowId] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeBrand, setActiveBrand] = useState('All Brands');

  // Color picker
  const [colorPickerProduct, setColorPickerProduct] = useState<any | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  // Scope chooser
  const [scopeVisible, setScopeVisible] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<{ id: string; name: string } | null>(null);

  const [assigning, setAssigning] = useState(false);
  const [toast, setToast] = useState('');

  const lastProductRef = useRef<{ id: string; name: string } | null>(null);
  const windowsRef = useRef<WFWindow[]>([]);
  windowsRef.current = windows;

  // ── Data ──────────────────────────────────────────────────────────

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
      showToast(`✓ ${pendingProduct.name} applied to ${targetIds.length} window${targetIds.length > 1 ? 's' : ''}`);
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

  // ── Quick-apply last product ──────────────────────────────────────

  const quickApply = async (windowId: string) => {
    if (!lastProductRef.current) return;
    setPendingProduct(lastProductRef.current);
    setTargetWindowId(windowId);
    setScopeVisible(true);
  };

  // ── Filtered products ─────────────────────────────────────────────

  const filteredProducts = products.filter(p => {
    if (activeCategory !== 'All' && p.category !== activeCategory) return false;
    if (activeBrand !== 'All Brands' && detectBrand(p.name) !== activeBrand) return false;
    if (search) {
      const q = search.toLowerCase();
      const inName = p.name.toLowerCase().includes(q);
      const inDesc = (p.description ?? '').toLowerCase().includes(q);
      const inColors = parseColors(p.available_colors).some((c: any) => c.name.toLowerCase().includes(q));
      if (!inName && !inDesc && !inColors) return false;
    }
    return true;
  });

  const unassignedCount = windows.filter(w => !w.product_id).length;

  // ── Render ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{roomName}</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.centered}><ActivityIndicator color="#0A84FF" size="large" /></View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{roomName}</Text>
        <View style={{ width: 60 }} />
      </View>

      {assigning && (
        <View style={styles.assigningBanner}>
          <ActivityIndicator color="white" size="small" />
          <Text style={styles.assigningText}>Applying product...</Text>
        </View>
      )}

      {toast ? (
        <View style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0A84FF" />}
      >
        {windows.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🪟</Text>
            <Text style={styles.emptyTitle}>No Windows Yet</Text>
            <Text style={styles.emptyDesc}>Scan a window and save it to this room to get started.</Text>
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
                    <View style={styles.productAssigned}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.productAssignedName}>{prod.name}</Text>
                        <View style={styles.brandRow}>
                          <View style={[styles.brandBadge, detectBrand(prod.name) === 'Hunter Douglas' && styles.brandBadgeHD]}>
                            <Text style={styles.brandBadgeText}>{detectBrand(prod.name) === 'Hunter Douglas' ? 'HD' : 'NWF'}</Text>
                          </View>
                          <Text style={styles.productAssignedPrice}>
                            {prod.base_price_cents ? `$${(prod.base_price_cents / 100).toFixed(0)}` : ''}
                          </Text>
                        </View>
                      </View>
                      <View style={{ gap: 6 }}>
                        <TouchableOpacity style={styles.changeBtn} onPress={() => openPicker(w.id)}>
                          <Text style={styles.changeBtnText}>Change</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.removeBtn} onPress={() => removeProduct(w.id)}>
                          <Text style={styles.removeBtnText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.productUnassigned}>
                      <TouchableOpacity style={styles.assignBtn} onPress={() => openPicker(w.id)}>
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
                  Apply last product to {unassignedCount} unassigned windows →
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

          {/* Search */}
          <View style={styles.modalSearch}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search products, colors, fabrics..."
              placeholderTextColor="rgba(255,255,255,0.25)"
              style={styles.searchInput}
            />
          </View>

          {productsLoading ? (
            <View style={styles.centered}><ActivityIndicator color="#0A84FF" size="large" /></View>
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
                        style={[styles.catChip, activeCategory === cat && styles.catChipActive]}
                        onPress={() => setActiveCategory(cat)}
                      >
                        <Text style={[styles.catChipText, activeCategory === cat && styles.catChipTextActive]}>
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
                          {colors.slice(0, 8).map((c: any) => (
                            <View key={c.name} style={[styles.colorSwatch, { backgroundColor: c.hex }]} />
                          ))}
                          {colors.length > 8 && (
                            <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>+{colors.length - 8}</Text>
                          )}
                        </View>
                      )}
                    </View>
                    {price ? <Text style={styles.productRowPrice}>${price}</Text> : null}
                  </TouchableOpacity>
                );
              }}
              ListFooterComponent={<View style={{ height: 40 }} />}
            />
          )}
        </View>
      </Modal>

      {/* ── Color / Fabric Picker Modal ──────────────────────────── */}
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

          <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
            {parseColors(colorPickerProduct?.available_colors).map((c: any) => (
              <TouchableOpacity
                key={c.name}
                style={[styles.colorRow, selectedColor === c.name && styles.colorRowActive]}
                onPress={() => setSelectedColor(c.name)}
              >
                <View style={[styles.colorSwatchLarge, { backgroundColor: c.hex }]} />
                <Text style={styles.colorRowName}>{c.name}</Text>
                {selectedColor === c.name && <Text style={{ color: '#30D158', fontSize: 20 }}>✓</Text>}
              </TouchableOpacity>
            ))}
            <View style={{ height: 100 }} />
          </ScrollView>

          <View style={{ padding: 16, paddingBottom: 40, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', gap: 10 }}>
            {selectedColor && (
              <TouchableOpacity
                style={styles.confirmBtn}
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
              <Text style={styles.scopeOptionTitle}>This window only</Text>
              <Text style={styles.scopeOptionDesc}>Apply to the selected window</Text>
            </TouchableOpacity>

            {unassignedCount > 1 && (
              <TouchableOpacity style={styles.scopeOption} onPress={() => applyProduct('unassigned')}>
                <Text style={styles.scopeOptionTitle}>All unassigned windows</Text>
                <Text style={styles.scopeOptionDesc}>{unassignedCount} windows without a product</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.scopeOption, styles.scopeOptionAll]} onPress={() => applyProduct('all')}>
              <Text style={styles.scopeOptionTitle}>All {windows.length} windows in room</Text>
              <Text style={styles.scopeOptionDesc}>Replaces existing assignments</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080C14' },
  header: {
    paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '800' },
  backBtn: { paddingVertical: 6, paddingRight: 12 },
  backBtnText: { color: '#0A84FF', fontSize: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 60, gap: 12 },

  assigningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#0A84FF', padding: 12, paddingHorizontal: 20,
  },
  assigningText: { color: 'white', fontWeight: '600', fontSize: 14 },

  toast: {
    backgroundColor: '#30D158', marginHorizontal: 16, borderRadius: 12,
    padding: 12, alignItems: 'center',
  },
  toastText: { color: 'white', fontWeight: '700', fontSize: 13 },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { color: 'white', fontSize: 20, fontWeight: '800' },
  emptyDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center', lineHeight: 22, maxWidth: 280 },

  lastProductBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(48,209,88,0.08)', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: 'rgba(48,209,88,0.2)',
  },
  lastProductLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  lastProductName: { color: '#30D158', fontSize: 12, fontWeight: '700', flex: 1 },

  windowCard: {
    backgroundColor: '#0D1520', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', gap: 12,
  },
  windowCardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  windowLabel: { color: 'white', fontSize: 16, fontWeight: '700' },
  windowMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  deleteBtn: { padding: 4 },
  deleteBtnText: { color: 'rgba(255,255,255,0.25)', fontSize: 16 },

  productAssigned: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: 'rgba(10,132,255,0.08)', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: 'rgba(10,132,255,0.2)', gap: 10,
  },
  productAssignedName: { color: 'white', fontSize: 13, fontWeight: '600', flex: 1 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  productAssignedPrice: { color: '#0A84FF', fontSize: 13, fontWeight: '700' },
  changeBtn: {
    backgroundColor: 'rgba(10,132,255,0.15)', borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 12,
  },
  changeBtnText: { color: '#0A84FF', fontSize: 12, fontWeight: '700' },
  removeBtn: {
    backgroundColor: 'rgba(255,69,58,0.1)', borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 12,
  },
  removeBtnText: { color: 'rgba(255,69,58,0.8)', fontSize: 12, fontWeight: '600' },

  productUnassigned: { flexDirection: 'row', gap: 10 },
  assignBtn: {
    flex: 1, backgroundColor: '#0A84FF', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
  },
  assignBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  quickApplyBtn: {
    flex: 1, backgroundColor: 'rgba(48,209,88,0.1)', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', paddingHorizontal: 8,
    borderWidth: 1, borderColor: 'rgba(48,209,88,0.2)',
  },
  quickApplyText: { color: '#30D158', fontWeight: '600', fontSize: 12 },

  applyAllBtn: {
    backgroundColor: 'rgba(48,209,88,0.08)', borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(48,209,88,0.2)',
  },
  applyAllBtnText: { color: '#30D158', fontSize: 12, fontWeight: '700' },

  // Modal
  modal: { flex: 1, backgroundColor: '#080C14' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: 24, borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: { color: 'white', fontSize: 18, fontWeight: '800' },
  modalCloseBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20,
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
  },
  modalCloseText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },

  modalSearch: { padding: 16, paddingBottom: 8 },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12,
    color: 'white', fontSize: 15, padding: 12,
  },

  // Brand filter
  filterRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  brandChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  brandChipActive: { backgroundColor: 'rgba(255,214,10,0.15)', borderColor: '#FFD60A' },
  brandChipText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },
  brandChipTextActive: { color: '#FFD60A', fontWeight: '700' },

  // Category filter
  categories: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  catChipActive: { backgroundColor: 'rgba(10,132,255,0.2)', borderColor: '#0A84FF' },
  catChipText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },
  catChipTextActive: { color: '#0A84FF', fontWeight: '700' },

  // Product list
  productList: { paddingHorizontal: 16, paddingTop: 4 },
  emptyText: { color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 40, fontSize: 14 },
  productRow: {
    flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', gap: 12,
  },
  productRowEmoji: { fontSize: 28, marginTop: 2 },
  productRowName: { color: 'white', fontSize: 14, fontWeight: '700', flexShrink: 1 },
  productRowDesc: { color: 'rgba(255,255,255,0.35)', fontSize: 11, lineHeight: 16, marginTop: 3 },
  productRowPrice: { color: '#0A84FF', fontWeight: '700', fontSize: 14, minWidth: 44, textAlign: 'right' },

  // Brand badges
  brandBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    backgroundColor: 'rgba(48,209,88,0.15)',
  },
  brandBadgeHD: { backgroundColor: 'rgba(10,132,255,0.15)' },
  brandBadgeText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '700' },

  // Color swatches
  colorSwatch: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  colorSwatchLarge: {
    width: 40, height: 40, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  colorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14,
    borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  colorRowActive: { borderColor: '#30D158', backgroundColor: 'rgba(48,209,88,0.08)' },
  colorRowName: { color: 'white', fontSize: 15, fontWeight: '600', flex: 1 },

  confirmBtn: {
    backgroundColor: '#0A84FF', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  confirmBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  skipColorBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
    paddingVertical: 13, alignItems: 'center',
  },
  skipColorText: { color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 14 },

  // Scope chooser
  scopeOption: {
    backgroundColor: '#0D1520', borderRadius: 14, padding: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  scopeOptionAll: { borderColor: 'rgba(48,209,88,0.2)' },
  scopeOptionTitle: { color: 'white', fontWeight: '700', fontSize: 16, marginBottom: 4 },
  scopeOptionDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
});