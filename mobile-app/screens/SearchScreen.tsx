import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, FlatList,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { productsService, supabase } from '../lib/supabase';

interface Colorway { name: string; hex: string; }
interface FabricCollection {
  id: string; brand: string; product_type: string; collection_name: string;
  light_control: string; price_group: number; material: string; colorways: Colorway[];
}
interface CollectionResult { type: 'collection'; collection: FabricCollection; matchedColorways: Colorway[]; }
interface ProductResult    { type: 'product';    product: any; }
type SearchResult = CollectionResult | ProductResult;

function gradeColor(n: number) {
  switch (n) { case 1: return '#30D158'; case 2: return '#0A84FF'; case 3: return '#FF9F0A'; case 4: return '#FF453A'; default: return '#8E8E93'; }
}
function lcColor(lc: string) {
  switch (lc) { case 'light_filtering': return '#FFD60A'; case 'room_darkening': return '#FF9F0A'; case 'solar_screen': return '#30D158'; default: return '#8E8E93'; }
}
function lcLabel(lc: string) {
  switch (lc) { case 'light_filtering': return 'Light Filtering'; case 'room_darkening': return 'Room Darkening'; case 'solar_screen': return 'Solar Screen'; default: return lc; }
}
function productTypeLabel(pt: string) {
  switch (pt) { case 'roller_shade': return 'Roller Shade'; case 'cellular': return 'Cellular'; case 'roman': return 'Roman Shade'; case 'shutter': return 'Shutter'; case 'blind': return 'Blind'; case 'perfectsheer': return 'PerfectSheer'; default: return pt; }
}
function brandLabel(b: string) {
  switch (b) { case 'norman': return 'Norman'; case 'hunter_douglas': return 'Hunter Douglas'; default: return b; }
}
function detectBrand(name: string) {
  if (name.startsWith('Norman')) return 'Norman';
  const hd = ['Silhouette','Pirouette','Duette','Vignette','Provenance','Luminette','Parkland','EverWood','Precious Metals','Palm Beach','NewStyle','Sonnette','Designer Roller'];
  return hd.some(k => name.includes(k)) ? 'Hunter Douglas' : 'Other';
}
function categoryEmoji(cat: string) {
  return ({ Roller:'🪟', Shutter:'🏠', Cellular:'🔷', Roman:'📋', Natural:'🌿', Other:'🪞' } as any)[cat] ?? '🪟';
}
function opacityColor(level: string | null) {
  switch (level) { case 'light_filtering': return '#FFD60A'; case 'room_darkening': return '#FF9F0A'; case 'blackout': return '#FF453A'; default: return 'rgba(255,255,255,0.3)'; }
}

const BROWSE_SECTIONS = [
  { label: 'Norman Roller Shades',  brand: 'norman',         product_type: 'roller_shade', emoji: '🪟', sub: 'Light Filtering · Room Darkening · Solar Screen', comingSoon: false },
  { label: 'Norman Cellular Shades',brand: 'norman',         product_type: 'cellular',     emoji: '🔷', sub: 'Portrait Honeycomb — Coming soon',                  comingSoon: true  },
  { label: 'Norman Roman Shades',   brand: 'norman',         product_type: 'roman',        emoji: '📋', sub: 'Centerpiece — Coming soon',                          comingSoon: true  },
  { label: 'Norman Shutters',       brand: 'norman',         product_type: 'shutter',      emoji: '🏠', sub: 'Woodlore · Woodlore Plus · Hardwood — Coming soon',  comingSoon: true  },
  { label: 'Hunter Douglas',        brand: 'hunter_douglas', product_type: null,           emoji: '✦',  sub: 'Silhouette · Duette · Pirouette and more',           comingSoon: false },
];

export default function SearchScreen({ navigation }: any) {
  const { dealer }       = useAuth();
  const { tenantConfig } = useTenant();

  const [query, setQuery]             = useState('');
  const [collections, setCollections] = useState<FabricCollection[]>([]);
  const [products, setProducts]       = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [results, setResults]         = useState<SearchResult[]>([]);
  const [expandedCollection, setExpandedCollection] = useState<string | null>(null);
  const [browseBrand, setBrowseBrand]               = useState<string | null>(null);
  const [browseProductType, setBrowseProductType]   = useState<string | null>(null);
  const [browseLightControl, setBrowseLightControl] = useState<string | null>(null);

  const brandColor = tenantConfig.primary_color;

  useFocusEffect(useCallback(() => { loadData(); }, [dealer]));

  const loadData = async () => {
    if (!dealer) return;
    setDataLoading(true);
    try {
      const [colRes, prodData] = await Promise.all([
        supabase.from('fabric_collections').select('*').eq('is_active', true).order('price_group').order('collection_name'),
        productsService.getDealerCatalog(dealer.id),
      ]);
      setCollections(colRes.data ?? []);
      setProducts((prodData as any[]).filter((p: any) => p.is_visible !== false));
    } catch (e) { console.error('loadData', e); }
    finally { setDataLoading(false); }
  };

  useEffect(() => {
    if (!query.trim()) { setResults([]); setExpandedCollection(null); return; }
    const q = query.toLowerCase().trim();
    const withMatch: CollectionResult[] = [];
    const nameOnly:  CollectionResult[] = [];

    collections.forEach(c => {
      const nameMatch = c.collection_name.toLowerCase().includes(q) ||
        productTypeLabel(c.product_type).toLowerCase().includes(q) ||
        brandLabel(c.brand).toLowerCase().includes(q) ||
        lcLabel(c.light_control).toLowerCase().includes(q) ||
        (c.material ?? '').toLowerCase().includes(q);
      const matchedColorways = c.colorways.filter(cw => cw.name.toLowerCase().includes(q));
      if (matchedColorways.length > 0) withMatch.push({ type: 'collection', collection: c, matchedColorways });
      else if (nameMatch)              nameOnly.push({  type: 'collection', collection: c, matchedColorways: [] });
    });

    const prodResults: ProductResult[] = [];
    products.forEach(p => {
      if (p.name.startsWith('Norman')) return;
      const hit = p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        (p.fabric ?? '').toLowerCase().includes(q) ||
        (p.available_colors ?? []).some((c: any) => (typeof c === 'string' ? c : c.name ?? '').toLowerCase().includes(q));
      if (hit) prodResults.push({ type: 'product', product: p });
    });

    setResults([...withMatch, ...nameOnly, ...prodResults]);
  }, [query, collections, products]);

  const browseResults = collections.filter(c =>
    (!browseBrand || c.brand === browseBrand) &&
    (!browseProductType || c.product_type === browseProductType) &&
    (!browseLightControl || c.light_control === browseLightControl)
  );

  const browseLC = (browseBrand && browseProductType)
    ? [...new Set(collections.filter(c => c.brand === browseBrand && c.product_type === browseProductType).map(c => c.light_control))]
    : [];

  const collectionCount = results.filter(r => r.type === 'collection').length;
  const productCount    = results.filter(r => r.type === 'product').length;
  const resetBrowse = () => { setBrowseBrand(null); setBrowseProductType(null); setBrowseLightControl(null); };

  const hdProducts = products.filter(p => detectBrand(p.name) === 'Hunter Douglas');

  if (dataLoading) {
    return <View style={S.centered}><ActivityIndicator color={brandColor} size="large" /></View>;
  }

  const renderCollectionCard = (c: FabricCollection, matchedColorways: Colorway[] = []) => {
    const isExpanded = expandedCollection === c.id;
    const displayColorways = matchedColorways.length > 0 ? matchedColorways : c.colorways;
    return (
      <TouchableOpacity key={c.id} style={S.collectionCard} onPress={() => setExpandedCollection(isExpanded ? null : c.id)} activeOpacity={0.8}>
        <View style={S.swatchStrip}>
          {c.colorways.slice(0, 16).map((cw, i) => <View key={i} style={[S.stripSwatch, { backgroundColor: cw.hex }]} />)}
        </View>
        <View style={S.collectionBody}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={S.collectionName}>{c.collection_name}</Text>
              <View style={[S.lcPill, { backgroundColor: lcColor(c.light_control) + '22' }]}>
                <View style={[S.lcDot, { backgroundColor: lcColor(c.light_control) }]} />
                <Text style={[S.lcPillText, { color: lcColor(c.light_control) }]}>{lcLabel(c.light_control)}</Text>
              </View>
            </View>
            <Text style={S.collectionMeta}>
              {brandLabel(c.brand)} · {productTypeLabel(c.product_type)}
              {matchedColorways.length > 0
                ? ` · ${matchedColorways.length} matching color${matchedColorways.length !== 1 ? 's' : ''}`
                : ` · ${c.colorways.length} colors`}
            </Text>
            {c.material ? <Text style={S.collectionMaterial} numberOfLines={1}>{c.material}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={[S.gradeBadge, { backgroundColor: gradeColor(c.price_group) + '22' }]}>
              <Text style={[S.gradeBadgeText, { color: gradeColor(c.price_group) }]}>Grade {c.price_group}</Text>
            </View>
            <Text style={S.expandHint}>{isExpanded ? '▲ hide' : '▼ colors'}</Text>
          </View>
        </View>
        {isExpanded && (
          <View style={S.colorwayExpanded}>
            {displayColorways.map(cw => (
              <View key={cw.name} style={S.colorwayRow}>
                <View style={[S.colorwaySquare, { backgroundColor: cw.hex }]} />
                <Text style={S.colorwayName}>{cw.name}</Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderProductCard = (p: any) => {
    const brand   = detectBrand(p.name);
    const opColor = opacityColor(p.opacity_level);
    const price   = p.dealer_price_cents ? (p.dealer_price_cents / 100).toFixed(0) : p.base_price_cents ? (p.base_price_cents / 100).toFixed(0) : null;
    return (
      <View key={p.id} style={S.productCard}>
        <Text style={S.productEmoji}>{categoryEmoji(p.category)}</Text>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={S.productName}>{p.name}</Text>
            <View style={[S.brandBadge, brand === 'Hunter Douglas' && S.brandBadgeHD]}>
              <Text style={S.brandBadgeText}>{brand === 'Hunter Douglas' ? 'HD' : 'NWF'}</Text>
            </View>
          </View>
          {p.fabric && <Text style={S.productFabric}>{p.fabric}</Text>}
          {p.opacity_level && (
            <View style={[S.opacityPill, { backgroundColor: opColor + '22' }]}>
              <View style={[S.opacityDot, { backgroundColor: opColor }]} />
              <Text style={[S.opacityPillText, { color: opColor }]}>
                {p.opacity_level === 'light_filtering' ? 'Light Filtering' : p.opacity_level === 'room_darkening' ? 'Room Darkening' : 'Blackout'}
              </Text>
            </View>
          )}
        </View>
        {price && <Text style={[S.productPrice, { color: brandColor }]}>${price}</Text>}
      </View>
    );
  };

  return (
    <View style={S.container}>
      <View style={S.header}>
        <Text style={S.headerTitle}>Search</Text>
        {(query || browseBrand) ? (
          <TouchableOpacity onPress={() => { setQuery(''); resetBrowse(); }}>
            <Text style={[S.clearBtn, { color: brandColor }]}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={S.searchWrap}>
        <TextInput
          value={query} onChangeText={setQuery}
          placeholder="Search fabrics, collections, colorways..."
          placeholderTextColor="rgba(255,255,255,0.25)"
          style={S.searchInput} autoCorrect={false} autoCapitalize="none" returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity style={S.searchClear} onPress={() => setQuery('')}>
            <Text style={S.searchClearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* SEARCH RESULTS */}
      {query.trim().length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(item, i) => item.type === 'collection' ? item.collection.id : `prod-${(item as ProductResult).product.id}-${i}`}
          contentContainerStyle={S.resultsList}
          ListHeaderComponent={results.length > 0 ? (
            <View style={S.resultsHeader}>
              <Text style={S.resultsCount}>
                {collectionCount > 0 ? `${collectionCount} collection${collectionCount !== 1 ? 's' : ''}` : ''}
                {collectionCount > 0 && productCount > 0 ? ' · ' : ''}
                {productCount > 0 ? `${productCount} product${productCount !== 1 ? 's' : ''}` : ''}
              </Text>
            </View>
          ) : null}
          ListEmptyComponent={
            <View style={S.emptyState}>
              <Text style={S.emptyEmoji}>🔍</Text>
              <Text style={S.emptyTitle}>No results for "{query}"</Text>
              <Text style={S.emptyDesc}>Try a collection name, colorway, or product type</Text>
            </View>
          }
          renderItem={({ item }) => {
            if (item.type === 'collection') return renderCollectionCard(item.collection, item.matchedColorways);
            return renderProductCard((item as ProductResult).product);
          }}
          ListFooterComponent={<View style={{ height: 60 }} />}
        />

      ) : (
      /* BROWSE MODE */
        <ScrollView contentContainerStyle={S.browseContent}>

          {!browseBrand && (
            <>
              <Text style={S.browseLabel}>BROWSE BY CATEGORY</Text>
              {BROWSE_SECTIONS.map(sec => (
                <TouchableOpacity
                  key={`${sec.brand}-${sec.product_type}`}
                  style={[S.browseCard, sec.comingSoon && S.browseCardDim]}
                  onPress={() => {
                    if (sec.comingSoon) return;
                    setBrowseBrand(sec.brand);
                    setBrowseProductType(sec.product_type);
                  }}
                >
                  <Text style={S.browseCardEmoji}>{sec.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[S.browseCardLabel, sec.comingSoon && { color: 'rgba(255,255,255,0.3)' }]}>{sec.label}</Text>
                    <Text style={S.browseCardSub}>{sec.sub}</Text>
                  </View>
                  {sec.comingSoon ? <Text style={S.comingSoon}>Soon</Text> : <Text style={S.chevron}>›</Text>}
                </TouchableOpacity>
              ))}
              <View style={S.statsRow}>
                <View style={S.statCard}>
                  <Text style={[S.statNumber, { color: brandColor }]}>{collections.length}</Text>
                  <Text style={S.statLabel}>Collections</Text>
                </View>
                <View style={S.statCard}>
                  <Text style={[S.statNumber, { color: brandColor }]}>{collections.reduce((a, c) => a + c.colorways.length, 0)}</Text>
                  <Text style={S.statLabel}>Colorways</Text>
                </View>
                <View style={S.statCard}>
                  <Text style={[S.statNumber, { color: brandColor }]}>{hdProducts.length}</Text>
                  <Text style={S.statLabel}>HD Products</Text>
                </View>
              </View>
            </>
          )}

          {/* Norman — light control selection */}
          {browseBrand === 'norman' && browseProductType && !browseLightControl && (
            <>
              <View style={S.browseBackRow}>
                <TouchableOpacity onPress={() => { setBrowseBrand(null); setBrowseProductType(null); }}>
                  <Text style={[S.browseBack, { color: brandColor }]}>← All Categories</Text>
                </TouchableOpacity>
                <Text style={S.browseBackTitle}>{brandLabel(browseBrand)} {productTypeLabel(browseProductType)}</Text>
              </View>
              <Text style={S.browseLabel}>LIGHT CONTROL</Text>
              {browseLC.map(lc => {
                const count = collections.filter(c => c.brand === browseBrand && c.product_type === browseProductType && c.light_control === lc).length;
                return (
                  <TouchableOpacity key={lc} style={S.lcCard} onPress={() => setBrowseLightControl(lc)}>
                    <View style={[S.lcCardDot, { backgroundColor: lcColor(lc) }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={S.lcCardLabel}>{lcLabel(lc)}</Text>
                      <Text style={S.lcCardSub}>{count} collections</Text>
                    </View>
                    <Text style={S.chevron}>›</Text>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {/* Hunter Douglas */}
          {browseBrand === 'hunter_douglas' && (
            <>
              <View style={S.browseBackRow}>
                <TouchableOpacity onPress={() => setBrowseBrand(null)}>
                  <Text style={[S.browseBack, { color: brandColor }]}>← All Categories</Text>
                </TouchableOpacity>
                <Text style={S.browseBackTitle}>Hunter Douglas</Text>
              </View>
              <Text style={S.browseLabel}>{hdProducts.length} PRODUCTS</Text>
              {hdProducts.map(p => renderProductCard(p))}
            </>
          )}

          {/* Collections list */}
          {browseBrand === 'norman' && browseProductType && browseLightControl && (
            <>
              <View style={S.browseBackRow}>
                <TouchableOpacity onPress={() => setBrowseLightControl(null)}>
                  <Text style={[S.browseBack, { color: brandColor }]}>← Back</Text>
                </TouchableOpacity>
                <Text style={S.browseBackTitle} numberOfLines={1}>
                  {brandLabel(browseBrand)} · {productTypeLabel(browseProductType)} · {lcLabel(browseLightControl)}
                </Text>
              </View>
              <Text style={S.browseLabel}>{browseResults.length} COLLECTIONS</Text>
              {browseResults.map(c => renderCollectionCard(c))}
            </>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#0A0F1A' },
  centered:           { flex: 1, backgroundColor: '#0A0F1A', alignItems: 'center', justifyContent: 'center' },
  header:             { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle:        { color: 'white', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  clearBtn:           { fontSize: 14, fontWeight: '600' },
  searchWrap:         { marginHorizontal: 20, marginBottom: 12, position: 'relative' },
  searchInput:        { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 14, color: 'white', fontSize: 15, padding: 14, paddingRight: 44 },
  searchClear:        { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  searchClearText:    { color: 'rgba(255,255,255,0.4)', fontSize: 16 },
  resultsList:        { paddingHorizontal: 20, paddingBottom: 60 },
  resultsHeader:      { paddingVertical: 8 },
  resultsCount:       { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  emptyState:         { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyEmoji:         { fontSize: 44 },
  emptyTitle:         { color: 'white', fontSize: 18, fontWeight: '700' },
  emptyDesc:          { color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center' },
  collectionCard:     { backgroundColor: '#111827', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 10 },
  swatchStrip:        { flexDirection: 'row', height: 10 },
  stripSwatch:        { flex: 1 },
  collectionBody:     { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  collectionName:     { color: 'white', fontSize: 15, fontWeight: '700' },
  collectionMeta:     { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
  collectionMaterial: { color: 'rgba(255,255,255,0.25)', fontSize: 10, marginTop: 1 },
  gradeBadge:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  gradeBadgeText:     { fontSize: 10, fontWeight: '700' },
  expandHint:         { color: 'rgba(255,255,255,0.25)', fontSize: 10 },
  lcPill:             { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  lcDot:              { width: 6, height: 6, borderRadius: 3 },
  lcPillText:         { fontSize: 10, fontWeight: '700' },
  colorwayExpanded:   { paddingHorizontal: 14, paddingBottom: 14, gap: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 12 },
  colorwayRow:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  colorwaySquare:     { width: 28, height: 28, borderRadius: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  colorwayName:       { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '500' },
  productCard:        { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#111827', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 12, marginBottom: 10 },
  productEmoji:       { fontSize: 26, marginTop: 2 },
  productName:        { color: 'white', fontSize: 14, fontWeight: '700', flexShrink: 1 },
  productFabric:      { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
  productPrice:       { fontWeight: '800', fontSize: 14, minWidth: 44, textAlign: 'right' },
  brandBadge:         { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(48,209,88,0.15)' },
  brandBadgeHD:       { backgroundColor: 'rgba(10,132,255,0.15)' },
  brandBadgeText:     { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '700' },
  opacityPill:        { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, marginTop: 4 },
  opacityDot:         { width: 5, height: 5, borderRadius: 3 },
  opacityPillText:    { fontSize: 9, fontWeight: '700' },
  browseContent:      { padding: 20, gap: 10 },
  browseLabel:        { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4, marginTop: 8 },
  browseCard:         { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#111827', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  browseCardDim:      { opacity: 0.45 },
  browseCardEmoji:    { fontSize: 26, width: 36, textAlign: 'center' },
  browseCardLabel:    { color: 'white', fontSize: 15, fontWeight: '700' },
  browseCardSub:      { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 },
  comingSoon:         { color: 'rgba(255,255,255,0.25)', fontSize: 11, fontWeight: '600' },
  chevron:            { color: 'rgba(255,255,255,0.3)', fontSize: 20 },
  statsRow:           { flexDirection: 'row', gap: 10, marginTop: 8 },
  statCard:           { flex: 1, backgroundColor: '#111827', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  statNumber:         { fontSize: 22, fontWeight: '800' },
  statLabel:          { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
  browseBackRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  browseBack:         { fontSize: 13, fontWeight: '600' },
  browseBackTitle:    { color: 'rgba(255,255,255,0.4)', fontSize: 12, flex: 1, textAlign: 'right' },
  lcCard:             { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#111827', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  lcCardDot:          { width: 14, height: 14, borderRadius: 7, flexShrink: 0 },
  lcCardLabel:        { color: 'white', fontSize: 15, fontWeight: '700' },
  lcCardSub:          { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
});