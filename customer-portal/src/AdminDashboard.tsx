import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://windowfit-production.up.railway.app';
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET;

interface Dealer {
  id: string;
  business_name: string;
  email: string;
  plan: string;
  status: string;
  stripe_customer_id: string;
  created_at: string;
}

interface MRRData {
  mrr: number;
  counts: { basic: number; pro: number; enterprise: number };
  total_active: number;
}

const planColors: Record<string, string> = {
  basic: '#6366f1',
  pro: '#0ea5e9',
  enterprise: '#f59e0b',
};

const statusColors: Record<string, { bg: string; text: string }> = {
  active: { bg: '#dcfce7', text: '#15803d' },
  trialing: { bg: '#fef9c3', text: '#a16207' },
  past_due: { bg: '#fee2e2', text: '#b91c1c' },
  canceled: { bg: '#f3f4f6', text: '#6b7280' },
};

function adminFetch(path: string) {
  return fetch(`${API_BASE}${path}`, {
    headers: { 'x-admin-secret': ADMIN_SECRET },
  }).then((r) => r.json());
}

export default function AdminDashboard() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [mrr, setMrr] = useState<MRRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

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

  if (authorized === null) return <LoadingScreen message="Checking access..." />;
  if (authorized === false) return <AccessDenied />;
  if (loading) return <LoadingScreen message="Loading dashboard..." />;

  const filtered = dealers.filter((d) => {
    const matchSearch =
      d.business_name?.toLowerCase().includes(search.toLowerCase()) ||
      d.email?.toLowerCase().includes(search.toLowerCase());
    const matchPlan = filterPlan === 'all' || d.plan?.toLowerCase() === filterPlan;
    const matchStatus = filterStatus === 'all' || d.status?.toLowerCase() === filterStatus;
    return matchSearch && matchPlan && matchStatus;
  });

  const arr = (n: number) => Math.round(n * 12);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.h1}>WindowFit Admin</h1>
          <p style={styles.subtitle}>Super Admin Dashboard</p>
        </div>
        <div style={styles.badge}>INTERNAL</div>
      </div>

      {mrr && (
        <div style={styles.cardRow}>
          <StatCard
            label="Monthly Recurring Revenue"
            value={`$${mrr.mrr.toLocaleString()}`}
            sub={`$${arr(mrr.mrr).toLocaleString()} ARR`}
            color="#0ea5e9"
          />
          <StatCard
            label="Active Dealers"
            value={mrr.total_active}
            sub={`${dealers.length} total`}
            color="#6366f1"
          />
          <StatCard
            label="Basic"
            value={mrr.counts.basic}
            sub={`$${(mrr.counts.basic * 79).toLocaleString()}/mo`}
            color="#6366f1"
          />
          <StatCard
            label="Pro"
            value={mrr.counts.pro}
            sub={`$${(mrr.counts.pro * 149).toLocaleString()}/mo`}
            color="#0ea5e9"
          />
          <StatCard
            label="Enterprise"
            value={mrr.counts.enterprise}
            sub={`$${(mrr.counts.enterprise * 299).toLocaleString()}/mo`}
            color="#f59e0b"
          />
        </div>
      )}

      <div style={styles.section}>
        <div style={styles.tableHeader}>
          <h2 style={styles.h2}>Dealers ({filtered.length})</h2>
          <div style={styles.filters}>
            <input
              style={styles.searchInput}
              placeholder="Search name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              style={styles.select}
              value={filterPlan}
              onChange={(e) => setFilterPlan(e.target.value)}
            >
              <option value="all">All Plans</option>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
            <select
              style={styles.select}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="past_due">Past Due</option>
              <option value="canceled">Canceled</option>
            </select>
          </div>
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={styles.th}>Business</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Plan</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Signed Up</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => {
                const sc = statusColors[d.status?.toLowerCase()] || { bg: '#f3f4f6', text: '#374151' };
                return (
                  <tr key={d.id} style={{ ...styles.tr, background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                    <td style={styles.td}>
                      <span style={styles.bizName}>{d.business_name || '—'}</span>
                    </td>
                    <td style={{ ...styles.td, color: '#6b7280', fontSize: 13 }}>{d.email}</td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.pill,
                          background: planColors[d.plan?.toLowerCase()] || '#e5e7eb',
                          color: '#fff',
                        }}
                      >
                        {d.plan || '—'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ ...styles.pill, background: sc.bg, color: sc.text }}>
                        {d.status || '—'}
                      </span>
                    </td>
                    <td style={{ ...styles.td, color: '#9ca3af', fontSize: 12 }}>
                      {d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ ...styles.td, textAlign: 'center', color: '#9ca3af', padding: '32px' }}>
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

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  return (
    <div style={{ ...styles.card, borderTop: `3px solid ${color}` }}>
      <p style={styles.cardLabel}>{label}</p>
      <p style={{ ...styles.cardValue, color }}>{value}</p>
      <p style={styles.cardSub}>{sub}</p>
    </div>
  );
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, background: '#f9fafb' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTop: '3px solid #0ea5e9', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#6b7280', fontSize: 14 }}>{message}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function AccessDenied() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, background: '#f9fafb' }}>
      <p style={{ fontSize: 48 }}>🔒</p>
      <h2 style={{ color: '#111827', margin: 0 }}>Access Denied</h2>
      <p style={{ color: '#6b7280' }}>Super admin access required.</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#f9fafb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: '0 0 48px 0' },
  header: { background: '#0f172a', color: '#fff', padding: '24px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },