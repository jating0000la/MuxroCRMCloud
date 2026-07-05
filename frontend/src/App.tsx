import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
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

function ManagerRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role === 'ADMIN' || user?.role === 'MANAGER') {
    return <>{children}</>;
  }
  return <Navigate to="/dashboard" />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/form/:slug" element={<PublicFormPage />} />
          <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
          <Route path="/campaigns" element={<PrivateRoute><ManagerRoute><CampaignsPage /></ManagerRoute></PrivateRoute>} />
          <Route path="/campaigns/:id" element={<PrivateRoute><ManagerRoute><CampaignDetailPage /></ManagerRoute></PrivateRoute>} />
          <Route path="/followups" element={<PrivateRoute><FollowupDashboardPage /></PrivateRoute>} />
          <Route path="/dnd" element={<PrivateRoute><DndPage /></PrivateRoute>} />
          <Route path="/admin/users" element={<PrivateRoute><AdminRoute><AdminUsersPage /></AdminRoute></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><AdminRoute><SettingsPage /></AdminRoute></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
