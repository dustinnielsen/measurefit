import { Routes, Route, Navigate } from 'react-router-dom';
import QuotePage from './QuotePage';
import SignupPage from './SignupPage';
import BillingSuccessPage from './BillingSuccessPage';
import AdminDashboard from './AdminDashboard';
import HomePage from "./pages/HomePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/quote/:token" element={<QuoteTokenWrapper />} />
      <Route path="/billing-success" element={<BillingSuccessPage />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function QuoteTokenWrapper() {
  const token = window.location.pathname.split('/quote/')[1];
  return <QuotePage token={token} />;
}