import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import ErrorBoundary from './components/common/ErrorBoundary';

// Route-level code splitting
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const CampaignsPage = lazy(() => import('./pages/campaigns/CampaignsPage'));
const CampaignDetailPage = lazy(() => import('./pages/campaigns/CampaignDetailPage'));
const FollowupDashboardPage = lazy(() => import('./pages/dashboard/FollowupDashboardPage'));
const DndPage = lazy(() => import('./pages/dnd/DndPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const BackupsPage = lazy(() => import('./pages/admin/BackupsPage'));
const DataManagementPage = lazy(() => import('./pages/admin/DataManagementPage'));
const PublicFormPage = lazy(() => import('./pages/forms/PublicFormPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
// const WhatsAppPage = lazy(() => import('./pages/whatsapp/WhatsAppPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  return user ? <>{children}</> : <Navigate to="/login" />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (user?.role === 'ADMIN') {
    return <>{children}</>;
  }
  return <Navigate to="/dashboard" />;
}

function ThemedToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          borderRadius: '10px',
          border: theme === 'dark' ? '1px solid #334155' : '1px solid #dce7ff',
          background: theme === 'dark' ? '#1e293b' : '#ffffff',
          color: theme === 'dark' ? '#e2e8f0' : '#1e2a44',
          boxShadow: theme === 'dark' ? '0 10px 30px rgba(0, 0, 0, 0.4)' : '0 10px 30px rgba(33, 49, 93, 0.12)',
        },
      }}
    />
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <BrowserRouter>
              <ThemedToaster />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/form/:slug" element={<PublicFormPage />} />
                  <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
                  <Route path="/campaigns" element={<PrivateRoute><AdminRoute><CampaignsPage /></AdminRoute></PrivateRoute>} />
                  <Route path="/campaigns/:id" element={<PrivateRoute><AdminRoute><CampaignDetailPage /></AdminRoute></PrivateRoute>} />
                  <Route path="/followups" element={<PrivateRoute><FollowupDashboardPage /></PrivateRoute>} />
                  <Route path="/dnd" element={<PrivateRoute><DndPage /></PrivateRoute>} />
                  <Route path="/admin/users" element={<PrivateRoute><AdminRoute><AdminUsersPage /></AdminRoute></PrivateRoute>} />
                  <Route path="/admin/backups" element={<PrivateRoute><AdminRoute><BackupsPage /></AdminRoute></PrivateRoute>} />
                  <Route path="/admin/data-management" element={<PrivateRoute><AdminRoute><DataManagementPage /></AdminRoute></PrivateRoute>} />
                  <Route path="/settings" element={<PrivateRoute><AdminRoute><SettingsPage /></AdminRoute></PrivateRoute>} />
                  {/* <Route path="/whatsapp" element={<PrivateRoute><WhatsAppPage /></PrivateRoute>} /> */}
                  <Route path="*" element={<Navigate to="/dashboard" />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
