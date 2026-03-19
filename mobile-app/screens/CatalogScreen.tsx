import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { productsService } from '../lib/supabase';

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
    Roller: '🪟', Shutter: '🏠', Cellular: '🔷', Roman: '📋', Natural: '🌿', Other: '🪞',
  };
  return map[cat] ?? '🪟';
}

export default function CatalogScreen({ navigation }: any) {
  const { dealer } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeBrand, setActiveBrand] = useState('All Brands');
  const [motorizedOnly, setMotorizedOnly] = useState(false);
  const [search, setSearch] = useState('');

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

  const filtered = products.filter(p => {
    if (activeCategory !== 'All' && p.category !== activeCategory) return false;
    if (activeBrand !== 'All Brands' && detectBrand(p.name) !== activeBrand) return false;
    if (motorizedOnly && !p.is_motorized) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const priceFor = (p: any) => {
    if (p.dealer_price_cents) return (p.dealer_price_cents / 100).toFixed(0);
    return p.base_price_cents ? (p.base_price_cents / 100).toFixed(0) : '—';
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#0A84FF" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Products</Text>
        <TouchableOpacity
          style={[styles.motorFilter, motorizedOnly && styles.motorFilterActive]}
          onPress={() => setMotorizedOnly(!motorizedOnly)}
        >
          <Text style={[styles.motorFilterText, motorizedOnly && styles.motorFilterTextActive]}>⚙ Motorized</Text>
        </TouchableOpacity>
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {BRANDS.map(brand => (
                <TouchableOpacity
                  key={brand}
                  style={[styles.brandChip, activeBrand === brand && styles.brandChipActive]}
                  onPress={() => setActiveBrand(brand)}
                >
                  <Text style={[styles.brandChipText, activeBrand === brand && styles.brandChipTextActive]}>{brand}</Text>
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
                  <Text style={[styles.catChipText, activeCategory === cat && styles.catChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No products match your filters</Text>
          </View>
        }
        renderItem={({ item: p }) => {
          const brand = detectBrand(p.name);
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
                <Text style={styles.productMaterial}>{p.material}</Text>
                <View style={styles.productFooter}>
                  <Text style={styles.productPrice}>${priceFor(p)}</Text>
                  {p.dealer_price_cents && (
                    <Text style={styles.customPriceTag}>custom</Text>
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
  container: { flex: 1, backgroundColor: '#080C14' },
  centered: { flex: 1, backgroundColor: '#080C14', alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  motorFilter: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  motorFilterActive: { backgroundColor: 'rgba(48,209,88,0.15)', borderWidth: 1, borderColor: '#30D158' },
  motorFilterText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' },
  motorFilterTextActive: { color: '#30D158' },
  searchContainer: { paddingHorizontal: 20, marginBottom: 4 },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12,
    color: 'white', fontSize: 14, padding: 12,
  },
  filterRow: { paddingHorizontal: 20, gap: 8, paddingVertical: 12 },
  brandChip: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  brandChipActive: { backgroundColor: 'rgba(255,214,10,0.15)', borderColor: '#FFD60A' },
  brandChipText: { color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 13 },
  brandChipTextActive: { color: '#FFD60A', fontWeight: '700' },
  categories: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  catChip: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  catChipActive: { backgroundColor: '#0A84FF' },
  catChipText: { color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 13 },
  catChipTextActive: { color: 'white' },
  grid: { paddingHorizontal: 20, paddingBottom: 40 },
  row: { gap: 12, marginBottom: 12 },
  productCard: {
    flex: 1, backgroundColor: '#0D1520', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', overflow: 'hidden',
  },
  productImgArea: {
    backgroundColor: '#132030', paddingVertical: 24,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  productEmoji: { fontSize: 44 },
  motorBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: 'rgba(48,209,88,0.2)', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  motorBadgeText: { color: '#30D158', fontSize: 7, fontWeight: '800' },
  brandBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(48,209,88,0.15)', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  brandBadgeHD: { backgroundColor: 'rgba(10,132,255,0.15)' },
  brandBadgeText: { color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '800' },
  productInfo: { padding: 12 },
  productName: { color: 'white', fontWeight: '700', fontSize: 13, marginBottom: 2 },
  productMaterial: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginBottom: 8 },
  productFooter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  productPrice: { color: '#0A84FF', fontWeight: '800', fontSize: 15 },
  customPriceTag: {
    backgroundColor: 'rgba(10,132,255,0.15)', color: '#0A84FF',
    fontSize: 9, fontWeight: '700', paddingHorizontal: 5,
    paddingVertical: 2, borderRadius: 4,
  },
  emptyState: { alignItems: 'center', paddingTop: 40 },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 14 },
});