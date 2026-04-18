import React, { useState, useRef } from 'react';
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
  room_number: string;
  tag: string;
  quantity: number;
  width_inches: number | null;
  height_inches: number | null;
  covering_type: string;
  sheet_ref: string;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
}

interface AnalysisResult {
  projectName: string;
  totalPages: number;
  pagesAnalyzed: number;
  itemCount: number;
  items: TakeoffItem[];
}

const CONFIDENCE_COLOR: Record<string, string> = {
  high: '#30D158',
  medium: '#FF9F0A',
  low: '#FF453A',
};

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

  const fileInputRef = useRef<any>(null);

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
    setPhase('analyzing');

    try {
      const formData = new FormData();
      formData.append('pdf', selectedFile);
      if (projectName.trim()) formData.append('projectName', projectName.trim());

      const res = await fetch(`${API_BASE}/api/takeoff/analyze`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Server error ${res.status}`);
      }

      const data = await res.json();
      const tagged: TakeoffItem[] = (data.items ?? []).map((item: any, i: number) => ({
        ...item,
        id: `item-${i}`,
      }));
      setResult(data);
      setItems(tagged);
      setPhase('results');
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

      const lineItems = items.map((item, i) => ({
        quote_id: quote.id,
        product_name: item.covering_type || 'Window Covering',
        window_label: [item.room_name, item.room_number, item.tag ? `[${item.tag}]` : ''].filter(Boolean).join(' ').trim() || `Item ${i + 1}`,
        mount_type: null,
        width_in: item.width_inches ?? null,
        height_in: item.height_inches ?? null,
        unit_price_cents: 0,
        quote_price_cents: 0,
        quantity: item.quantity || 1,
        sort_order: i,
      }));

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
  };

  if (phase === 'analyzing') {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator color={brandColor} size="large" />
          <Text style={styles.analyzingTitle}>Analyzing your plan…</Text>
          <Text style={styles.analyzingSub}>This may take 30–60 seconds</Text>
          <Text style={styles.analyzingFile}>{selectedFile?.name}</Text>
        </View>
      </View>
    );
  }

  if (phase === 'results' && result) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleReset} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← New</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{result.projectName || 'Takeoff Results'}</Text>
            <Text style={styles.headerSub}>{result.itemCount} items · pages {1}–{result.totalPages} analyzed</Text>
          </View>
        </View>

        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          renderItem={({ item }) => (
            <View style={styles.itemCard}>
              <View style={styles.itemCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemRoom}>
                    {item.room_name || '—'}{item.room_number ? ` · ${item.room_number}` : ''}
                  </Text>
                  {item.tag ? <Text style={styles.itemTag}>{item.tag}</Text> : null}
                </View>
                <View style={[styles.confidenceBadge, { backgroundColor: CONFIDENCE_COLOR[item.confidence] + '22', borderColor: CONFIDENCE_COLOR[item.confidence] + '66' }]}>
                  <Text style={[styles.confidenceText, { color: CONFIDENCE_COLOR[item.confidence] }]}>
                    {item.confidence}
                  </Text>
                </View>
              </View>

              <Text style={styles.itemCovering}>{item.covering_type || '—'}</Text>

              <View style={styles.itemRow}>
                <View style={styles.itemField}>
                  <Text style={styles.fieldLabel}>QTY</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={String(item.quantity || 1)}
                    keyboardType="numeric"
                    onChangeText={v => updateItem(item.id, 'quantity', parseInt(v) || 1)}
                  />
                </View>
                <View style={styles.itemField}>
                  <Text style={styles.fieldLabel}>WIDTH (in)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={item.width_inches != null ? String(item.width_inches) : ''}
                    placeholder="—"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    keyboardType="decimal-pad"
                    onChangeText={v => updateItem(item.id, 'width_inches', v ? parseFloat(v) : null)}
                  />
                </View>
                <View style={styles.itemField}>
                  <Text style={styles.fieldLabel}>HEIGHT (in)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={item.height_inches != null ? String(item.height_inches) : ''}
                    placeholder="—"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    keyboardType="decimal-pad"
                    onChangeText={v => updateItem(item.id, 'height_inches', v ? parseFloat(v) : null)}
                  />
                </View>
                {item.sheet_ref ? (
                  <View style={styles.itemField}>
                    <Text style={styles.fieldLabel}>SHEET</Text>
                    <Text style={styles.fieldStatic}>{item.sheet_ref}</Text>
                  </View>
                ) : null}
              </View>

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
              : <Text style={styles.createBtnText}>Create Quote ({items.length} items) →</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Upload phase
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.uploadContent}>
        <Text style={styles.screenTitle}>Plan Takeoff</Text>
        <Text style={styles.screenSub}>Upload a PDF plan set to extract window covering schedules automatically.</Text>

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
          {selectedFile
            ? <>
                <Text style={styles.uploadFileName}>{selectedFile.name}</Text>
                <Text style={styles.uploadFileSize}>{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</Text>
              </>
            : <>
                <Text style={styles.uploadPrompt}>Tap to select PDF</Text>
                <Text style={styles.uploadHint}>Supports architectural plan sets up to 100 MB</Text>
              </>
          }
        </TouchableOpacity>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.analyzeBtn, { backgroundColor: brandColor }, !selectedFile && styles.btnDisabled]}
          onPress={handleAnalyze}
          disabled={!selectedFile}
        >
          <Text style={styles.analyzeBtnText}>Analyze Plan →</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F1A',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },

  // Upload phase
  uploadContent: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 60,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  screenSub: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 32,
    lineHeight: 22,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  textInput: {
    fontSize: 16,
    color: '#FFFFFF',
    padding: 0,
  },
  uploadBox: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    marginBottom: 24,
  },
  uploadIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  uploadPrompt: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  uploadHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
  uploadFileName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#30D158',
    marginBottom: 4,
    textAlign: 'center',
  },
  uploadFileSize: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
  analyzeBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  analyzeBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  errorText: {
    color: '#FF453A',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },

  // Analyzing phase
  analyzingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 24,
    marginBottom: 8,
  },
  analyzingSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 12,
  },
  analyzingFile: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
  },

  // Results phase
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    gap: 12,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  backBtnText: {
    color: '#0A84FF',
    fontSize: 15,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },

  itemCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  itemCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  itemRoom: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  itemTag: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  confidenceBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemCovering: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 10,
    textTransform: 'capitalize',
  },
  itemRow: {
    flexDirection: 'row',
    gap: 10,
  },
  itemField: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  fieldInput: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 6,
    padding: 7,
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  fieldStatic: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingVertical: 7,
  },
  itemNotes: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 8,
    fontStyle: 'italic',
    lineHeight: 17,
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 36,
    backgroundColor: '#0A0F1A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  createBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
