import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';
// MongoDB Backend Auth
import { AuthProvider } from './context/MongoAuthContext';
import { ROUTES } from './utils/constants';

// Pages
import Dashboard from './pages/Dashboard';
import UnifiedDashboard from './pages/UnifiedDashboard';
import Logistics from './pages/Logistics';
import CRM from './pages/CRM';
import Infiverse from './pages/InfiverseEmbedded';
import Sampada from './pages/SampadaEmbedded';
import AIArtha from './pages/AIArthaEmbedded';
import Inventory from './pages/Inventory';
import Suppliers from './pages/Suppliers';
import Products from './pages/Products';
import Agents from './pages/Agents';
import Workflows from './pages/Workflows';
import Decisions from './pages/Decisions';
import Learning from './pages/Learning';
import Notifications from './pages/Notifications';
import Emails from './pages/Emails';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Users from './pages/Users';
import SupplierShowcase from './pages/SupplierShowcase';
import CustomerDashboard from './pages/CustomerDashboard';
import BrightConnectionDemo from './pages/BrightConnectionDemo';
import FieldAgent from './pages/FieldAgent';

// Auth Pages
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import VerifyEmail from './pages/auth/VerifyEmail';
import OAuthCallback from './pages/auth/OAuthCallback';

function App() {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <Routes>
          {/* Auth Routes */}
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/signup" element={<Signup />} />
          <Route path="/auth/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route path="/auth/verify-email" element={<VerifyEmail />} />
          <Route path="/auth/callback" element={<OAuthCallback />} />

          {/* Protected Dashboard Routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path={ROUTES.UNIFIED} element={<UnifiedDashboard />} />
            <Route path={ROUTES.LOGISTICS} element={<Logistics />} />
            <Route path={ROUTES.CRM} element={<CRM />} />
            <Route path={ROUTES.INFIVERSE} element={<Infiverse />} />
            <Route path={ROUTES.SAMPADA} element={<Sampada />} />
            <Route path={ROUTES.AI_ARTHA} element={<AIArtha />} />
            <Route path={ROUTES.SUPPLIERS} element={<Suppliers />} />
            <Route path={ROUTES.PRODUCTS} element={<Products />} />
            <Route path={ROUTES.AGENTS} element={<Agents />} />
            <Route path={ROUTES.WORKFLOWS} element={<Workflows />} />
            <Route path={ROUTES.DECISIONS} element={<Decisions />} />
            <Route path={ROUTES.LEARNING} element={<Learning />} />
            <Route path={ROUTES.NOTIFICATIONS} element={<Notifications />} />
            <Route path={ROUTES.EMAILS} element={<Emails />} />
            <Route path={ROUTES.REPORTS} element={<Reports />} />
            <Route path="/analytics" element={<Reports />} />
            <Route path={ROUTES.SETTINGS} element={<Settings />} />
            <Route path={ROUTES.USERS} element={<Users />} />
            <Route path={ROUTES.SHOWCASE} element={<SupplierShowcase />} />
            <Route path={ROUTES.BRIGHT_CONNECTION} element={<BrightConnectionDemo />} />
            <Route path={ROUTES.FIELD_AGENT} element={<FieldAgent />} />
            <Route path="/customer-portal" element={<CustomerDashboard />} />
          </Route>

          {/* Catch all - redirect to dashboard in dev mode */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#0f172a',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '0.75rem',
              fontSize: '0.875rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#0f172a',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#0f172a',
              },
            },
          }}
        />
      </AuthProvider>
    </Router>
  );
}

export default App;


