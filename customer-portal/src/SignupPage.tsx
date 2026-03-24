import { useState } from 'react';
import { supabase } from './supabase';

// ── All logic preserved exactly, only presentation changed ──────────────────

const PLANS = [
  {
    id: 'price_1TCQW2LvxQtMPVpkECUsES8V',
    name: 'basic',
    label: 'Basic',
    price: '$79',
    period: '/mo',
    description: 'Perfect for independent dealers just getting started.',
    features: ['AR Window Scanner', 'Manual Measurement', 'Quote Builder', 'Up to 3 users', 'Email support'],
    popular: false,
  },
  {
    id: 'price_1TCQWTLvxQtMPVpkyEgtD0TS',
    name: 'pro',
    label: 'Pro',
    price: '$149',
    period: '/mo',
    description: 'For growing teams who need more power and flexibility.',
    features: ['Everything in Basic', 'Customer Portal', 'PDF Quote Delivery', 'Up to 10 users', 'Priority support'],
    popular: true,
  },
  {
    id: 'price_1TCQWmLvxQtMPVpkLCKPkb2G',
    name: 'enterprise',
    label: 'Enterprise',
    price: '$299',
    period: '/mo',
    description: 'Multi-location dealers and high-volume operations.',
    features: ['Everything in Pro', 'White-label branding', 'Analytics dashboard', 'Unlimited users', 'Dedicated support'],
    popular: false,
  },
];

type Step = 'plan' | 'account' | 'processing';

export default function SignupPage() {
  const [step, setStep] = useState<Step>('plan');
  const [selectedPlan, setSelectedPlan] = useState(PLANS[1]);
  const [form, setForm] = useState({
    businessName: '', ownerName: '', email: '',
    password: '', confirmPassword: '', phone: '', city: '', state: '',
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
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create account');

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

      const response = await fetch('https://windowfit-production.up.railway.app/create-checkout-session', {
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
      window.location.href = url;

    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Please try again.');
      setStep('account');
      setLoading(false);
    }
  };

  // ── Shared font import + global resets ────────────────────────────────────
  const Fonts = () => (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;500;600;700&display=swap');
      *, *::before, *::after { box-sizing: border-box; }
      body { margin: 0; background: #060E23; }
      input::placeholder { color: rgba(255,255,255,0.2); }
      input:focus { border-color: rgba(30,111,255,0.6) !important; outline: none; }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(20px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `}</style>
  );

  // ── Nav bar (shared across steps) ─────────────────────────────────────────
  const NavBar = () => (
    <nav style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 clamp(1.5rem, 5vw, 4rem)', height: 68,
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      background: 'rgba(6,14,35,0.95)', backdropFilter: 'blur(12px)',
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 7,
          background: 'linear-gradient(135deg, #1E6FFF, #00C2FF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 900, color: '#fff',
          fontFamily: "'Outfit', sans-serif",
        }}>W</div>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '1.1rem', color: '#fff', letterSpacing: '-0.02em' }}>
          WindowFit
        </span>
      </a>
      <a href="/signup" style={{
        fontFamily: "'Outfit', sans-serif", fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)',
        textDecoration: 'none',
      }}>
        Already have an account? <span style={{ color: '#1E6FFF', fontWeight: 600 }}>Sign in</span>
      </a>
    </nav>
  );

  // ── Step indicator ─────────────────────────────────────────────────────────
  const StepIndicator = ({ current }: { current: 'plan' | 'account' }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', margin: '2rem 0 0' }}>
      {(['plan', 'account'] as const).map((s, i) => {
        const active = s === current;
        const done = (current === 'account' && s === 'plan');
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: done ? 'linear-gradient(135deg, #1E6FFF, #00C2FF)' : active ? 'linear-gradient(135deg, #1E6FFF, #00C2FF)' : 'rgba(255,255,255,0.08)',
              border: active || done ? 'none' : '1px solid rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Outfit', sans-serif", fontSize: '0.78rem', fontWeight: 700,
              color: active || done ? '#fff' : 'rgba(255,255,255,0.3)',
            }}>
              {done ? '✓' : i + 1}
            </div>
            <span style={{
              fontFamily: "'Outfit', sans-serif", fontSize: '0.82rem', fontWeight: 600,
              color: active ? '#fff' : done ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)',
              textTransform: 'capitalize',
            }}>{s === 'plan' ? 'Choose Plan' : 'Create Account'}</span>
            {i < 1 && <div style={{ width: 32, height: 1, background: done ? '#1E6FFF' : 'rgba(255,255,255,0.1)', margin: '0 0.25rem' }} />}
          </div>
        );
      })}
    </div>
  );

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 1 — Plan Selection
  // ────────────────────────────────────────────────────────────────────────────
  if (step === 'plan') {
    return (
      <>
        <Fonts />
        <div style={{ minHeight: '100vh', background: '#060E23', color: '#fff', position: 'relative', overflow: 'hidden' }}>
          {/* Background grid */}
          <div style={{
            position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
            backgroundImage: `linear-gradient(rgba(30,111,255,0.04) 1px, transparent 1px),
              linear-gradient(90deg, rgba(30,111,255,0.04) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <NavBar />
            <StepIndicator current="plan" />

            <div style={{
              maxWidth: 1100, margin: '0 auto',
              padding: '3rem clamp(1.5rem, 5vw, 3rem) 6rem',
              animation: 'fadeUp 0.6s ease both',
            }}>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
                <h1 style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 'clamp(2.8rem, 6vw, 5rem)',
                  lineHeight: 0.95, color: '#fff', margin: '0 0 1rem', letterSpacing: '0.01em',
                }}>Choose Your Plan</h1>
                <p style={{
                  fontFamily: "'Outfit', sans-serif", fontSize: '1rem',
                  color: 'rgba(255,255,255,0.5)', margin: 0,
                }}>
                  Start with a 14-day free trial. No credit card required.
                </p>
              </div>

              {/* Plan cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1.25rem',
                alignItems: 'start',
                marginBottom: '2.5rem',
              }}>
                {PLANS.map((plan) => {
                  const isSelected = selectedPlan.id === plan.id;
                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      style={{
                        background: isSelected
                          ? 'linear-gradient(145deg, rgba(30,111,255,0.12), rgba(0,194,255,0.06))'
                          : 'rgba(255,255,255,0.03)',
                        border: isSelected
                          ? '2px solid rgba(30,111,255,0.6)'
                          : '2px solid rgba(255,255,255,0.07)',
                        borderRadius: 16,
                        padding: '2rem 1.75rem',
                        cursor: 'pointer',
                        position: 'relative',
                        transform: plan.popular ? 'scale(1.03)' : 'scale(1)',
                        boxShadow: isSelected ? '0 0 50px rgba(30,111,255,0.12)' : 'none',
                        transition: 'border-color 0.2s, background 0.2s, transform 0.2s, box-shadow 0.2s',
                      }}
                    >
                      {/* Popular badge */}
                      {plan.popular && (
                        <div style={{
                          position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                          background: 'linear-gradient(135deg, #1E6FFF, #00C2FF)',
                          borderRadius: 100, padding: '3px 14px',
                          fontFamily: "'Outfit', sans-serif", fontSize: '0.7rem',
                          fontWeight: 700, color: '#fff', letterSpacing: '0.06em',
                          textTransform: 'uppercase', whiteSpace: 'nowrap',
                        }}>Most Popular</div>
                      )}

                      {/* Plan label */}
                      <div style={{
                        fontFamily: "'Outfit', sans-serif", fontSize: '0.72rem', fontWeight: 700,
                        color: isSelected ? '#00C2FF' : 'rgba(255,255,255,0.4)',
                        letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.6rem',
                      }}>{plan.label}</div>

                      {/* Price */}
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: '0.4rem' }}>
                        <span style={{
                          fontFamily: "'Bebas Neue', sans-serif", fontSize: '3.2rem',
                          color: '#fff', lineHeight: 1,
                        }}>{plan.price}</span>
                        <span style={{
                          fontFamily: "'Outfit', sans-serif", fontSize: '0.9rem',
                          color: 'rgba(255,255,255,0.35)', marginBottom: 6,
                        }}>{plan.period}</span>
                      </div>

                      {/* Description */}
                      <p style={{
                        fontFamily: "'Outfit', sans-serif", fontSize: '0.82rem',
                        color: 'rgba(255,255,255,0.45)', lineHeight: 1.55,
                        margin: '0 0 1.25rem',
                      }}>{plan.description}</p>

                      {/* Features */}
                      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                        {plan.features.map(f => (
                          <li key={f} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                            <span style={{ color: '#1E6FFF', fontSize: '0.85rem', marginTop: 1 }}>✓</span>
                            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '0.85rem', color: 'rgba(255,255,255,0.65)' }}>{f}</span>
                          </li>
                        ))}
                      </ul>

                      {/* Select button */}
                      <div style={{
                        textAlign: 'center', borderRadius: 9, padding: '10px 0',
                        fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '0.85rem',
                        background: isSelected
                          ? 'linear-gradient(135deg, #1E6FFF, #00C2FF)'
                          : 'rgba(255,255,255,0.07)',
                        color: '#fff',
                        border: isSelected ? 'none' : '1px solid rgba(255,255,255,0.1)',
                        transition: 'background 0.2s',
                      }}>
                        {isSelected ? '✓ Selected' : 'Select Plan'}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* CTA */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <button
                  onClick={() => setStep('account')}
                  style={{
                    background: 'linear-gradient(135deg, #1E6FFF, #00C2FF)',
                    color: '#fff', border: 'none', borderRadius: 10,
                    padding: '15px 48px', cursor: 'pointer',
                    fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '1rem',
                    boxShadow: '0 8px 32px rgba(30,111,255,0.35)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(30,111,255,0.5)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(30,111,255,0.35)'; }}
                >
                  Continue with {selectedPlan.label} →
                </button>
                <p style={{
                  fontFamily: "'Outfit', sans-serif", fontSize: '0.82rem',
                  color: 'rgba(255,255,255,0.3)', margin: 0,
                }}>14-day free trial · Cancel anytime · No setup fees</p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 2 — Account Details
  // ────────────────────────────────────────────────────────────────────────────
  if (step === 'account') {
    const inputStyle: React.CSSProperties = {
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10, color: '#fff',
      fontFamily: "'Outfit', sans-serif", fontSize: '0.95rem',
      padding: '12px 14px', width: '100%', boxSizing: 'border-box',
      transition: 'border-color 0.2s',
    };
    const labelStyle: React.CSSProperties = {
      fontFamily: "'Outfit', sans-serif", fontSize: '0.72rem', fontWeight: 700,
      color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase',
      marginBottom: 6, display: 'block',
    };

    return (
      <>
        <Fonts />
        <div style={{ minHeight: '100vh', background: '#060E23', color: '#fff', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
            backgroundImage: `linear-gradient(rgba(30,111,255,0.04) 1px, transparent 1px),
              linear-gradient(90deg, rgba(30,111,255,0.04) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <NavBar />
            <StepIndicator current="account" />

            <div style={{
              maxWidth: 680, margin: '0 auto',
              padding: '3rem clamp(1.5rem, 5vw, 3rem) 6rem',
              animation: 'fadeUp 0.6s ease both',
            }}>
              {/* Back + Plan pill */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <button
                  onClick={() => setStep('plan')}
                  style={{
                    background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
                    fontFamily: "'Outfit', sans-serif", fontSize: '0.9rem', cursor: 'pointer',
                    padding: 0, display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
                >
                  ← Back
                </button>
                <div style={{
                  border: '1px solid rgba(30,111,255,0.4)',
                  borderRadius: 100, padding: '5px 16px',
                  fontFamily: "'Outfit', sans-serif", fontSize: '0.8rem', fontWeight: 600,
                  color: '#00C2FF',
                }}>
                  {selectedPlan.label} · {selectedPlan.price}/mo
                </div>
              </div>

              {/* Title */}
              <h1 style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 'clamp(2.4rem, 5vw, 3.8rem)',
                lineHeight: 0.95, color: '#fff', margin: '0 0 0.5rem',
              }}>Create Your Account</h1>
              <p style={{
                fontFamily: "'Outfit', sans-serif", fontSize: '0.95rem',
                color: 'rgba(255,255,255,0.4)', margin: '0 0 2rem',
              }}>Set up your dealer profile to get started.</p>

              {/* Error */}
              {error && (
                <div style={{
                  background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.3)',
                  borderRadius: 10, padding: '12px 16px',
                  fontFamily: "'Outfit', sans-serif", fontSize: '0.9rem', color: '#FF6B6B',
                  marginBottom: '1.5rem',
                }}>{error}</div>
              )}

              {/* Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                {/* Row 1 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Business Name *</label>
                    <input style={inputStyle} value={form.businessName}
                      onChange={e => update('businessName', e.target.value)}
                      placeholder="Nielsen Shades & Shutters" />
                  </div>
                  <div>
                    <label style={labelStyle}>Owner Name *</label>
                    <input style={inputStyle} value={form.ownerName}
                      onChange={e => update('ownerName', e.target.value)}
                      placeholder="Dustin Nielsen" />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label style={labelStyle}>Email Address *</label>
                  <input style={inputStyle} type="email" value={form.email}
                    onChange={e => update('email', e.target.value)}
                    placeholder="dustin@nielsenshades.com" />
                </div>

                {/* Row 2 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Password *</label>
                    <input style={inputStyle} type="password" value={form.password}
                      onChange={e => update('password', e.target.value)}
                      placeholder="Min 8 characters" />
                  </div>
                  <div>
                    <label style={labelStyle}>Confirm Password *</label>
                    <input style={inputStyle} type="password" value={form.confirmPassword}
                      onChange={e => update('confirmPassword', e.target.value)}
                      placeholder="Repeat password" />
                  </div>
                </div>

                {/* Row 3 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Phone</label>
                    <input style={inputStyle} value={form.phone}
                      onChange={e => update('phone', e.target.value)}
                      placeholder="(801) 555-0100" />
                  </div>
                  <div>
                    <label style={labelStyle}>City</label>
                    <input style={inputStyle} value={form.city}
                      onChange={e => update('city', e.target.value)}
                      placeholder="Salt Lake City" />
                  </div>
                  <div>
                    <label style={labelStyle}>State</label>
                    <input style={inputStyle} value={form.state}
                      onChange={e => update('state', e.target.value)}
                      placeholder="UT" maxLength={2} />
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '0.25rem 0' }} />

                {/* Submit */}
                <button
                  onClick={handleAccountSubmit}
                  disabled={loading}
                  style={{
                    background: loading ? 'rgba(30,111,255,0.4)' : 'linear-gradient(135deg, #1E6FFF, #00C2FF)',
                    color: '#fff', border: 'none', borderRadius: 10,
                    padding: '15px', cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '1rem',
                    width: '100%', boxShadow: loading ? 'none' : '0 8px 32px rgba(30,111,255,0.3)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { if (!loading) { e.currentTarget.style.boxShadow = '0 12px 40px rgba(30,111,255,0.5)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 8px 32px rgba(30,111,255,0.3)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  {loading ? 'Creating account...' : 'Create Account & Continue to Payment →'}
                </button>

                <p style={{
                  fontFamily: "'Outfit', sans-serif", fontSize: '0.78rem',
                  color: 'rgba(255,255,255,0.25)', textAlign: 'center', margin: 0,
                }}>
                  By continuing you agree to our Terms of Service. Your 14-day free trial starts today.
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 3 — Processing
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <>
      <Fonts />
      <div style={{
        minHeight: '100vh', background: '#060E23',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '1rem',
        backgroundImage: `linear-gradient(rgba(30,111,255,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(30,111,255,0.04) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
      }}>
        {/* Spinner */}
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.08)',
          borderTopColor: '#1E6FFF',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '1.1rem', color: '#fff', margin: 0 }}>
          Setting up your account...
        </p>
        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '0.88rem', color: 'rgba(255,255,255,0.35)', margin: 0 }}>
          Redirecting to secure payment...
        </p>
      </div>
    </>
  );
}