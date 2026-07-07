import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import CampaignsPage from './pages/campaigns/CampaignsPage';
import CampaignDetailPage from './pages/campaigns/CampaignDetailPage';
import FollowupDashboardPage from './pages/dashboard/FollowupDashboardPage';
import DndPage from './pages/dnd/DndPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import PublicFormPage from './pages/forms/PublicFormPage';
import SettingsPage from './pages/settings/SettingsPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  return user ? <>{children}</> : <Navigate to="/login" />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role === 'ADMIN') {
    return <>{children}</>;
  }
  return <Navigate to="/dashboard" />;
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                borderRadius: '10px',
                border: '1px solid #dce7ff',
                background: '#ffffff',
                color: '#1e2a44',
                boxShadow: '0 10px 30px rgba(33, 49, 93, 0.12)',
              },
            }}
          />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/form/:slug" element={<PublicFormPage />} />
            <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
            <Route path="/campaigns" element={<PrivateRoute><AdminRoute><CampaignsPage /></AdminRoute></PrivateRoute>} />
            <Route path="/campaigns/:id" element={<PrivateRoute><AdminRoute><CampaignDetailPage /></AdminRoute></PrivateRoute>} />
            <Route path="/followups" element={<PrivateRoute><FollowupDashboardPage /></PrivateRoute>} />
            <Route path="/dnd" element={<PrivateRoute><DndPage /></PrivateRoute>} />
            <Route path="/admin/users" element={<PrivateRoute><AdminRoute><AdminUsersPage /></AdminRoute></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><AdminRoute><SettingsPage /></AdminRoute></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}
