import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://windowfit-production.up.railway.app';

interface PricingDefault {
  id: string;
  dealer_id: string;
  category: string;
  cost_multiplier: number;
  markup_percent: number;
  updated_at: string;
}

interface Product {
  id: string;
  name: string;
  category: string;
  msrp_cents: number;
}

interface PricingOverride {
  id: string;
  dealer_id: string;
  product_id: string;
  cost_multiplier: number | null;
  markup_percent: number | null;
  custom_price_cents: number | null;
  updated_at: string;
  products: Product;
}

const CATEGORIES = ['Cellular', 'Roller', 'Shutter', 'Natural', 'Roman', 'Other'];

const CATEGORY_COLORS: Record<string, string> = {
  Cellular: '#2563EB',
  Roller:   '#0891B2',
  Shutter:  '#B45309',
  Natural:  '#16A34A',
  Roman:    '#7C3AED',
  Other:    '#6B7280',
};

interface PricingSettingsProps {
  dealerId: string;
  brandColor?: string;
}

export default function PricingSettings({ dealerId, brandColor = '#2563EB' }: PricingSettingsProps) {
  const [_defaults, setDefaults]  = useState<PricingDefault[]>([]);
  const [overrides, setOverrides] = useState<PricingOverride[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Local edits before saving
  const [editDefaults, setEditDefaults] = useState<Record<string, { cost_multiplier: string; markup_percent: string }>>({});

  useEffect(() => {
    loadPricing();
  }, [dealerId]);

  const loadPricing = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/dealer/pricing/${dealerId}`);
      const data = await res.json();
      setDefaults(data.defaults || []);
      setOverrides(data.overrides || []);

      // Seed local edit state
      const edits: Record<string, { cost_multiplier: string; markup_percent: string }> = {};
      (data.defaults || []).forEach((d: PricingDefault) => {
        edits[d.category] = {
          cost_multiplier: (d.cost_multiplier * 100).toFixed(1),
          markup_percent: d.markup_percent.toFixed(1),
        };
      });
      // Fill in any missing categories
      CATEGORIES.forEach(cat => {
        if (!edits[cat]) {
          edits[cat] = { cost_multiplier: '31.0', markup_percent: '40.0' };
        }
      });
      setEditDefaults(edits);
    } catch (e: any) {
      setError('Failed to load pricing settings.');
    } finally {
      setLoading(false);
    }
  };

  const saveDefault = async (category: string) => {
    const edit = editDefaults[category];
    if (!edit) return;

    const cost_multiplier = parseFloat(edit.cost_multiplier) / 100;
    const markup_percent  = parseFloat(edit.markup_percent);

    if (isNaN(cost_multiplier) || isNaN(markup_percent)) {
      setError('Please enter valid numbers.');
      return;
    }

    setSaving(category);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/dealer/pricing/${dealerId}/defaults`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, cost_multiplier, markup_percent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      setDefaults(prev => {
        const idx = prev.findIndex(d => d.category === category);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = data.default;
          return updated;
        }
        return [...prev, data.default];
      });

      showSuccess(`${category} pricing saved`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  };

  const deleteOverride = async (override: PricingOverride) => {
    if (!window.confirm(`Remove override for "${override.products.name}"? It will revert to category defaults.`)) return;
    try {
      await fetch(`${API_BASE}/api/dealer/pricing/${dealerId}/overrides/${override.product_id}`, {
        method: 'DELETE',
      });
      setOverrides(prev => prev.filter(o => o.product_id !== override.product_id));
      showSuccess('Override removed');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Computed quote price preview
  const computeQuotePrice = (category: string, msrpCents: number) => {
    const edit = editDefaults[category];
    if (!edit) return null;
    const costMultiplier = parseFloat(edit.cost_multiplier) / 100;
    const markupPercent  = parseFloat(edit.markup_percent) / 100;
    if (isNaN(costMultiplier) || isNaN(markupPercent)) return null;
    const dealerCost = msrpCents * costMultiplier;
    const quotePrice = dealerCost * (1 + markupPercent);
    return { dealerCost, quotePrice, margin: quotePrice - dealerCost };
  };

  const SAMPLE_MSRP = 45000; // $450 sample window for preview

  if (loading) return (
    <div style={S.loadingWrap}>
      <div style={{ ...S.spinner, borderTopColor: brandColor }} />
      <p style={S.loadingText}>Loading pricing settings...</p>
    </div>
  );

  return (
    <div style={S.page}>

      {/* Header */}
      <div style={S.header}>
        <div>
          <h2 style={S.h2}>Pricing Settings</h2>
          <p style={S.headerSub}>
            Set your dealer cost and markup per category. Override individual products as needed.
          </p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div style={S.alertError}>
          <span>⚠️ {error}</span>
          <button style={S.alertClose} onClick={() => setError(null)}>✕</button>
        </div>
      )}
      {successMsg && (
        <div style={S.alertSuccess}>
          <span>✓ {successMsg}</span>
        </div>
      )}

      {/* How pricing works */}
      <div style={S.infoBox}>
        <p style={S.infoTitle}>How pricing works</p>
        <p style={S.infoText}>
          <strong>Dealer cost</strong> = MSRP × your cost % &nbsp;·&nbsp;
          <strong>Quote price</strong> = Dealer cost × (1 + markup %) &nbsp;·&nbsp;
          <strong>Margin</strong> = Quote price − Dealer cost
        </p>
        <p style={{ ...S.infoText, marginTop: 4 }}>
          Changes apply to all new quotes. Existing quotes are not affected.
        </p>
      </div>

      {/* Category defaults */}
      <div style={S.section}>
        <h3 style={S.h3}>Category Defaults</h3>
        <p style={S.sectionSub}>These apply to all products unless a per-product override exists.</p>

        <div style={S.categoryGrid}>
          {CATEGORIES.map(category => {
            const edit    = editDefaults[category] || { cost_multiplier: '31.0', markup_percent: '40.0' };
            const isSaving = saving === category;
            const color   = CATEGORY_COLORS[category] || brandColor;
            const preview = computeQuotePrice(category, SAMPLE_MSRP);

            return (
              <div key={category} style={{ ...S.categoryCard, borderTop: `3px solid ${color}` }}>
                <div style={S.categoryHeader}>
                  <span style={{ ...S.categoryLabel, color }}>{category}</span>
                </div>

                <div style={S.fieldRow}>
                  <div style={S.fieldGroup}>
                    <label style={S.label}>Dealer Cost %</label>
                    <div style={S.inputWrap}>
                      <input
                        style={S.input}
                        type="number"
                        min="1"
                        max="100"
                        step="0.1"
                        value={edit.cost_multiplier}
                        onChange={e => setEditDefaults(prev => ({
                          ...prev,
                          [category]: { ...prev[category], cost_multiplier: e.target.value }
                        }))}
                      />
                      <span style={S.inputSuffix}>%</span>
                    </div>
                    <p style={S.fieldHint}>% of MSRP you pay</p>
                  </div>

                  <div style={S.fieldGroup}>
                    <label style={S.label}>Markup %</label>
                    <div style={S.inputWrap}>
                      <input
                        style={S.input}
                        type="number"
                        min="0"
                        max="500"
                        step="0.1"
                        value={edit.markup_percent}
                        onChange={e => setEditDefaults(prev => ({
                          ...prev,
                          [category]: { ...prev[category], markup_percent: e.target.value }
                        }))}
                      />
                      <span style={S.inputSuffix}>%</span>
                    </div>
                    <p style={S.fieldHint}>% above your cost</p>
                  </div>
                </div>

                {/* Price preview */}
                {preview && (
                  <div style={S.preview}>
                    <div style={S.previewItem}>
                      <span style={S.previewLabel}>Sample MSRP</span>
                      <span style={S.previewValue}>${(SAMPLE_MSRP / 100).toFixed(0)}</span>
                    </div>
                    <div style={S.previewItem}>
                      <span style={S.previewLabel}>Your cost</span>
                      <span style={S.previewValue}>${(preview.dealerCost / 100).toFixed(0)}</span>
                    </div>
                    <div style={S.previewItem}>
                      <span style={S.previewLabel}>Quote price</span>
                      <span style={{ ...S.previewValue, color, fontWeight: 700 }}>
                        ${(preview.quotePrice / 100).toFixed(0)}
                      </span>
                    </div>
                    <div style={S.previewItem}>
                      <span style={S.previewLabel}>Margin</span>
                      <span style={{ ...S.previewValue, color: '#16A34A' }}>
                        ${(preview.margin / 100).toFixed(0)}
                      </span>
                    </div>
                  </div>
                )}

                <button
                  style={{
                    ...S.saveBtn,
                    background: brandColor,
                    opacity: isSaving ? 0.6 : 1,
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                  }}
                  onClick={() => saveDefault(category)}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-product overrides */}
      <div style={S.section}>
        <h3 style={S.h3}>Per-Product Overrides</h3>
        <p style={S.sectionSub}>
          These products use custom pricing instead of their category default.
        </p>

        {overrides.length === 0 ? (
          <div style={S.emptyOverrides}>
            <p style={S.emptyText}>No product overrides yet.</p>
            <p style={S.emptyHint}>
              To override a product, tap it in the catalog and set custom pricing from the product detail screen.
            </p>
          </div>
        ) : (
          <div style={S.overridesTable}>
            <div style={S.overrideHeader}>
              <span style={{ ...S.overrideTh, flex: 3 }}>Product</span>
              <span style={{ ...S.overrideTh, flex: 1 }}>Category</span>
              <span style={{ ...S.overrideTh, flex: 1 }}>Cost %</span>
              <span style={{ ...S.overrideTh, flex: 1 }}>Markup %</span>
              <span style={{ ...S.overrideTh, flex: 1 }}>Custom Price</span>
              <span style={{ ...S.overrideTh, flex: 0.5 }}></span>
            </div>
            {overrides.map((o, i) => {
              const color = CATEGORY_COLORS[o.products?.category] || '#6B7280';
              return (
                <div key={o.id} style={{
                  ...S.overrideRow,
                  background: i % 2 === 0 ? '#fff' : '#F9FAFB',
                }}>
                  <span style={{ ...S.overrideTd, flex: 3, fontWeight: 600, color: '#111827' }}>
                    {o.products?.name || 'Unknown product'}
                  </span>
                  <span style={{ ...S.overrideTd, flex: 1 }}>
                    <span style={{ ...S.catPill, background: `${color}15`, color, border: `1px solid ${color}30` }}>
                      {o.products?.category}
                    </span>
                  </span>
                  <span style={{ ...S.overrideTd, flex: 1 }}>
                    {o.cost_multiplier != null ? `${(o.cost_multiplier * 100).toFixed(1)}%` : '—'}
                  </span>
                  <span style={{ ...S.overrideTd, flex: 1 }}>
                    {o.markup_percent != null ? `${o.markup_percent.toFixed(1)}%` : '—'}
                  </span>
                  <span style={{ ...S.overrideTd, flex: 1 }}>
                    {o.custom_price_cents != null ? `$${(o.custom_price_cents / 100).toFixed(2)}` : '—'}
                  </span>
                  <span style={{ ...S.overrideTd, flex: 0.5, textAlign: 'right' }}>
                    <button
                      style={S.removeBtn}
                      onClick={() => deleteOverride(o)}
                      title="Remove override"
                    >
                      ✕
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    maxWidth: 900,
    margin: '0 auto',
    padding: '0 0 48px',
  },
  loadingWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: 60, gap: 12,
  },
  spinner: {
    width: 32, height: 32, border: '3px solid #E5E7EB',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  },
  loadingText: { fontSize: 14, color: '#6B7280', margin: 0 },
  header: {
    padding: '24px 0 16px',
    borderBottom: '1px solid #F3F4F6',
    marginBottom: 20,
  },
  h2: { margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' },
  headerSub: { margin: '6px 0 0', fontSize: 14, color: '#6B7280' },
  alertError: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#FEF2F2', border: '1px solid #FECACA',
    borderRadius: 8, padding: '10px 14px', marginBottom: 16,
    fontSize: 13, color: '#B91C1C',
  },
  alertSuccess: {
    background: '#F0FDF4', border: '1px solid #BBF7D0',
    borderRadius: 8, padding: '10px 14px', marginBottom: 16,
    fontSize: 13, color: '#15803D',
  },
  alertClose: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#B91C1C', fontSize: 14, padding: 0,
  },
  infoBox: {
    background: '#F8FAFF', border: '1px solid #DBEAFE',
    borderRadius: 10, padding: '14px 18px', marginBottom: 24,
  },
  infoTitle: { margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: '#1E40AF' },
  infoText: { margin: 0, fontSize: 13, color: '#3B82F6', lineHeight: 1.6 },
  section: { marginBottom: 32 },
  h3: { margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#111827' },
  sectionSub: { margin: '0 0 16px', fontSize: 13, color: '#6B7280' },
  categoryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 16,
  },
  categoryCard: {
    background: '#fff', borderRadius: 12,
    border: '1px solid #E5E7EB',
    padding: '18px 20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  categoryHeader: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 14,
  },
  categoryLabel: { fontSize: 14, fontWeight: 700, letterSpacing: -0.2 },
  fieldRow: { display: 'flex', gap: 12, marginBottom: 14 },
  fieldGroup: { flex: 1 },
  label: { display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  inputWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  input: {
    width: '100%', border: '1px solid #E5E7EB', borderRadius: 7,
    padding: '8px 28px 8px 10px', fontSize: 15, fontWeight: 600,
    color: '#111827', outline: 'none', fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  inputSuffix: {
    position: 'absolute', right: 10, fontSize: 13,
    color: '#9CA3AF', fontWeight: 500, pointerEvents: 'none',
  },
  fieldHint: { margin: '4px 0 0', fontSize: 11, color: '#9CA3AF' },
  preview: {
    display: 'flex', gap: 0,
    background: '#F9FAFB', borderRadius: 8,
    border: '1px solid #F3F4F6',
    overflow: 'hidden', marginBottom: 14,
  },
  previewItem: {
    flex: 1, padding: '8px 10px', textAlign: 'center',
    borderRight: '1px solid #F3F4F6',
  },
  previewLabel: { display: 'block', fontSize: 10, color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  previewValue: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151' },
  saveBtn: {
    width: '100%', border: 'none', borderRadius: 8,
    padding: '10px 0', fontSize: 13, fontWeight: 700,
    color: '#fff', fontFamily: 'inherit',
  },
  emptyOverrides: {
    background: '#F9FAFB', border: '1px dashed #E5E7EB',
    borderRadius: 10, padding: '28px 24px', textAlign: 'center',
  },
  emptyText: { margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: '#374151' },
  emptyHint: { margin: 0, fontSize: 13, color: '#9CA3AF' },
  overridesTable: {
    border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden',
  },
  overrideHeader: {
    display: 'flex', background: '#F8FAFC',
    padding: '10px 16px', borderBottom: '1px solid #E5E7EB',
  },
  overrideTh: {
    fontSize: 11, fontWeight: 700, color: '#6B7280',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  overrideRow: {
    display: 'flex', alignItems: 'center',
    padding: '12px 16px', borderBottom: '1px solid #F3F4F6',
  },
  overrideTd: { fontSize: 13, color: '#374151' },
  catPill: {
    display: 'inline-block', padding: '2px 8px',
    borderRadius: 20, fontSize: 11, fontWeight: 600,
  },
  removeBtn: {
    background: 'transparent', border: '1px solid #FCA5A5',
    color: '#EF4444', borderRadius: 5, width: 24, height: 24,
    fontSize: 10, fontWeight: 700, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'inherit',
  },
};