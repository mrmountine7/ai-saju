import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LandingPage } from '@/app/components/LandingPage';
import { StoragePage } from '@/app/components/StoragePage';
import { AddPage } from '@/app/components/AddPage';
import { ResultPage } from '@/app/components/ResultPage';
import { CompatibilityPage } from '@/app/components/CompatibilityPage';
import { DailyFortunePage } from '@/app/components/DailyFortunePage';
import { MenuPage } from '@/app/components/MenuPage';
import ClassicsInfoPage from '@/app/components/ClassicsInfoPage';
import { LoginPage } from '@/app/components/LoginPage';
import { HistoryPage } from '@/app/components/HistoryPage';
import { ExpertModePage } from '@/app/components/ExpertModePage';
import { ExpertSubscriptionPage } from '@/app/components/ExpertSubscriptionPage';
import { ClientManagementPage } from '@/app/components/ClientManagementPage';
import { ExpertClassicsSearch } from '@/app/components/ExpertClassicsSearch';
import { ExpertAiQnA } from '@/app/components/ExpertAiQnA';
import DataQualityDashboard from '@/app/components/DataQualityDashboard';
import { ProtectedRoute } from '@/app/components/ProtectedRoute';
import { ProfileProvider } from '@/lib/profile-context';
import { AuthProvider } from '@/lib/auth-context';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { PaymentPage } from '@/app/components/PaymentPage';
import { PaymentResultPage } from '@/app/components/PaymentResultPage';
import { PaymentHistoryPage } from '@/app/components/PaymentHistoryPage';
import { SubscriptionManagePage } from '@/app/components/SubscriptionManagePage';
import { PaymentGuidePage } from '@/app/components/PaymentGuidePage';
import { TermsPage } from '@/app/components/TermsPage';
import { PrivacyPage } from '@/app/components/PrivacyPage';
import { ErrorBoundary } from '@/app/components/ErrorBoundary';
import { ToastProvider } from '@/contexts/ToastContext';
import { AnalysisModeProvider } from '@/contexts/AnalysisModeContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { initDeviceId, getDeviceInfo } from '@/lib/device-id';

// 기기 ID 초기화 컴포넌트
function DeviceInitializer({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const deviceId = await initDeviceId();
        const info = getDeviceInfo();
        console.log('[App] 기기 초기화 완료');
        console.log('[App] Device ID:', deviceId);
        console.log('[App] Fingerprint:', info.fingerprint);
      } catch (error) {
        console.error('[App] 기기 초기화 오류:', error);
      } finally {
        setInitialized(true);
      }
    };
    init();
  }, []);

  if (!initialized) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">초기화 중...</div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <DeviceInitializer>
        <AuthProvider>
          <AnalysisModeProvider>
          <ThemeProvider>
            <ToastProvider>
              <NotificationProvider>
                <SubscriptionProvider>
                  <ProfileProvider>
                    <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/storage" element={<StoragePage />} />
            <Route path="/add" element={<AddPage />} />
            <Route path="/result" element={<ResultPage />} />
            <Route path="/compatibility" element={<CompatibilityPage />} />
            <Route path="/daily" element={<DailyFortunePage />} />
            <Route path="/payment" element={<PaymentPage />} />
            <Route path="/payment/success" element={<PaymentResultPage />} />
            <Route path="/payment/fail" element={<PaymentResultPage />} />
            <Route path="/payment/history" element={<PaymentHistoryPage />} />
            <Route path="/payment/subscription" element={<SubscriptionManagePage />} />
            <Route path="/payment/guide" element={<PaymentGuidePage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/menu" element={<MenuPage />} />
            <Route path="/classics-info" element={<ClassicsInfoPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route
              path="/expert"
              element={
                <ProtectedRoute requireExpert>
                  <ExpertModePage />
                </ProtectedRoute>
              }
            />
            <Route path="/expert/subscription" element={<ExpertSubscriptionPage />} />
            <Route
              path="/expert/clients"
              element={
                <ProtectedRoute requireExpert>
                  <ClientManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/expert/classics"
              element={
                <ProtectedRoute requireExpert>
                  <ExpertClassicsSearch />
                </ProtectedRoute>
              }
            />
            <Route
              path="/expert/qna"
              element={
                <ProtectedRoute requireExpert>
                  <ExpertAiQnA />
                </ProtectedRoute>
              }
            />
            <Route
              path="/expert/quality"
              element={
                <ProtectedRoute requireExpert>
                  <DataQualityDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
                    </BrowserRouter>
                  </ProfileProvider>
                </SubscriptionProvider>
              </NotificationProvider>
            </ToastProvider>
          </ThemeProvider>
          </AnalysisModeProvider>
        </AuthProvider>
      </DeviceInitializer>
    </ErrorBoundary>
  );
}
