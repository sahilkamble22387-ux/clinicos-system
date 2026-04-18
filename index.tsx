import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App.tsx';
import PricingPage from './pages/PricingPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import Settings from './pages/Settings';
import CheckIn from './pages/CheckIn';
import RxPage from './pages/RxPage';
import Maintenance from './pages/Maintenance';
import LandingPage from './pages/LandingPage';
import AuthCallback from './pages/AuthCallback';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';

const IS_MAINTENANCE_MODE = false;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 500,
          },
          success: {
            iconTheme: { primary: '#6366f1', secondary: '#fff' },
          },
        }}
      />
      <BrowserRouter>
        {IS_MAINTENANCE_MODE ? (
          <Routes>
            <Route path="/maintenance" element={<Maintenance />} />
            <Route path="*" element={<Navigate to="/maintenance" replace />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/checkin/:clinicId" element={<CheckIn />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/rx/:prescriptionId" element={<RxPage />} />
            <Route path="/*" element={<App />} />
          </Routes>
        )}
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
