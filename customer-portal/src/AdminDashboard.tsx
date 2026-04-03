// MeasureFit Admin Dashboard v2
import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://windowfit-production.up.railway.app';
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET;

const NSS_FOUNDER_ID = '064bead2-5fd9-4f8f-a06a-13b4e48a2f8c';

interface VerticalBrand {
  brand_key: string;
  brand_name: string;
}

interface Dealer {
  id: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  stripe_customer_id: string;
  created_at: string;
  subscription_tier: string;
  vertical_brands: VerticalBrand | null;
}

interface MRRData {
  mrr: number;
  counts: { basic: number; pro: number; enterprise: number };
  total_active: number;
}

const TEAL_DARK   = '#0D3B36';
const TEAL_MID    = '#0F766E';
const TEAL_ACCENT = '#5EEAD4';
const TEAL_LIGHT  = '#F0FDF9';
const TEAL_BORDER = '#CCFBF1';

const MODULE_COLORS: Record<string, string> = {
  windowfit:  '#2563EB',
  floorfit:   '#16A34A',
  cabinetfit: '#B45309',
  tilefit:    '#DC2626',
  closetfit:  '#7C3AED',
  bathfit:    '#0891B2',
  garagefit:  '#EA580C',
  counterfit: '#0D9488',
  doorfit:    '#4F46E5',
  stairfit:   '#BE185D',
  sidingfit:  '#65A30D',
  fencefit:   '#1D4ED8',
  deckfit:    '#CA8A04',
  gutterfit:  '#15803D',
};

const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  basic:      { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' },
  pro:        { bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' },
  enterprise: { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active:   { bg: '#DCFCE7', text: '#15803D' },
  trialing: { bg: '#FEF9C3', text: '#A16207' },
  past_due: { bg: '#FEE2E2', text: '#B91C1C' },
  canceled: { bg: '#F3F4F6', text: '#6B7280' },
};

function adminFetch(path: string) {
  return fetch(`${API_BASE}${path}`, {
    headers: { 'x-admin-secret': ADMIN_SECRET },
  }).then((r) => r.json());
}

export default function AdminDashboard() {
  const [authorized, setAuthorized]     = useState<boolean | null>(null);
  const [dealers, setDealers]           = useState<Dealer[]>([]);
  const [mrr, setMrr]                   = useState<MRRData | null>(null);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterModule, setFilterModule] = useState('all');
  const [filterTier, setFilterTier]     = useState('all');
  const [deleting, setDeleting]         = useState<string | null>(null);

  useEffect(() => {
    const password = prompt('Enter admin password:');
    if (password === ADMIN_SECRET) {
      setAuthorized(true);
    } else {
      setAuthorized(false);
    }
  }, []);

  useEffect(() => {
    if (!authorized) return;
    Promise.all([
      adminFetch('/api/admin/dealers'),
      adminFetch('/api/admin/mrr'),
    ]).then(([dealerRes, mrrRes]) => {
      setDealers(dealerRes.dealers || []);
      setMrr(mrrRes);
      setLoading(false);
    });
  }, [authorized]);

  const handleDelete = async (dealer: Dealer) => {
    const confirmed = window.confirm(
      `Delete "${dealer.name}"?\n\nThis will permanently remove them from the platform. This cannot be undone.`
    );
    if (!confirmed) return;
    setDeleting(dealer.id);
    try {
      const res = await fetch(`${API_BASE}/api/admin/dealers/${dealer.id}`, {
        method: 'DELETE',
        headers: { 'x-admin-secret': ADMIN_SECRET },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setDealers((prev) => prev.filter((d) => d.id !== dealer.id));
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  if (authorized === null) return <LoadingScreen message="Checking access..." />;
  if (authorized === false) return <AccessDenied />;
  if (loading) return <LoadingScreen message="Loading MeasureFit dashboard..." />;

  const arr = (n: number) => Math.round(n * 12);

  const moduleCounts: Record<string, number> = {};
  dealers.forEach((d) => {
    const key = d.vertical_brands?.brand_key || 'unknown';
    moduleCounts[key] = (moduleCounts[key] || 0) + 1;
  });

  const tierCounts = { basic: 0, pro: 0, enterprise: 0 };
  dealers.forEach((d) => {
    const t = (d.subscription_tier || 'basic').toLowerCase() as keyof typeof tierCounts;
    if (t in tierCounts) tierCounts[t]++;
  });

  const liveModules = Object.keys(moduleCounts).filter((k) => k !== 'unknown');

  const filtered = dealers.filter((d) => {
    const matchSearch =
      d.name?.toLowerCase().includes(search.toLowerCase()) ||
      d.email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || d.status?.toLowerCase() === filterStatus;
    const matchModule = filterModule === 'all' || (d.vertical_brands?.brand_key || '') === filterModule;
    const matchTier   = filterTier   === 'all' || (d.subscription_tier || 'basic').toLowerCase() === filterTier;
    return matchSearch && matchStatus && matchModule && matchTier;
  });

  return (
    <div style={S.page}>

      {/* NAV */}
      <div style={S.nav}>
        <div style={S.navLeft}>
          <span style={S.navLogo}>Measure<span style={{ color: TEAL_ACCENT }}>Fit</span></span>
          <span style={S.navDivider}>|</span>
          <span style={S.navSub}>Platform Admin</span>
        </div>
        <div style={S.navRight}>
          <span style={S.internalBadge}>INTERNAL</span>
          <span style={S.liveCount}>
            <span style={S.liveDot} />
            {dealers.length} dealers across {liveModules.length} module{liveModules.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* STAT ROW */}
      {mrr && (
        <div style={S.statRow}>
          <StatCard label="Platform MRR" value={`$${mrr.mrr.toLocaleString()}`}
            sub={`$${arr(mrr.mrr).toLocaleString()} ARR`} accent={TEAL_ACCENT} dark />
          <StatCard label="Active Dealers" value={mrr.total_active}
            sub={`${dealers.length} total records`} accent={TEAL_ACCENT} dark />
          <StatCard label="Basic" value={tierCounts.basic}
            sub={`$${(tierCounts.basic * 79).toLocaleString()}/mo`} accent={TIER_COLORS.basic.text} />
          <StatCard label="Pro" value={tierCounts.pro}
            sub={`$${(tierCounts.pro * 149).toLocaleString()}/mo`} accent={TIER_COLORS.pro.text} />
          <StatCard label="Enterprise" value={tierCounts.enterprise}
            sub={`$${(tierCounts.enterprise * 299).toLocaleString()}/mo`} accent={TIER_COLORS.enterprise.text} />
        </div>
      )}

      {/* MODULE CHIPS */}
      <div style={S.moduleSection}>
        <div style={S.moduleSectionHeader}>
          <span style={S.sectionLabel}>Modules</span>
          <span style={S.sectionSub}>Dealers by vertical</span>
        </div>
        <div style={S.moduleGrid}>
          {Object.entries(moduleCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([key, count]) => {
              const color = MODULE_COLORS[key] || '#6B7280';
              const name  = key.charAt(0).toUpperCase() + key.slice(1);
              return (
                <button key={key} style={{
                  ...S.moduleChip,
                  borderColor: filterModule === key ? color : '#E5E7EB',
                  background:  filterModule === key ? `${color}12` : '#fff',
                }} onClick={() => setFilterModule(filterModule === key ? 'all' : key)}>
                  <span style={{ ...S.moduleChipDot, background: color }} />
                  <span style={S.moduleChipName}>{name}</span>
                  <span style={{ ...S.moduleChipCount, color }}>{count}</span>
                </button>
              );
            })}
          {Object.keys(moduleCounts).length === 0 && (
            <span style={{ fontSize: 13, color: '#9CA3AF' }}>No module data yet</span>
          )}
        </div>
      </div>

      {/* DEALER TABLE */}
      <div style={S.tableSection}>
        <div style={S.tableTopBar}>
          <div style={S.tableTitle}>
            <h2 style={S.h2}>All Dealers</h2>
            <span style={S.dealerCount}>{filtered.length} of {dealers.length}</span>
          </div>
          <div style={S.filters}>
            <input style={S.searchInput} placeholder="Search name or email..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
            <select style={S.select} value={filterModule} onChange={(e) => setFilterModule(e.target.value)}>
              <option value="all">All Modules</option>
              {Object.keys(moduleCounts).map((k) => (
                <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>
              ))}
            </select>
            <select style={S.select} value={filterTier} onChange={(e) => setFilterTier(e.target.value)}>
              <option value="all">All Tiers</option>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
            <select style={S.select} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="past_due">Past Due</option>
              <option value="canceled">Canceled</option>
            </select>
          </div>
        </div>

        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                <th style={S.th}>Business</th>
                <th style={S.th}>Email</th>
                <th style={S.th}>Module</th>
                <th style={S.th}>Tier</th>
                <th style={S.th}>Billing Status</th>
                <th style={S.th}>Signed Up</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => {
                const brandKey  = d.vertical_brands?.brand_key || 'unknown';
                const brandName = d.vertical_brands?.brand_name || brandKey;
                const modColor  = MODULE_COLORS[brandKey] || '#6B7280';
                const tier      = (d.subscription_tier || 'basic').toLowerCase();
                const tierStyle = TIER_COLORS[tier] || TIER_COLORS.basic;
                const sc        = STATUS_COLORS[d.status?.toLowerCase()] || { bg: '#F3F4F6', text: '#374151' };
                const isFounder = d.id === NSS_FOUNDER_ID;
                const isDeleting = deleting === d.id;

                return (
                  <tr key={d.id} style={{ ...S.tr, background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                    <td style={S.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={S.bizName}>{d.name || '-'}</span>
                        {isFounder && (
                          <span style={S.founderBadge}>FOUNDER</span>
                        )}
                      </div>
                    </td>
                    <td style={{ ...S.td, color: '#6B7280', fontSize: 13 }}>{d.email || '-'}</td>
                    <td style={S.td}>
                      <span style={{
                        ...S.modulePill,
                        background: `${modColor}15`,
                        color: modColor,
                        border: `1px solid ${modColor}30`,
                      }}>
                        <span style={{ ...S.modulePillDot, background: modColor }} />
                        {brandName}
                      </span>
                    </td>
                    <td style={S.td}>
                      <span style={{
                        ...S.pill,
                        background: tierStyle.bg,
                        color: tierStyle.text,
                        border: `1px solid ${tierStyle.border}`,
                      }}>
                        {tier}
                      </span>
                    </td>
                    <td style={S.td}>
                      <span style={{ ...S.pill, background: sc.bg, color: sc.text }}>
                        {d.status || '-'}
                      </span>
                    </td>
                    <td style={{ ...S.td, color: '#9CA3AF', fontSize: 12 }}>
                      {d.created_at ? new Date(d.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td style={{ ...S.td, textAlign: 'right' }}>
                      {!isFounder && (
                        <button
                          style={{
                            ...S.deleteBtn,
                            opacity: isDeleting ? 0.5 : 1,
                            cursor: isDeleting ? 'not-allowed' : 'pointer',
                          }}
                          onClick={() => handleDelete(d)}
                          disabled={isDeleting}
                          title="Delete dealer"
                        >
                          {isDeleting ? '...' : '✕'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#9CA3AF', padding: 40 }}>
                    No dealers match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent, dark = false }: {
  label: string; value: string | number; sub: string; accent: string; dark?: boolean;
}) {
  return (
    <div style={{ ...S.card, background: dark ? TEAL_DARK : '#fff', borderTop: `3px solid ${accent}` }}>
      <p style={{ ...S.cardLabel, color: dark ? 'rgba(255,255,255,0.5)' : '#6B7280' }}>{label}</p>
      <p style={{ ...S.cardValue, color: dark ? TEAL_ACCENT : accent }}>{value}</p>
      <p style={{ ...S.cardSub, color: dark ? 'rgba(255,255,255,0.35)' : '#9CA3AF' }}>{sub}</p>
    </div>
  );
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, background: '#F9FAFB' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #E5E7EB', borderTop: `3px solid ${TEAL_ACCENT}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#6B7280', fontSize: 14 }}>{message}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function AccessDenied() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, background: '#F9FAFB' }}>
      <p style={{ fontSize: 48 }}>🔒</p>
      <h2 style={{ color: '#111827', margin: 0 }}>Access Denied</h2>
      <p style={{ color: '#6B7280' }}>MeasureFit platform admin access required.</p>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#F1F5F9', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', paddingBottom: 48 },
  nav: { background: TEAL_DARK, padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid rgba(94,234,212,0.15)` },
  navLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  navLogo: { fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: -0.5 },
  navDivider: { color: 'rgba(255,255,255,0.2)', fontSize: 18 },
  navSub: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 500 },
  navRight: { display: 'flex', alignItems: 'center', gap: 16 },
  internalBadge: { background: '#DC2626', color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: '3px 8px', borderRadius: 4 },
  liveCount: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  liveDot: { width: 7, height: 7, borderRadius: '50%', background: TEAL_ACCENT },
  statRow: { display: 'flex', gap: 14, padding: '24px 32px 0', flexWrap: 'wrap' },
  card: { borderRadius: 10, padding: '18px 22px', flex: '1 1 130px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  cardLabel: { margin: 0, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 },
  cardValue: { margin: '8px 0 4px', fontSize: 28, fontWeight: 700, lineHeight: 1 },
  cardSub: { margin: 0, fontSize: 12 },
  moduleSection: { margin: '20px 32px 0', background: '#fff', borderRadius: 10, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${TEAL_BORDER}` },
  moduleSectionHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionLabel: { fontSize: 12, fontWeight: 700, color: TEAL_MID, textTransform: 'uppercase', letterSpacing: 1 },
  sectionSub: { fontSize: 12, color: '#9CA3AF' },
  moduleGrid: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  moduleChip: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 100, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, outline: 'none', fontFamily: 'inherit' },
  moduleChipDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  moduleChipName: { color: '#374151' },
  moduleChipCount: { fontWeight: 700 },
  tableSection: { margin: '16px 32px 0', background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' },
  tableTopBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #F3F4F6', flexWrap: 'wrap', gap: 12 },
  tableTitle: { display: 'flex', alignItems: 'center', gap: 10 },
  h2: { margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' },
  dealerCount: { fontSize: 12, background: TEAL_LIGHT, color: TEAL_MID, border: `1px solid ${TEAL_BORDER}`, padding: '2px 10px', borderRadius: 100, fontWeight: 600 },
  filters: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  searchInput: { border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', minWidth: 200, color: '#374151', fontFamily: 'inherit' },
  select: { border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', color: '#374151', background: '#fff', fontFamily: 'inherit', cursor: 'pointer' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#F8FAFC' },
  th: { padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8, whiteSpace: 'nowrap', borderBottom: '1px solid #F1F5F9' },
  tr: { borderBottom: '1px solid #F3F4F6' },
  td: { padding: '13px 16px', fontSize: 14, color: '#374151', verticalAlign: 'middle' },
  bizName: { fontWeight: 600, color: '#111827', fontSize: 14 },
  founderBadge: { fontSize: 9, fontWeight: 700, letterSpacing: 0.8, background: TEAL_LIGHT, color: TEAL_MID, border: `1px solid ${TEAL_BORDER}`, padding: '2px 6px', borderRadius: 4 },
  pill: { display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, textTransform: 'capitalize' },
  modulePill: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  modulePillDot: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
  deleteBtn: {
    background: 'transparent',
    border: '1px solid #FCA5A5',
    color: '#EF4444',
    borderRadius: 6,
    width: 28,
    height: 28,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
};