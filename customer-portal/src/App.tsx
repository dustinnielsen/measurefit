import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { TenantProvider } from './context/TenantContext';
import QuotePage from './QuotePage';
import SignupPage from './SignupPage';
import BillingSuccessPage from './BillingSuccessPage';
import AdminDashboard from './AdminDashboard';
import SettingsPage from './SettingsPage';
import HomePage from './Pages/HomePage';
import MeasureFitHomePage from './Pages/MeasureFitHomePage';

const isMeasureFit = window.location.hostname.includes('measurefit.io');

export default function App() {
  const [dealerId, setDealerId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('dealer_id');
    if (stored) setDealerId(stored);
  }, []);

  return (
    <TenantProvider dealerId={dealerId}>
      <Routes>
        <Route path="/" element={isMeasureFit ? <MeasureFitHomePage /> : <HomePage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/quote/:token" element={<QuoteTokenWrapper />} />
        <Route path="/billing-success" element={<BillingSuccessPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </TenantProvider>
  );
}

function QuoteTokenWrapper() {
  const token = window.location.pathname.split('/quote/')[1];
  return <QuotePage token={token} />;
}