import { Routes, Route, Navigate } from 'react-router-dom';
import QuotePage from './QuotePage';
import SignupPage from './SignupPage';
import BillingSuccessPage from './BillingSuccessPage';
import AdminDashboard from './AdminDashboard';

export default function App() {
  return (
    <Routes>
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/billing/success" element={<BillingSuccessPage />} />
      <Route path="/billing/cancelled" element={<Navigate to="/signup" replace />} />
      <Route path="/quote/:token" element={<QuoteTokenWrapper />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="*" element={<Navigate to="/signup" replace />} />
    </Routes>
  );
}

function QuoteTokenWrapper() {
  const token = window.location.pathname.split('/quote/')[1];
  return <QuotePage token={token} />;
}