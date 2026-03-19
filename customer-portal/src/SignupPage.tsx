import { useState } from 'react';
import { supabase } from './supabase';

const PLANS = [
  {
    id: 'price_1TCQW2LvxQtMPVpkECUsES8V',
    name: 'basic',
    label: 'Basic',
    price: '$79',
    period: '/mo',
    features: ['AR Window Scanner', 'Manual Measurement', 'Quote Builder', 'Up to 3 users', 'Email support'],
    color: '#0A84FF',
  },
  {
    id: 'price_1TCQWTLvxQtMPVpkyEgtD0TS',
    name: 'pro',
    label: 'Pro',
    price: '$149',
    period: '/mo',
    popular: true,
    features: ['Everything in Basic', 'Customer Portal', 'PDF Quote Delivery', 'Up to 10 users', 'Priority support'],
    color: '#30D158',
  },
  {
    id: 'price_1TCQWmLvxQtMPVpkLCKPkb2G',
    name: 'enterprise',
    label: 'Enterprise',
    price: '$299',
    period: '/mo',
    features: ['Everything in Pro', 'White-label branding', 'Analytics dashboard', 'Unlimited users', 'Dedicated support'],
    color: '#FFD60A',
  },
];

type Step = 'plan' | 'account' | 'processing';

export default function SignupPage() {
  const [step, setStep] = useState<Step>('plan');
  const [selectedPlan, setSelectedPlan] = useState(PLANS[1]); // default Pro
  const [form, setForm] = useState({
    businessName: '',
    ownerName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    city: '',
    state: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field: string, value: string) =>
    setForm(f => ({ ...f, [field]: value }));

  const handleAccountSubmit = async () => {
    setError('');

    if (!form.businessName.trim()) return setError('Business name is required');
    if (!form.ownerName.trim()) return setError('Owner name is required');
    if (!form.email.trim()) return setError('Email is required');
    if (form.password.length < 8) return setError('Password must be at least 8 characters');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match');

    setLoading(true);
    setStep('processing');

    try {
      // 1. Create Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create account');

      // 2. Create dealer record
      const { data: dealer, error: dealerError } = await supabase
        .from('dealers')
        .insert({
          auth_user_id: authData.user.id,
          name: form.businessName.trim(),
          owner_name: form.ownerName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          plan: 'trial',
          status: 'trial',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          logo_initials: form.businessName.trim().split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
        })
        .select()
        .single();

      if (dealerError) throw dealerError;

      // 3. Create Stripe Checkout Session
      const response = await fetch('http://localhost:3001/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: selectedPlan.id,
          dealerId: dealer.id,
          dealerEmail: form.email.trim(),
          dealerName: form.businessName.trim(),
        }),
      });

      const { url, error: checkoutError } = await response.json();
      if (checkoutError) throw new Error(checkoutError);

      // 4. Redirect to Stripe Checkout
      window.location.href = url;

    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Please try again.');
      setStep('account');
      setLoading(false);
    }
  };

  // ── Plan Selection Step ──────────────────────────────────
  if (step === 'plan') {
    return (
      <div style={styles.page}>
        <div style={styles.header}>
          <div style={styles.logo}>WindowFit</div>
          <p style={styles.tagline}>The AR window measurement platform for window covering dealers</p>
        </div>

        <h2 style={styles.stepTitle}>Choose Your Plan</h2>
        <p style={styles.stepDesc}>Start with a 14-day free trial. No credit card required to begin.</p>

        <div style={styles.plansRow}>
          {PLANS.map(plan => (
            <div
              key={plan.id}
              style={{
                ...styles.planCard,
                borderColor: selectedPlan.id === plan.id ? plan.color : 'rgba(255,255,255,0.08)',
                backgroundColor: selectedPlan.id === plan.id ? `${plan.color}11` : '#0D1520',
              }}
              onClick={() => setSelectedPlan(plan)}
            >
              {plan.popular && (
                <div style={{ ...styles.popularBadge, backgroundColor: plan.color }}>
                  Most Popular
                </div>
              )}
              <div style={{ ...styles.planPrice, color: plan.color }}>{plan.price}</div>
              <div style={styles.planPeriod}>{plan.period}</div>
              <div style={styles.planName}>{plan.label}</div>
              <ul style={styles.featureList}>
                {plan.features.map(f => (
                  <li key={f} style={styles.featureItem}>
                    <span style={{ color: plan.color }}>✓ </span>{f}
                  </li>
                ))}
              </ul>
              {selectedPlan.id === plan.id && (
                <div style={{ ...styles.selectedBadge, backgroundColor: plan.color }}>Selected</div>
              )}
            </div>
          ))}
        </div>

        <button style={{ ...styles.btn, backgroundColor: selectedPlan.color }} onClick={() => setStep('account')}>
          Continue with {selectedPlan.label} →
        </button>

        <p style={styles.trialNote}>14-day free trial · Cancel anytime · No setup fees</p>
      </div>
    );
  }

  // ── Account Details Step ─────────────────────────────────
  if (step === 'account') {
    return (
      <div style={styles.page}>
        <div style={styles.header}>
          <div style={styles.logo}>WindowFit</div>
        </div>

        <div style={styles.stepHeader}>
          <button style={styles.backBtn} onClick={() => setStep('plan')}>← Back</button>
          <div style={{ ...styles.planPill, borderColor: selectedPlan.color, color: selectedPlan.color }}>
            {selectedPlan.label} · {selectedPlan.price}/mo
          </div>
        </div>

        <h2 style={styles.stepTitle}>Create Your Account</h2>

        {error && <div style={styles.errorBox}>{error}</div>}

        <div style={styles.form}>
          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Business Name *</label>
              <input
                style={styles.input}
                value={form.businessName}
                onChange={e => update('businessName', e.target.value)}
                placeholder="Nielsen Shades & Shutters"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Owner Name *</label>
              <input
                style={styles.input}
                value={form.ownerName}
                onChange={e => update('ownerName', e.target.value)}
                placeholder="Dustin Nielsen"
              />
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Email Address *</label>
            <input
              style={styles.input}
              type="email"
              value={form.email}
              onChange={e => update('email', e.target.value)}
              placeholder="dustin@nielsenshades.com"
            />
          </div>

          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Password *</label>
              <input
                style={styles.input}
                type="password"
                value={form.password}
                onChange={e => update('password', e.target.value)}
                placeholder="Min 8 characters"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Confirm Password *</label>
              <input
                style={styles.input}
                type="password"
                value={form.confirmPassword}
                onChange={e => update('confirmPassword', e.target.value)}
                placeholder="Repeat password"
              />
            </div>
          </div>

          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Phone</label>
              <input
                style={styles.input}
                value={form.phone}
                onChange={e => update('phone', e.target.value)}
                placeholder="(801) 555-0100"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>City</label>
              <input
                style={styles.input}
                value={form.city}
                onChange={e => update('city', e.target.value)}
                placeholder="Salt Lake City"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>State</label>
              <input
                style={styles.input}
                value={form.state}
                onChange={e => update('state', e.target.value)}
                placeholder="UT"
                maxLength={2}
              />
            </div>
          </div>

          <button
            style={{ ...styles.btn, backgroundColor: selectedPlan.color, opacity: loading ? 0.6 : 1 }}
            onClick={handleAccountSubmit}
            disabled={loading}
          >
            {loading ? 'Creating account...' : `Create Account & Continue to Payment →`}
          </button>

          <p style={styles.trialNote}>
            By continuing you agree to our Terms of Service. Your 14-day free trial starts today.
          </p>
        </div>
      </div>
    );
  }

  // ── Processing Step ──────────────────────────────────────
  return (
    <div style={{ ...styles.page, alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={styles.spinner} />
      <p style={{ color: 'white', fontSize: 18, fontWeight: 700, marginTop: 24 }}>Setting up your account...</p>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 8 }}>Redirecting to secure payment...</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', backgroundColor: '#080C14', color: 'white',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding: '40px 20px', maxWidth: 960, margin: '0 auto',
    display: 'flex', flexDirection: 'column', gap: 24,
  },
  header: { textAlign: 'center', paddingBottom: 8 },
  logo: { fontSize: 28, fontWeight: 800, color: '#0A84FF', letterSpacing: -1 },
  tagline: { color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 6 },
  stepTitle: { color: 'white', fontSize: 26, fontWeight: 800, textAlign: 'center', margin: 0 },
  stepDesc: { color: 'rgba(255,255,255,0.5)', fontSize: 15, textAlign: 'center', margin: 0 },
  stepHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: {
    background: 'none', border: 'none', color: '#0A84FF',
    fontSize: 15, cursor: 'pointer', padding: 0,
  },
  planPill: {
    border: '1px solid', borderRadius: 20, padding: '4px 14px',
    fontSize: 13, fontWeight: 700,
  },
  plansRow: {
    display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center',
  },
  planCard: {
    flex: '1 1 260px', maxWidth: 300, borderRadius: 20, border: '2px solid',
    padding: 24, cursor: 'pointer', position: 'relative',
    transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: 8,
  },
  popularBadge: {
    position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
    color: 'white', fontSize: 11, fontWeight: 800, padding: '4px 12px',
    borderRadius: 20, whiteSpace: 'nowrap',
  },
  planPrice: { fontSize: 40, fontWeight: 800, lineHeight: 1 },
  planPeriod: { color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: -4 },
  planName: { color: 'white', fontSize: 18, fontWeight: 700, marginTop: 4 },
  featureList: { listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 6 },
  featureItem: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  selectedBadge: {
    color: 'white', fontSize: 11, fontWeight: 800, padding: '4px 12px',
    borderRadius: 20, textAlign: 'center', marginTop: 8,
  },
  btn: {
    width: '100%', padding: 16, borderRadius: 14, border: 'none',
    color: 'white', fontSize: 16, fontWeight: 700, cursor: 'pointer',
  },
  trialNote: { color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', margin: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  formRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 160 },
  label: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10, color: 'white', fontSize: 15, padding: 12,
    outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  errorBox: {
    backgroundColor: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.3)',
    borderRadius: 10, padding: 12, color: '#FF453A', fontSize: 14,
  },
  spinner: {
    width: 48, height: 48, borderRadius: '50%',
    border: '3px solid rgba(255,255,255,0.1)',
    borderTopColor: '#0A84FF',
    animation: 'spin 0.8s linear infinite',
  },
};