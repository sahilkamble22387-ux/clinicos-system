import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App.tsx';
import PricingPage from './pages/PricingPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import Settings from './pages/Settings';
import CheckIn from './pages/CheckIn';
import RxPage from './pages/RxPage';
import Maintenance from './pages/Maintenance';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';

const IS_MAINTENANCE_MODE = false;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        {IS_MAINTENANCE_MODE ? (
          <Routes>
            <Route path="/maintenance" element={<Maintenance />} />
            <Route path="*" element={<Navigate to="/maintenance" replace />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/checkin/:clinicId" element={<CheckIn />} />
            <Route path="/rx/:prescriptionId" element={<RxPage />} />
            <Route path="/*" element={<App />} />
          </Routes>
        )}
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
