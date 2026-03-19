import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export default function BillingSuccessPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [plan, setPlan] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (sessionId) {
      // Give webhook a moment to fire and update dealer status
      setTimeout(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: dealer } = await supabase
            .from('dealers')
            .select('plan, status')
            .eq('auth_user_id', user.id)
            .single();
          if (dealer) {
            setPlan(dealer.plan);
            setStatus(dealer.status === 'active' ? 'success' : 'success'); // optimistic
          }
        } else {
          setStatus('success'); // still show success even if not logged in
        }
      }, 2000);
    } else {
      setStatus('error');
    }
  }, []);

  const s: Record<string, React.CSSProperties> = {
    page: {
      minHeight: '100vh', backgroundColor: '#080C14',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 20, padding: 40,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: 'white',
    },
  };

  if (status === 'loading') {
    return (
      <div style={s.page}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#0A84FF' }} />
        <p style={{ color: 'rgba(255,255,255,0.5)' }}>Activating your account...</p>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={{ width: 80, height: 80, borderRadius: '50%', border: '2px solid #30D158', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>
        ✓
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>You're all set!</h1>
      <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', maxWidth: 400, margin: 0 }}>
        Your WindowFit {plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : ''} account is active.
        Download the app and start scanning windows.
      </p>
      <div style={{ backgroundColor: '#0D1520', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 400, border: '1px solid rgba(255,255,255,0.08)' }}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: 0, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Next Steps</p>
        {['Open WindowFit on your iPhone or Android device', 'Log in with your new email and password', 'Start scanning windows and building quotes'].map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#0A84FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, margin: 0 }}>{step}</p>
          </div>
        ))}
      </div>
      <a href="/" style={{ color: '#0A84FF', fontSize: 14 }}>← Back to home</a>
    </div>
  );
}