import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { productsService } from '../lib/supabase';

export default function ProductDetailScreen({ route, navigation }: any) {
  const { productId } = route.params;
  const { dealer } = useAuth();
  const { tenantConfig } = useTenant();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedColor, setSelectedColor] = useState(0);

  const brandColor = tenantConfig.primary_color;

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const loadProduct = async () => {
    try {
      const catalog = await productsService.getDealerCatalog(dealer!.id);
      const p = catalog.find(p => p.id === productId);
      setProduct(p ?? null);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const price = product?.dealer_price_cents
    ? (product.dealer_price_cents / 100).toFixed(0)
    : product?.base_price_cents
      ? (product.base_price_cents / 100).toFixed(0)
      : null;

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={brandColor} size="large" /></View>;
  }

  if (!product) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFound}>Product not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.goBack, { color: brandColor }]}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.heroEmoji}>{categoryEmoji(product.category)}</Text>
          <Text style={styles.productName}>{product.name}</Text>
          <View style={styles.heroMeta}>
            <Text style={[styles.categoryTag, { color: brandColor }]}>{product.category}</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.material}>{product.material}</Text>
            {product.is_motorized && (
              <View style={styles.motorBadge}><Text style={styles.motorBadgeText}>MOTORIZED</Text></View>
            )}
          </View>
        </View>

        <View style={styles.body}>
          {product.description && (
            <Text style={styles.description}>{product.description}</Text>
          )}

          {product.colors?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Available Colors</Text>
              <View style={styles.colorRow}>
                {product.colors.map((c: string, i: number) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setSelectedColor(i)}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: c },
                      selectedColor === i && styles.colorSwatchSelected,
                    ]}
                  />
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Product Specs</Text>
            <View style={styles.specGrid}>
              {[
                ['Category', product.category],
                ['Material', product.material],
                ['Motorized', product.is_motorized ? 'Yes' : 'No'],
                ['Lead Time', '5–7 days'],
              ].map(([label, val]) => (
                <View key={label} style={styles.specCell}>
                  <Text style={styles.specLabel}>{label}</Text>
                  <Text style={styles.specVal}>{val}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.priceCard}>
            <View>
              <Text style={styles.priceAmount}>${price}</Text>
              <Text style={styles.priceUnit}>per {tenantConfig.product_noun} · custom cut</Text>
            </View>
            <View style={styles.stockBadge}>
              <Text style={styles.stockText}>✓ In Stock</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.addToQuoteBtn, { backgroundColor: brandColor }]}
            onPress={() => navigation.navigate('Quotes', {
              screen: 'QuoteBuilder',
              params: { productId: product.id, productName: product.name, price },
            })}
          >
            <Text style={styles.addToQuoteBtnText}>Add to Quote</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function categoryEmoji(cat: string) {
  const map: Record<string, string> = {
    Roller: '🪟', Shutter: '🏠', Cellular: '🔷', Roman: '📋', Natural: '🌿',
  };
  return map[cat] ?? '🪟';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0F1A' },
  centered: { flex: 1, backgroundColor: '#0A0F1A', alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFound: { color: 'rgba(255,255,255,0.5)', fontSize: 16 },
  goBack: { fontWeight: '600' },
  hero: {
    backgroundColor: '#0D1A2D', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 24,
    alignItems: 'center', gap: 8,
  },
  backBtn: {
    position: 'absolute', top: 60, left: 20,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { color: 'white', fontSize: 24, lineHeight: 30 },
  heroEmoji: { fontSize: 72, marginBottom: 8 },
  productName: { color: 'white', fontSize: 22, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryTag: { fontWeight: '600', fontSize: 13 },
  dot: { color: 'rgba(255,255,255,0.2)' },
  material: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  motorBadge: { backgroundColor: 'rgba(48,209,88,0.15)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  motorBadgeText: { color: '#30D158', fontSize: 9, fontWeight: '800' },
  body: { padding: 20, gap: 20 },
  description: { color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 22 },
  section: { gap: 12 },
  sectionLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  colorRow: { flexDirection: 'row', gap: 10 },
  colorSwatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)' },
  colorSwatchSelected: { borderColor: 'white', borderWidth: 3 },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  specCell: {
    flex: 1, minWidth: '45%', backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10, padding: 12,
  },
  specLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 10, marginBottom: 4 },
  specVal: { color: 'white', fontWeight: '600', fontSize: 14 },
  priceCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  priceAmount: { color: 'white', fontSize: 32, fontWeight: '800' },
  priceUnit: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  stockBadge: { backgroundColor: 'rgba(48,209,88,0.1)', borderRadius: 8, padding: 8 },
  stockText: { color: '#30D158', fontWeight: '700', fontSize: 12 },
  addToQuoteBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  addToQuoteBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
});