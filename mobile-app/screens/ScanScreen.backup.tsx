import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { roomsService, scanService } from '../lib/supabase';

type ScanStep = 'sticker' | 'mount' | 'scan' | 'result' | 'save';
type MountType = 'inside' | 'outside';

interface ScanResult {
  width: string;
  height: string;
  area: string;
}

interface SaveForm {
  roomId: string | null;
  roomName: string;
  windowLabel: string;
  isNewRoom: boolean;
}

export default function ScanScreen({ navigation }: any) {
  const { dealer } = useAuth();

  // Step flow
  const [step, setStep] = useState<ScanStep>('sticker');
  const [mountType, setMountType] = useState<MountType>('inside');
  const [overlapLeft, setOverlapLeft] = useState('3.0');
  const [overlapRight, setOverlapRight] = useState('3.0');
  const [overlapTop, setOverlapTop] = useState('3.0');

  // Scan simulation
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);
  const intervalRef = useRef<any>(null);

  // Save flow
  const [rooms, setRooms] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveForm, setSaveForm] = useState<SaveForm>({
    roomId: null,
    roomName: '',
    windowLabel: 'Window 1',
    isNewRoom: false,
  });

  useEffect(() => {
    if (dealer) loadRooms();
    return () => clearInterval(intervalRef.current);
  }, [dealer]);

  const loadRooms = async () => {
    try {
      const data = await roomsService.getRooms(dealer!.id);
      setRooms(data);
    } catch (e) {
      console.error('Failed to load rooms:', e);
    }
  };

  // ── Computed order size ───────────────────────────────

  const orderWidth = result
    ? mountType === 'outside'
      ? (parseFloat(result.width) + parseFloat(overlapLeft) + parseFloat(overlapRight)).toFixed(1)
      : result.width
    : null;

  const orderHeight = result
    ? mountType === 'outside'
      ? (parseFloat(result.height) + parseFloat(overlapTop)).toFixed(1)
      : result.height
    : null;

  // ── Scan simulation ───────────────────────────────────

  const startScan = () => {
    setScanning(true);
    setScanProgress(0);
    setResult(null);
    intervalRef.current = setInterval(() => {
      setScanProgress(p => {
        if (p >= 100) {
          clearInterval(intervalRef.current);
          setScanning(false);
          const w = (28 + Math.random() * 24).toFixed(1);
          const h = (36 + Math.random() * 24).toFixed(1);
          setResult({ width: w, height: h, area: (parseFloat(w) * parseFloat(h) / 144).toFixed(2) });
          return 100;
        }
        return p + 3;
      });
    }, 50);
  };

  // ── Save to Supabase ──────────────────────────────────

  const handleSave = async () => {
    if (!dealer || !result) return;
    if (!saveForm.roomId && !saveForm.roomName.trim()) {
      Alert.alert('Room required', 'Please select a room or enter a new room name.');
      return;
    }

    setSaving(true);
    try {
      let roomId = saveForm.roomId;

      // Create new room if needed
      if (saveForm.isNewRoom || !roomId) {
        const newRoom = await roomsService.createRoom({
          dealer_id: dealer.id,
          customer_id: null,
          name: saveForm.roomName.trim(),
          floor: 1,
          notes: null,
        });
        roomId = newRoom.id;
        await loadRooms();
      }

      // Save scan result
      await roomsService.saveScanResult({
        dealer_id: dealer.id,
        room_id: roomId!,
        label: saveForm.windowLabel.trim() || 'Window',
        mount_type: mountType,
        width_in: parseFloat(result.width),
        height_in: parseFloat(result.height),
        overlap_in: mountType === 'outside' ? parseFloat(overlapLeft) : 0,
        calibration_method: 'sticker',
        sticker_detected: true,
        scan_confidence: 0.97,
        photo_url: null,
      });

      // Log scan event for usage metering
      await scanService.logScan({
        dealer_id: dealer.id,
        room_id: roomId!,
        window_id: null,
        scan_type: 'window',
        calibration_method: 'sticker',
        confidence_score: 0.97,
        duration_ms: 3000,
        device_model: 'iPhone',
        os_version: 'iOS 17',
        app_version: '1.0.0',
      });

      Alert.alert(
        '✅ Saved!',
        `Window saved to ${saveForm.isNewRoom ? saveForm.roomName : rooms.find(r => r.id === roomId)?.name ?? 'room'}.`,
        [
          { text: 'Scan Another', onPress: resetFlow },
          { text: 'View Rooms', onPress: () => navigation.navigate('Rooms') },
        ]
      );
    } catch (e: any) {
      Alert.alert('Save failed', e.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const resetFlow = () => {
    setStep('sticker');
    setMountType('inside');
    setResult(null);
    setScanProgress(0);
    setSaveForm({ roomId: null, roomName: '', windowLabel: 'Window 1', isNewRoom: false });
  };

  // ── Render steps ──────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Window Scanner</Text>
        <View style={styles.stepIndicator}>
          {(['sticker', 'mount', 'scan', 'save'] as const).map((s, i) => (
            <View key={s} style={[
              styles.stepDot,
              step === s && styles.stepDotActive,
              ['result', 'save'].includes(step) && i <= 3 && styles.stepDotDone,
            ]} />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Step 1: Sticker ── */}
        {step === 'sticker' && (
          <View style={styles.stepCard}>
            <Text style={styles.stepEmoji}>🏷️</Text>
            <Text style={styles.stepTitle}>Place Calibration Sticker</Text>
            <Text style={styles.stepDesc}>
              Peel a branded calibration sticker and place it flat inside the window frame — any corner works. The sticker's 1" reference square calibrates the scan to ±0.1" accuracy.
            </Text>
            <View style={styles.stickerDiagram}>
              <View style={styles.windowFrame}>
                <View style={styles.windowGlass} />
                <View style={styles.stickerPlaceholder}>
                  <Text style={styles.stickerText}>STICKER{'\n'}HERE</Text>
                </View>
              </View>
            </View>
            <View style={styles.tipBox}>
              <Text style={styles.tipText}>💡 Make sure the sticker is fully visible and not folded or obscured</Text>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('mount')}>
              <Text style={styles.primaryBtnText}>Sticker Placed →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Step 2: Mount Type ── */}
        {step === 'mount' && (
          <View style={styles.stepCard}>
            <Text style={styles.stepEmoji}>🪟</Text>
            <Text style={styles.stepTitle}>Select Mount Type</Text>
            <Text style={styles.stepDesc}>
              Mount type determines what edges to measure and how the finished product size is calculated.
            </Text>

            <TouchableOpacity
              style={[styles.mountOption, mountType === 'inside' && styles.mountOptionActive]}
              onPress={() => setMountType('inside')}
            >
              <View style={styles.mountOptionHeader}>
                <Text style={styles.mountOptionTitle}>Inside Mount</Text>
                {mountType === 'inside' && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.mountOptionDesc}>
                Covering fits inside the window frame. Measures the opening edge-to-edge. Most common for blinds and cellular shades.
              </Text>
              <View style={styles.mountDiagram}>
                <View style={[styles.mountDiagramFrame, { borderColor: mountType === 'inside' ? '#0A84FF' : 'rgba(255,255,255,0.15)' }]}>
                  <View style={[styles.mountDiagramProduct, { backgroundColor: '#0A84FF', margin: 4 }]} />
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mountOption, mountType === 'outside' && styles.mountOptionActive]}
              onPress={() => setMountType('outside')}
            >
              <View style={styles.mountOptionHeader}>
                <Text style={styles.mountOptionTitle}>Outside Mount</Text>
                {mountType === 'outside' && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.mountOptionDesc}>
                Covering overlaps and covers the frame. Add overlap on all sides for light blockage. Common for shutters and drapery.
              </Text>
              {mountType === 'outside' && (
                <View style={styles.overlapInputs}>
                  <Text style={styles.overlapLabel}>Overlap (inches)</Text>
                  <View style={styles.overlapRow}>
                    {[
                      ['Left', overlapLeft, setOverlapLeft],
                      ['Right', overlapRight, setOverlapRight],
                      ['Top', overlapTop, setOverlapTop],
                    ].map(([label, val, set]: any) => (
                      <View key={label} style={styles.overlapInput}>
                        <Text style={styles.overlapInputLabel}>{label}</Text>
                        <TextInput
                          value={val}
                          onChangeText={set}
                          keyboardType="decimal-pad"
                          style={styles.overlapInputField}
                          selectTextOnFocus
                        />
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('sticker')}>
                <Text style={styles.secondaryBtnText}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={() => setStep('scan')}>
                <Text style={styles.primaryBtnText}>Continue →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Step 3: Scan ── */}
        {step === 'scan' && (
          <View>
            {/* Camera viewport */}
            <View style={styles.viewport}>
              {/* Corner brackets */}
              {[
                { top: 20, left: 20 },
                { top: 20, right: 20 },
                { bottom: 20, left: 20 },
                { bottom: 20, right: 20 },
              ].map((pos, i) => (
                <View key={i} style={[styles.corner, pos,
                  i < 2 ? styles.cornerTop : styles.cornerBottom,
                  i % 2 === 0 ? styles.cornerLeft : styles.cornerRight,
                ]} />
              ))}

              {/* Scan line */}
              {scanning && (
                <View style={[styles.scanLine, { top: `${scanProgress}%` as any }]} />
              )}

              {/* Progress */}
              {scanning && (
                <View style={styles.progressBadge}>
                  <Text style={styles.progressText}>{scanProgress}%</Text>
                </View>
              )}

              {/* Status overlay */}
              <View style={styles.statusOverlay}>
                <Text style={styles.statusTitle}>
                  {result ? '✅ Scan complete' : scanning ? 'Scanning...' : `${mountType === 'inside' ? 'Inside' : 'Outside'} mount — align frame`}
                </Text>
                <Text style={styles.statusSub}>
                  {result
                    ? `${result.width}" × ${result.height}" · ${result.area} sq ft`
                    : scanning
                      ? 'Hold phone steady · Detecting edges'
                      : 'Point camera at window · Sticker must be visible'}
                </Text>
              </View>
            </View>

            {/* Result or scan button */}
            {result ? (
              <View style={styles.resultPanel}>
                <View style={styles.measureGrid}>
                  {[
                    ['Opening Width', `${result.width}"`],
                    ['Opening Height', `${result.height}"`],
                    ['Area', `${result.area} ft²`],
                  ].map(([label, val]) => (
                    <View key={label} style={styles.measureCell}>
                      <Text style={styles.measureVal}>{val}</Text>
                      <Text style={styles.measureLabel}>{label}</Text>
                    </View>
                  ))}
                </View>

                {mountType === 'outside' && (
                  <View style={styles.orderSizeBox}>
                    <Text style={styles.orderSizeTitle}>Order Size (with overlap)</Text>
                    <Text style={styles.orderSizeVal}>{orderWidth}" × {orderHeight}"</Text>
                    <Text style={styles.orderSizeSub}>+{overlapLeft}" left · +{overlapRight}" right · +{overlapTop}" top</Text>
                  </View>
                )}

                <View style={styles.btnRow}>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => setResult(null)}>
                    <Text style={styles.secondaryBtnText}>Rescan</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.primaryBtn, { flex: 2 }]} onPress={() => setStep('save')}>
                    <Text style={styles.primaryBtnText}>Save Measurement →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.scanPanel}>
                <TouchableOpacity
                  style={[styles.scanButton, scanning && styles.scanButtonActive]}
                  onPress={startScan}
                  disabled={scanning}
                >
                  <Text style={styles.scanButtonText}>{scanning ? '⏳' : '📷'}</Text>
                </TouchableOpacity>
                <Text style={styles.scanHint}>Tap to scan</Text>
                <View style={styles.featureRow}>
                  {['Sticker Cal', 'Auto-Level', '±0.1" Accuracy'].map(f => (
                    <Text key={f} style={styles.featureTag}>✓ {f}</Text>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Step 4: Save ── */}
        {step === 'save' && result && (
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>Save to Room</Text>
            <Text style={styles.stepDesc}>
              {result.width}" × {result.height}" · {mountType} mount
              {mountType === 'outside' ? ` · Order: ${orderWidth}" × ${orderHeight}"` : ''}
            </Text>

            {/* Window label */}
            <Text style={styles.fieldLabel}>Window Label</Text>
            <TextInput
              value={saveForm.windowLabel}
              onChangeText={t => setSaveForm(f => ({ ...f, windowLabel: t }))}
              style={styles.textInput}
              placeholder="e.g. South Window, Bay Window"
              placeholderTextColor="rgba(255,255,255,0.25)"
            />

            {/* Room selection */}
            <Text style={styles.fieldLabel}>Room</Text>

            {/* Existing rooms */}
            {rooms.map(room => (
              <TouchableOpacity
                key={room.id}
                style={[styles.roomOption, saveForm.roomId === room.id && styles.roomOptionActive]}
                onPress={() => setSaveForm(f => ({ ...f, roomId: room.id, isNewRoom: false, roomName: '' }))}
              >
                <Text style={styles.roomOptionText}>{room.name}</Text>
                <Text style={styles.roomOptionSub}>{room.windows?.length ?? 0} windows</Text>
                {saveForm.roomId === room.id && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            ))}

            {/* New room */}
            <TouchableOpacity
              style={[styles.roomOption, styles.newRoomOption, saveForm.isNewRoom && styles.roomOptionActive]}
              onPress={() => setSaveForm(f => ({ ...f, isNewRoom: true, roomId: null }))}
            >
              <Text style={styles.roomOptionText}>+ New Room</Text>
            </TouchableOpacity>

            {saveForm.isNewRoom && (
              <TextInput
                value={saveForm.roomName}
                onChangeText={t => setSaveForm(f => ({ ...f, roomName: t }))}
                style={styles.textInput}
                placeholder="Room name (e.g. Living Room)"
                placeholderTextColor="rgba(255,255,255,0.25)"
                autoFocus
              />
            )}

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('scan')}>
                <Text style={styles.secondaryBtnText}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1 }, saving && styles.btnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="white" size="small" />
                  : <Text style={styles.primaryBtnText}>Save ✓</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0F1A' },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  stepIndicator: { flexDirection: 'row', gap: 6 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)' },
  stepDotActive: { backgroundColor: '#0A84FF', width: 20 },
  stepDotDone: { backgroundColor: '#30D158' },
  content: { padding: 20, paddingBottom: 40 },

  // Step card
  stepCard: { gap: 14 },
  stepEmoji: { fontSize: 48, textAlign: 'center' },
  stepTitle: { color: 'white', fontSize: 20, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  stepDesc: { color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 22, textAlign: 'center' },

  // Sticker diagram
  stickerDiagram: { alignItems: 'center', marginVertical: 8 },
  windowFrame: {
    width: 180, height: 220, borderWidth: 8,
    borderColor: 'rgba(255,255,255,0.2)', borderRadius: 4,
    backgroundColor: 'rgba(10,132,255,0.05)', position: 'relative',
  },
  windowGlass: { flex: 1, margin: 4, backgroundColor: 'rgba(10,132,255,0.08)', borderRadius: 2 },
  stickerPlaceholder: {
    position: 'absolute', bottom: 12, right: 12,
    width: 36, height: 36, backgroundColor: '#0A84FF',
    borderRadius: 4, alignItems: 'center', justifyContent: 'center',
  },
  stickerText: { color: 'white', fontSize: 6, fontWeight: '800', textAlign: 'center' },
  tipBox: {
    backgroundColor: 'rgba(255,214,10,0.08)', borderWidth: 1,
    borderColor: 'rgba(255,214,10,0.2)', borderRadius: 10, padding: 12,
  },
  tipText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 20 },

  // Mount type
  mountOption: {
    backgroundColor: '#111827', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, gap: 8,
  },
  mountOptionActive: { borderColor: '#0A84FF', backgroundColor: 'rgba(10,132,255,0.08)' },
  mountOptionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mountOptionTitle: { color: 'white', fontWeight: '700', fontSize: 16 },
  mountOptionDesc: { color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 20 },
  mountDiagram: { alignItems: 'center', marginTop: 4 },
  mountDiagramFrame: {
    width: 80, height: 60, borderWidth: 2, borderRadius: 4,
  },
  mountDiagramProduct: { flex: 1, borderRadius: 2 },
  checkmark: { color: '#30D158', fontSize: 18, fontWeight: '700' },

  // Overlap inputs
  overlapInputs: { marginTop: 8 },
  overlapLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  overlapRow: { flexDirection: 'row', gap: 10 },
  overlapInput: { flex: 1, alignItems: 'center' },
  overlapInputLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 4 },
  overlapInputField: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)', borderRadius: 8,
    color: 'white', fontSize: 16, fontWeight: '700',
    textAlign: 'center', padding: 8, width: '100%',
  },

  // Viewport
  viewport: {
    height: 340, backgroundColor: '#0D1A2D',
    margin: 20, borderRadius: 16, overflow: 'hidden',
    position: 'relative', alignItems: 'center', justifyContent: 'center',
  },
  corner: { position: 'absolute', width: 28, height: 28 },
  cornerTop: { borderTopWidth: 3, borderTopColor: '#0A84FF' },
  cornerBottom: { borderBottomWidth: 3, borderBottomColor: '#0A84FF' },
  cornerLeft: { borderLeftWidth: 3, borderLeftColor: '#0A84FF' },
  cornerRight: { borderRightWidth: 3, borderRightColor: '#0A84FF' },
  scanLine: {
    position: 'absolute', left: 12, right: 12, height: 2,
    backgroundColor: '#0A84FF',
    shadowColor: '#0A84FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8,
  },
  progressBadge: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 6,
  },
  progressText: { color: 'white', fontSize: 11, fontWeight: '700' },
  statusOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)', padding: 14,
  },
  statusTitle: { color: 'white', fontWeight: '600', fontSize: 13, marginBottom: 2 },
  statusSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },

  // Scan panel
  scanPanel: { alignItems: 'center', padding: 24, gap: 12 },
  scanButton: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#0A84FF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0A84FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 20,
  },
  scanButtonActive: { backgroundColor: 'rgba(10,132,255,0.4)' },
  scanButtonText: { fontSize: 32 },
  scanHint: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  featureRow: { flexDirection: 'row', gap: 12 },
  featureTag: { color: 'rgba(255,255,255,0.35)', fontSize: 10 },

  // Result panel
  resultPanel: { padding: 20, gap: 14 },
  measureGrid: { flexDirection: 'row', gap: 10 },
  measureCell: {
    flex: 1, backgroundColor: 'rgba(10,132,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(10,132,255,0.2)',
    borderRadius: 12, padding: 12, alignItems: 'center',
  },
  measureVal: { color: '#0A84FF', fontSize: 18, fontWeight: '800' },
  measureLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 2 },
  orderSizeBox: {
    backgroundColor: 'rgba(48,209,88,0.08)', borderWidth: 1,
    borderColor: 'rgba(48,209,88,0.2)', borderRadius: 12, padding: 14,
  },
  orderSizeTitle: { color: '#30D158', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  orderSizeVal: { color: 'white', fontSize: 22, fontWeight: '800', marginTop: 4 },
  orderSizeSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },

  // Save form
  fieldLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)', borderRadius: 10,
    color: 'white', fontSize: 15, padding: 12,
  },
  roomOption: {
    backgroundColor: '#111827', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12, padding: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  roomOptionActive: { borderColor: '#0A84FF', backgroundColor: 'rgba(10,132,255,0.08)' },
  newRoomOption: { borderStyle: 'dashed' },
  roomOptionText: { color: 'white', fontWeight: '600', fontSize: 14, flex: 1 },
  roomOptionSub: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginRight: 8 },

  // Buttons
  btnRow: { flexDirection: 'row', gap: 10 },
  primaryBtn: {
    backgroundColor: '#0A84FF', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14,
    paddingVertical: 15, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { color: 'rgba(255,255,255,0.7)', fontWeight: '600', fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
});
