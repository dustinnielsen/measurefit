import { useEffect, useState } from 'react';
import PricingSettings from './PricingSettings';

const NSS_DEALER_ID = '064bead2-5fd9-4f8f-a06a-13b4e48a2f8c';

export default function SettingsPage() {
  const [dealerId, setDealerId] = useState<string>(NSS_DEALER_ID);

  useEffect(() => {
    const stored = localStorage.getItem('dealer_id');
    if (stored) setDealerId(stored);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F9FAFB',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* Header bar */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #E5E7EB',
        padding: '0 32px',
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/" style={{ fontSize: 16, fontWeight: 700, color: '#2563EB', textDecoration: 'none' }}>
            WindowFit
          </a>
          <span style={{ color: '#D1D5DB' }}>›</span>
          <span style={{ fontSize: 14, color: '#6B7280', fontWeight: 500 }}>Settings</span>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
        <PricingSettings dealerId={dealerId} brandColor="#2563EB" />
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}