// src/App.jsx  — final router with all pages wired up
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/auth/AuthContext';
import { ThemeProvider } from '@/auth/ThemeContext';
import { ProtectedRoute, AdminRoute } from '@/auth/ProtectedRoute';
import AppShell       from '@/components/layout/AppShell';
import Overview       from '@/pages/Overview';
import VPGMonitor     from '@/pages/VPGMonitor';
import VRADashboard   from '@/pages/VRADashboard';
import EncryptionPage from '@/pages/Encryption';
import Storage        from '@/pages/Storage';
import UserManagement from '@/pages/Settings/UserManagement';
import VMDetail       from '@/pages/VMDetail';
import Placeholder    from '@/pages/Placeholder';
import Planner        from '@/pages/Planner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 15_000,
      refetchOnWindowFocus: true,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
              <Route index element={<Overview />} />
              <Route path="vpgs"       element={<VPGMonitor />} />
              <Route path="vms"        element={<VMDetail />} />
              <Route path="vras"       element={<VRADashboard />} />
              <Route path="encryption" element={<EncryptionPage />} />
              <Route path="storage"    element={<Storage />} />
              <Route path="planner"   element={<Planner />} />
              <Route path="settings">
                <Route index element={<Navigate to="users" replace />} />
                <Route path="users" element={
                  <AdminRoute><UserManagement /></AdminRoute>
                } />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
