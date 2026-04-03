import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { productsService } from '../lib/supabase';

const CATEGORIES = ['All', 'Roller', 'Shutter', 'Cellular', 'Roman', 'Natural', 'Other'];
const BRANDS     = ['All Brands', 'Norman', 'Hunter Douglas', 'Other'];

const OPACITY_FILTERS = [
  { key: 'all',             label: 'All Opacity' },
  { key: 'light_filtering', label: 'Light Filtering' },
  { key: 'room_darkening',  label: 'Room Darkening' },
  { key: 'blackout',        label: 'Blackout' },
];

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
    Roller: '🪟', Shutter: '🏠', Cellular: '🔷', Roman: '📋', Natural: '🌿', Other: '🪞',
  };
  return map[cat] ?? '🪟';
}

function opacityColor(level: string | null) {
  switch (level) {
    case 'light_filtering': return '#FFD60A';
    case 'room_darkening':  return '#FF9F0A';
    case 'blackout':        return '#FF453A';
    default:                return 'rgba(255,255,255,0.3)';
  }
}

function opacityLabel(level: string | null) {
  switch (level) {
    case 'light_filtering': return 'Light';
    case 'room_darkening':  return 'R. Dark';
    case 'blackout':        return 'Blackout';
    default:                return '';
  }
}

export default function CatalogScreen({ navigation }: any) {
  const { dealer } = useAuth();
  const { tenantConfig } = useTenant();
  const [products, setProducts]       = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeBrand, setActiveBrand]       = useState('All Brands');
  const [activeOpacity, setActiveOpacity]   = useState('all');
  const [activeFabric, setActiveFabric]     = useState('All Fabrics');
  const [motorizedOnly, setMotorizedOnly]   = useState(false);
  const [search, setSearch]                 = useState('');

  const brandColor = tenantConfig.primary_color;

  useFocusEffect(useCallback(() => {
    if (dealer) loadCatalog();
  }, [dealer]));

  const loadCatalog = async () => {
    try {
      const data = await productsService.getDealerCatalog(dealer!.id);
      setProducts(data.filter((p: any) => p.is_visible));
    } catch (e) {
      console.error('Catalog load error:', e);
    } finally {
      setLoading(false);
    }
  };

  // ── Derived fabric list — only fabrics present after brand/category/opacity filters ──
  const availableFabrics = useMemo(() => {
    const preFiltered = products.filter(p => {
      if (activeCategory !== 'All' && p.category !== activeCategory) return false;
      if (activeBrand !== 'All Brands' && detectBrand(p.name) !== activeBrand) return false;
      if (activeOpacity !== 'all' && p.opacity_level !== activeOpacity) return false;
      return true;
    });
    const fabrics = Array.from(
      new Set(preFiltered.map((p: any) => p.fabric).filter(Boolean))
    ).sort() as string[];
    return ['All Fabrics', ...fabrics];
  }, [products, activeCategory, activeBrand, activeOpacity]);

  // Reset fabric selection if it's no longer available after other filter changes
  const effectiveFabric = availableFabrics.includes(activeFabric) ? activeFabric : 'All Fabrics';

  // ── Main filter logic ──────────────────────────────────────────────────────
  const filtered = products.filter(p => {
    if (activeCategory !== 'All' && p.category !== activeCategory) return false;
    if (activeBrand !== 'All Brands' && detectBrand(p.name) !== activeBrand) return false;
    if (activeOpacity !== 'all' && p.opacity_level !== activeOpacity) return false;
    if (effectiveFabric !== 'All Fabrics' && p.fabric !== effectiveFabric) return false;
    if (motorizedOnly && !p.is_motorized) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const priceFor = (p: any) => {
    if (p.dealer_price_cents) return (p.dealer_price_cents / 100).toFixed(0);
    return p.base_price_cents ? (p.base_price_cents / 100).toFixed(0) : '—';
  };

  const activeFilterCount = [
    activeCategory !== 'All',
    activeBrand !== 'All Brands',
    activeOpacity !== 'all',
    effectiveFabric !== 'All Fabrics',
    motorizedOnly,
  ].filter(Boolean).length;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={brandColor} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Products</Text>
          {activeFilterCount > 0 && (
            <Text style={styles.headerSub}>{filtered.length} of {products.length} shown</Text>
          )}
        </View>
        <View style={styles.headerRight}>
          {activeFilterCount > 0 && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => {
                setActiveCategory('All');
                setActiveBrand('All Brands');
                setActiveOpacity('all');
                setActiveFabric('All Fabrics');
                setMotorizedOnly(false);
                setSearch('');
              }}
            >
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.motorFilter, motorizedOnly && styles.motorFilterActive]}
            onPress={() => setMotorizedOnly(!motorizedOnly)}
          >
            <Text style={[styles.motorFilterText, motorizedOnly && styles.motorFilterTextActive]}>
              ⚙ Motorized
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search products..."
          placeholderTextColor="rgba(255,255,255,0.25)"
          style={styles.searchInput}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={p => p.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        ListHeaderComponent={
          <View>
            {/* Brand filter */}
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

            {/* Category filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, activeCategory === cat && { backgroundColor: brandColor }]}
                  onPress={() => setActiveCategory(cat)}
                >
                  <Text style={[styles.catChipText, activeCategory === cat && styles.catChipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Opacity filter */}
            <View style={styles.filterLabelRow}>
              <Text style={styles.filterLabel}>OPACITY</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {OPACITY_FILTERS.map(o => {
                const isActive = activeOpacity === o.key;
                const color = o.key === 'all' ? brandColor : opacityColor(o.key);
                return (
                  <TouchableOpacity
                    key={o.key}
                    style={[
                      styles.opacityChip,
                      isActive && { backgroundColor: color + '22', borderColor: color },
                    ]}
                    onPress={() => {
                      setActiveOpacity(o.key);
                      setActiveFabric('All Fabrics');
                    }}
                  >
                    {o.key !== 'all' && (
                      <View style={[styles.opacityDot, { backgroundColor: color }]} />
                    )}
                    <Text style={[
                      styles.opacityChipText,
                      isActive && { color, fontWeight: '700' },
                    ]}>
                      {o.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Fabric filter — only shown when fabrics are available */}
            {availableFabrics.length > 1 && (
              <>
                <View style={styles.filterLabelRow}>
                  <Text style={styles.filterLabel}>FABRIC</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterRow, { paddingBottom: 16 }]}>
                  {availableFabrics.map(fabric => {
                    const isActive = effectiveFabric === fabric;
                    return (
                      <TouchableOpacity
                        key={fabric}
                        style={[
                          styles.fabricChip,
                          isActive && { backgroundColor: brandColor + '22', borderColor: brandColor },
                        ]}
                        onPress={() => setActiveFabric(fabric)}
                      >
                        <Text style={[
                          styles.fabricChipText,
                          isActive && { color: brandColor, fontWeight: '700' },
                        ]}>
                          {fabric}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyText}>No products match your filters</Text>
            {activeFilterCount > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setActiveCategory('All');
                  setActiveBrand('All Brands');
                  setActiveOpacity('all');
                  setActiveFabric('All Fabrics');
                  setMotorizedOnly(false);
                  setSearch('');
                }}
              >
                <Text style={[styles.emptyAction, { color: brandColor }]}>Clear all filters</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item: p }) => {
          const brand = detectBrand(p.name);
          const opColor = opacityColor(p.opacity_level);
          const opLabel = opacityLabel(p.opacity_level);
          return (
            <TouchableOpacity
              style={styles.productCard}
              onPress={() => navigation.navigate('ProductDetail', { productId: p.id })}
            >
              <View style={styles.productImgArea}>
                <Text style={styles.productEmoji}>{categoryEmoji(p.category)}</Text>
                {p.is_motorized && (
                  <View style={styles.motorBadge}>
                    <Text style={styles.motorBadgeText}>MOTOR</Text>
                  </View>
                )}
                <View style={[styles.brandBadge, brand === 'Hunter Douglas' && styles.brandBadgeHD]}>
                  <Text style={styles.brandBadgeText}>
                    {brand === 'Hunter Douglas' ? 'HD' : brand === 'Norman' ? 'NWF' : '•'}
                  </Text>
                </View>
              </View>
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={2}>{p.name}</Text>
                {p.fabric && (
                  <Text style={styles.productFabric}>{p.fabric}</Text>
                )}
                <View style={styles.productMeta}>
                  {opLabel ? (
                    <View style={[styles.opacityPill, { backgroundColor: opColor + '22' }]}>
                      <View style={[styles.opacityPillDot, { backgroundColor: opColor }]} />
                      <Text style={[styles.opacityPillText, { color: opColor }]}>{opLabel}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.productFooter}>
                  <Text style={[styles.productPrice, { color: brandColor }]}>${priceFor(p)}</Text>
                  {p.dealer_price_cents && (
                    <Text style={[styles.customPriceTag, { color: brandColor, backgroundColor: brandColor + '26' }]}>
                      custom
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:              { flex: 1, backgroundColor: '#080C14' },
  centered:               { flex: 1, backgroundColor: '#080C14', alignItems: 'center', justifyContent: 'center' },
  header:                 { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle:            { color: 'white', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  headerSub:              { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 },
  headerRight:            { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clearBtn:               { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(255,69,58,0.12)', borderWidth: 1, borderColor: 'rgba(255,69,58,0.25)' },
  clearBtnText:           { color: '#FF453A', fontSize: 12, fontWeight: '600' },
  motorFilter:            { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)' },
  motorFilterActive:      { backgroundColor: 'rgba(48,209,88,0.15)', borderWidth: 1, borderColor: '#30D158' },
  motorFilterText:        { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' },
  motorFilterTextActive:  { color: '#30D158' },
  searchContainer:        { paddingHorizontal: 20, marginBottom: 4 },
  searchInput:            { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, color: 'white', fontSize: 14, padding: 12 },
  filterRow:              { paddingHorizontal: 20, gap: 8, paddingVertical: 8 },
  filterLabelRow:         { paddingHorizontal: 20, paddingTop: 4 },
  filterLabel:            { color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: '700', letterSpacing: 1 },

  // Brand chips
  brandChip:              { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  brandChipActive:        { backgroundColor: 'rgba(255,214,10,0.15)', borderColor: '#FFD60A' },
  brandChipText:          { color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 13 },
  brandChipTextActive:    { color: '#FFD60A', fontWeight: '700' },

  // Category chips
  catChip:                { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)' },
  catChipText:            { color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 13 },
  catChipTextActive:      { color: 'white', fontWeight: '700' },

  // Opacity chips
  opacityChip:            { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'transparent' },
  opacityChipText:        { color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 13 },
  opacityDot:             { width: 7, height: 7, borderRadius: 4 },

  // Fabric chips
  fabricChip:             { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  fabricChipText:         { color: 'rgba(255,255,255,0.45)', fontWeight: '600', fontSize: 12 },

  // Product grid
  grid:                   { paddingHorizontal: 20, paddingBottom: 40 },
  row:                    { gap: 12, marginBottom: 12 },
  productCard:            { flex: 1, backgroundColor: '#0D1520', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  productImgArea:         { backgroundColor: '#132030', paddingVertical: 24, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  productEmoji:           { fontSize: 44 },
  motorBadge:             { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(48,209,88,0.2)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  motorBadgeText:         { color: '#30D158', fontSize: 7, fontWeight: '800' },
  brandBadge:             { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(48,209,88,0.15)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  brandBadgeHD:           { backgroundColor: 'rgba(10,132,255,0.15)' },
  brandBadgeText:         { color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '800' },
  productInfo:            { padding: 12 },
  productName:            { color: 'white', fontWeight: '700', fontSize: 13, marginBottom: 2 },
  productFabric:          { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 4 },
  productMeta:            { marginBottom: 6 },
  opacityPill:            { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  opacityPillDot:         { width: 5, height: 5, borderRadius: 3 },
  opacityPillText:        { fontSize: 9, fontWeight: '700' },
  productFooter:          { flexDirection: 'row', alignItems: 'center', gap: 6 },
  productPrice:           { fontWeight: '800', fontSize: 15 },
  customPriceTag:         { fontSize: 9, fontWeight: '700', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },

  // Empty state
  emptyState:             { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyEmoji:             { fontSize: 40 },
  emptyText:              { color: 'rgba(255,255,255,0.3)', fontSize: 14 },
  emptyAction:            { fontSize: 14, fontWeight: '600', marginTop: 4 },
});