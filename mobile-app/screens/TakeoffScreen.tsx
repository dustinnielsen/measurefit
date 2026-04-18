import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, FlatList,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { quotesService, supabase } from '../lib/supabase';

const API_BASE = 'https://windowfit-production.up.railway.app';

type Phase = 'upload' | 'analyzing' | 'results';

interface TakeoffItem {
  id: string;
  room_name: string;
  room_number: string | null;
  tag: string | null;
  quantity: number;
  width_inches: number | null;
  height_inches: number | null;
  covering_type: string;
  mount_type: string | null;
  motor_type: string | null;
  opacity: string | null;
  fabric_spec: string | null;
  product_spec: string | null;
  sheet_ref: string;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
}

interface SizeGroup {
  key: string;
  width: number | null;
  height: number | null;
  count: number;
}

interface AnalysisResult {
  projectName: string;
  totalPages: number;
  pagesAnalyzed: number[];
  discoverSummary: string;
  itemCount: number;
  items: TakeoffItem[];
}

const CONFIDENCE_COLOR: Record<string, string> = {
  high: '#30D158',
  medium: '#FF9F0A',
  low: '#FF453A',
};

function fmtDim(w: number | null, h: number | null): string {
  if (w && h) return `${w}" × ${h}"`;
  if (w) return `${w}" W`;
  if (h) return `${h}" H`;
  return 'Dims TBD';
}

function buildSizeGroups(items: TakeoffItem[]): SizeGroup[] {
  const map = new Map<string, SizeGroup>();
  items.forEach(item => {
    const key = `${item.width_inches ?? '?'}x${item.height_inches ?? '?'}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += item.quantity || 1;
    } else {
      map.set(key, { key, width: item.width_inches, height: item.height_inches, count: item.quantity || 1 });
    }
  });
  return Array.from(map.values()).sort((a, b) => (b.count - a.count));
}

export default function TakeoffScreen({ navigation }: any) {
  const { dealer } = useAuth();
  const { tenantConfig } = useTenant();
  const brandColor = tenantConfig.primary_color;

  const [phase, setPhase] = useState<Phase>('upload');
  const [projectName, setProjectName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [items, setItems] = useState<TakeoffItem[]>([]);
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [error, setError] = useState('');
  const [progressText, setProgressText] = useState('');

  const handleFilePick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,application/pdf';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) setSelectedFile(file);
    };
    input.click();
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setError('');
    setProgressText('Uploading plan set…');
    setPhase('analyzing');
    try {
      const formData = new FormData();
      formData.append('pdf', selectedFile);
      if (projectName.trim()) formData.append('projectName', projectName.trim());

      // Start the job — returns immediately with a jobId
      const startRes = await fetch(`${API_BASE}/api/takeoff/analyze`, {
        method: 'POST',
        body: formData,
      });
      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}));
        throw new Error(err.error ?? `Server error ${startRes.status}`);
      }
      const { jobId } = await startRes.json();

      // Poll until done
      let done = false;
      while (!done) {
        await new Promise(r => setTimeout(r, 3000));
        const statusRes = await fetch(`${API_BASE}/api/takeoff/status/${jobId}`);
        if (!statusRes.ok) throw new Error('Lost connection to analysis job');
        const status = await statusRes.json();

        if (status.status === 'done') {
          done = true;
          const data = status.result;
          const tagged: TakeoffItem[] = (data.items ?? []).map((item: any, i: number) => ({
            ...item,
            id: `item-${i}`,
            quantity: item.quantity || 1,
          }));
          setResult(data);
          setItems(tagged);
          setPhase('results');
        } else if (status.status === 'error') {
          throw new Error(status.error ?? 'Analysis failed');
        } else {
          setProgressText(status.progress ?? 'Analyzing…');
        }
      }
    } catch (e: any) {
      setError(e.message ?? 'Analysis failed');
      setPhase('upload');
    }
  };

  const updateItem = (id: string, field: keyof TakeoffItem, value: any) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleCreateQuote = async () => {
    if (!dealer || items.length === 0) return;
    setCreatingQuote(true);
    try {
      const initials = dealer.logo_initials ?? 'QT';
      const quoteNumber = await quotesService.nextQuoteNumber(dealer.id, initials);

      const { data: quote, error: qErr } = await supabase
        .from('quotes')
        .insert({
          dealer_id: dealer.id,
          quote_number: quoteNumber,
          status: 'draft',
          subtotal_cents: 0,
          install_cents: 0,
          discount_cents: 0,
          tax_cents: 0,
          total_cents: 0,
          notes: result?.projectName ? `Takeoff: ${result.projectName}` : 'From Plan Takeoff',
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      if (qErr || !quote) throw qErr ?? new Error('Failed to create quote');

      const lineItems = items.map((item, i) => {
        const label = [item.room_name, item.room_number, item.tag ? `[${item.tag}]` : '']
          .filter(Boolean).join(' ').trim() || `Item ${i + 1}`;
        const specParts = [item.covering_type, item.fabric_spec, item.opacity, item.mount_type].filter(Boolean);
        return {
          quote_id: quote.id,
          product_name: item.covering_type || 'Window Covering',
          window_label: label,
          description: specParts.join(' · ') || null,
          mount_type: item.mount_type ?? null,
          width_in: item.width_inches ?? null,
          height_in: item.height_inches ?? null,
          unit_price_cents: 0,
          quote_price_cents: 0,
          quantity: item.quantity || 1,
          sort_order: i,
        };
      });

      const { error: liErr } = await supabase.from('quote_line_items').insert(lineItems);
      if (liErr) throw liErr;

      navigation.navigate('Quotes', { screen: 'QuoteBuilder', params: { quoteId: quote.id } });
    } catch (e: any) {
      window.alert(`Failed to create quote: ${e.message}`);
    } finally {
      setCreatingQuote(false);
    }
  };

  const handleReset = () => {
    setPhase('upload');
    setSelectedFile(null);
    setProjectName('');
    setResult(null);
    setItems([]);
    setError('');
    setProgressText('');
  };

  // ── ANALYZING ────────────────────────────────────────────────────────────────
  if (phase === 'analyzing') {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator color={brandColor} size="large" />
          <Text style={styles.analyzingTitle}>Analyzing your plan set…</Text>
          <Text style={styles.analyzingSub}>{progressText || 'Starting…'}</Text>
          <Text style={styles.analyzingSub2}>Scanning every page for windows and dimensions</Text>
          <Text style={styles.analyzingFile}>{selectedFile?.name}</Text>
        </View>
      </View>
    );
  }

  // ── RESULTS ──────────────────────────────────────────────────────────────────
  if (phase === 'results' && result) {
    const sizeGroups = buildSizeGroups(items);
    const totalUnits = items.reduce((s, i) => s + (i.quantity || 1), 0);
    const pagesLabel = result.pagesAnalyzed?.length
      ? `Pages analyzed: ${result.pagesAnalyzed.slice(0, 8).join(', ')}${result.pagesAnalyzed.length > 8 ? ` +${result.pagesAnalyzed.length - 8} more` : ''}`
      : `${result.totalPages} page document`;

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleReset} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← New</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{result.projectName || 'Takeoff Results'}</Text>
            <Text style={styles.headerSub}>{totalUnits} units · {items.length} locations · {pagesLabel}</Text>
          </View>
        </View>

        <FlatList
          data={items}
          keyExtractor={item => item.id}
          ListHeaderComponent={() => (
            <View>
              {/* Size Summary */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>SIZE SUMMARY</Text>
                {sizeGroups.map(g => (
                  <View key={g.key} style={styles.summaryRow}>
                    <Text style={styles.summaryDim}>{fmtDim(g.width, g.height)}</Text>
                    <View style={styles.summaryBar}>
                      <View style={[styles.summaryBarFill, { width: `${Math.min(100, (g.count / totalUnits) * 100)}%`, backgroundColor: brandColor }]} />
                    </View>
                    <Text style={styles.summaryCount}>×{g.count}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.sectionLabel}>ALL LOCATIONS</Text>
            </View>
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          renderItem={({ item, index }) => (
            <View style={styles.itemCard}>
              {/* Header row */}
              <View style={styles.itemCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemRoom}>
                    {item.room_name || `Item ${index + 1}`}
                    {item.room_number ? <Text style={styles.itemRoomNum}> · {item.room_number}</Text> : null}
                  </Text>
                  <View style={styles.itemTagRow}>
                    {item.tag ? <View style={styles.tagPill}><Text style={styles.tagPillText}>{item.tag}</Text></View> : null}
                    {item.sheet_ref ? <Text style={styles.sheetRef}>{item.sheet_ref}</Text> : null}
                  </View>
                </View>
                <View style={[styles.confidenceBadge, { borderColor: CONFIDENCE_COLOR[item.confidence] + '66' }]}>
                  <View style={[styles.confidenceDot, { backgroundColor: CONFIDENCE_COLOR[item.confidence] }]} />
                  <Text style={[styles.confidenceText, { color: CONFIDENCE_COLOR[item.confidence] }]}>{item.confidence}</Text>
                </View>
              </View>

              {/* Covering type */}
              <Text style={styles.itemCovering}>{item.covering_type || '—'}</Text>

              {/* Spec pills */}
              <View style={styles.specRow}>
                {item.motor_type ? <View style={styles.specPill}><Text style={styles.specPillText}>{item.motor_type}</Text></View> : null}
                {item.mount_type ? <View style={styles.specPill}><Text style={styles.specPillText}>{item.mount_type} mount</Text></View> : null}
                {item.opacity ? <View style={styles.specPill}><Text style={styles.specPillText}>{item.opacity}</Text></View> : null}
                {item.fabric_spec ? <View style={[styles.specPill, styles.specPillAccent]}><Text style={[styles.specPillText, { color: '#fff' }]}>{item.fabric_spec}</Text></View> : null}
              </View>

              {/* Dimensions + qty row */}
              <View style={styles.itemMeasRow}>
                <View style={styles.measField}>
                  <Text style={styles.measLabel}>WIDTH</Text>
                  <TextInput
                    style={styles.measInput}
                    value={item.width_inches != null ? String(item.width_inches) : ''}
                    placeholder="—"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    keyboardType="decimal-pad"
                    onChangeText={v => updateItem(item.id, 'width_inches', v ? parseFloat(v) : null)}
                  />
                  <Text style={styles.measUnit}>in</Text>
                </View>
                <Text style={styles.measX}>×</Text>
                <View style={styles.measField}>
                  <Text style={styles.measLabel}>HEIGHT</Text>
                  <TextInput
                    style={styles.measInput}
                    value={item.height_inches != null ? String(item.height_inches) : ''}
                    placeholder="—"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    keyboardType="decimal-pad"
                    onChangeText={v => updateItem(item.id, 'height_inches', v ? parseFloat(v) : null)}
                  />
                  <Text style={styles.measUnit}>in</Text>
                </View>
                <View style={[styles.measField, { maxWidth: 64 }]}>
                  <Text style={styles.measLabel}>QTY</Text>
                  <TextInput
                    style={styles.measInput}
                    value={String(item.quantity || 1)}
                    keyboardType="numeric"
                    onChangeText={v => updateItem(item.id, 'quantity', parseInt(v) || 1)}
                  />
                </View>
              </View>

              {/* Product spec */}
              {item.product_spec ? (
                <Text style={styles.productSpec}>📦 {item.product_spec}</Text>
              ) : null}

              {/* Notes */}
              {item.notes ? <Text style={styles.itemNotes}>{item.notes}</Text> : null}
            </View>
          )}
        />

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: brandColor }, creatingQuote && styles.btnDisabled]}
            onPress={handleCreateQuote}
            disabled={creatingQuote}
          >
            {creatingQuote
              ? <ActivityIndicator color="white" size="small" />
              : <Text style={styles.createBtnText}>Create Quote — {totalUnits} units →</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── UPLOAD ───────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.uploadContent}>
        <Text style={styles.screenTitle}>Plan Takeoff</Text>
        <Text style={styles.screenSub}>Upload architectural plans and the tool automatically finds every window covering — sizes, quantities, and specs.</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Project Name (optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. 123 Main St"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={projectName}
            onChangeText={setProjectName}
          />
        </View>

        <TouchableOpacity style={styles.uploadBox} onPress={handleFilePick}>
          <Text style={styles.uploadIcon}>📄</Text>
          {selectedFile ? (
            <>
              <Text style={styles.uploadFileName}>{selectedFile.name}</Text>
              <Text style={styles.uploadFileSize}>{(selectedFile.size / 1024 / 1024).toFixed(1)} MB · tap to change</Text>
            </>
          ) : (
            <>
              <Text style={styles.uploadPrompt}>Tap to select PDF plan set</Text>
              <Text style={styles.uploadHint}>Supports architectural plans up to 100 MB</Text>
              <Text style={styles.uploadHint}>The tool scans the full document automatically</Text>
            </>
          )}
        </TouchableOpacity>

        {error ? <Text style={styles.errorText}>⚠ {error}</Text> : null}

        <TouchableOpacity
          style={[styles.analyzeBtn, { backgroundColor: brandColor }, !selectedFile && styles.btnDisabled]}
          onPress={handleAnalyze}
          disabled={!selectedFile}
        >
          <Text style={styles.analyzeBtnText}>Analyze Plan Set →</Text>
        </TouchableOpacity>

        <View style={styles.howItWorks}>
          <Text style={styles.howTitle}>How it works</Text>
          <Text style={styles.howStep}>1  Scans the full plan set to find window schedules and RCPs</Text>
          <Text style={styles.howStep}>2  Extracts every window covering — size, qty, spec, and location</Text>
          <Text style={styles.howStep}>3  Review results, adjust any dims, then create a quote in one tap</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0F1A' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  // Upload
  uploadContent: { padding: 24, paddingTop: 60, paddingBottom: 60 },
  screenTitle: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  screenSub: { fontSize: 15, color: 'rgba(255,255,255,0.5)', marginBottom: 32, lineHeight: 22 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  cardLabel: {
    fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.8, marginBottom: 8, textTransform: 'uppercase',
  },
  textInput: { fontSize: 16, color: '#FFFFFF', padding: 0 },
  uploadBox: {
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.12)', borderStyle: 'dashed',
    borderRadius: 16, padding: 40, alignItems: 'center', marginBottom: 24,
  },
  uploadIcon: { fontSize: 40, marginBottom: 12 },
  uploadPrompt: { fontSize: 17, fontWeight: '600', color: '#FFFFFF', marginBottom: 6 },
  uploadHint: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 2, textAlign: 'center' },
  uploadFileName: { fontSize: 15, fontWeight: '600', color: '#30D158', marginBottom: 4, textAlign: 'center' },
  uploadFileSize: { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  analyzeBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 32 },
  analyzeBtnText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  btnDisabled: { opacity: 0.4 },
  errorText: { color: '#FF453A', fontSize: 14, marginBottom: 16, textAlign: 'center' },
  howItWorks: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12,
    padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  howTitle: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase' },
  howStep: { fontSize: 14, color: 'rgba(255,255,255,0.55)', marginBottom: 6, lineHeight: 20 },

  // Analyzing
  analyzingTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginTop: 24, marginBottom: 8 },
  analyzingSub: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  analyzingSub2: { fontSize: 13, color: 'rgba(255,255,255,0.3)', marginBottom: 12 },
  analyzingFile: { fontSize: 12, color: 'rgba(255,255,255,0.25)' },

  // Results header
  header: {
    flexDirection: 'row', alignItems: 'center', paddingTop: 56,
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)', gap: 12,
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  backBtnText: { color: '#0A84FF', fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 },

  // Size summary
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14,
    marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  summaryTitle: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7, gap: 10 },
  summaryDim: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', width: 90 },
  summaryBar: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2 },
  summaryBarFill: { height: 4, borderRadius: 2 },
  summaryCount: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)', width: 28, textAlign: 'right' },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },

  // Item cards
  itemCard: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  itemCardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  itemRoom: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  itemRoomNum: { fontSize: 14, fontWeight: '400', color: 'rgba(255,255,255,0.5)' },
  itemTagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  tagPill: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tagPillText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  sheetRef: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  confidenceBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
  confidenceDot: { width: 6, height: 6, borderRadius: 3 },
  confidenceText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  itemCovering: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 8, textTransform: 'capitalize' },
  specRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  specPill: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  specPillAccent: { backgroundColor: 'rgba(37,99,235,0.25)', borderColor: 'rgba(37,99,235,0.4)' },
  specPillText: { fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },

  // Dimension inputs
  itemMeasRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 8 },
  measField: { flex: 1 },
  measLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: 0.8, marginBottom: 4 },
  measInput: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 6, padding: 8,
    fontSize: 15, fontWeight: '600', color: '#FFFFFF', textAlign: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  measUnit: { fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 2 },
  measX: { color: 'rgba(255,255,255,0.3)', fontSize: 16, paddingBottom: 18 },
  productSpec: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 },
  itemNotes: { fontSize: 12, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', lineHeight: 17, marginTop: 2 },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, paddingBottom: 36, backgroundColor: '#0A0F1A',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
  },
  createBtn: { padding: 16, borderRadius: 12, alignItems: 'center' },
  createBtnText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
});
