import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';
// MongoDB Backend Auth
import { AuthProvider } from './context/MongoAuthContext';
import { ROUTES } from './utils/constants';
import Login from './pages/auth/Login';

// Lazy-loaded pages for fast initial load & route-level code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const UnifiedDashboard = lazy(() => import('./pages/UnifiedDashboard'));
const Logistics = lazy(() => import('./pages/Logistics'));
const CRM = lazy(() => import('./pages/CRM'));
const Infiverse = lazy(() => import('./pages/InfiverseEmbedded'));
const Sampada = lazy(() => import('./pages/SampadaEmbedded'));
const AIArtha = lazy(() => import('./pages/AIArthaEmbedded'));
const Inventory = lazy(() => import('./pages/Inventory'));
const AIQuery = lazy(() => import('./pages/AIQuery'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Products = lazy(() => import('./pages/Products'));
const Agents = lazy(() => import('./pages/Agents'));
const Workflows = lazy(() => import('./pages/Workflows'));
const Decisions = lazy(() => import('./pages/Decisions'));
const Learning = lazy(() => import('./pages/Learning'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Emails = lazy(() => import('./pages/Emails'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const Users = lazy(() => import('./pages/Users'));
const SupplierShowcase = lazy(() => import('./pages/SupplierShowcase'));
const CustomerDashboard = lazy(() => import('./pages/CustomerDashboard'));
const CustomerOrders = lazy(() => import('./pages/customer/CustomerOrders'));
const CustomerAccount = lazy(() => import('./pages/customer/CustomerAccount'));
const BrightConnectionDemo = lazy(() => import('./pages/BrightConnectionDemo'));
const CustomerNotifications = lazy(() => import('./pages/customer/notifications/CustomerNotifications'));
const PayNow = lazy(() => import('./pages/customer/PayNow'));
const ShippingPortal = lazy(() => import('./pages/ShippingPortal'));
const SellerShell = lazy(() => import('./components/layout/SellerShell'));
const FieldProofReviews = lazy(() => import('./pages/FieldProofReviews'));
const FieldAgent = lazy(() => import('./pages/FieldAgent'));

// Auth Pages (non-login flows lazy-loaded)
const Signup = lazy(() => import('./pages/auth/Signup'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/auth/VerifyEmail'));
const OAuthCallback = lazy(() => import('./pages/auth/OAuthCallback'));

const PageLoader = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 p-8 animate-fade-in">
    <div className="h-8 w-8 rounded-full border-2 border-blue-600/20 border-t-blue-600 animate-spin" />
    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Loading workspace...</p>
  </div>
);

function App() {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
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
            <Route path={ROUTES.INVENTORY} element={<Inventory />} />
            <Route path={ROUTES.AI_QUERY} element={<AIQuery />} />
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
            <Route path={ROUTES.FIELD_REVIEWS} element={<FieldProofReviews />} />
            <Route path={ROUTES.FIELD_AGENT} element={<FieldAgent />} />
            <Route path="/customer-portal" element={<CustomerDashboard />} />
            <Route path="/customer-portal/orders" element={<CustomerOrders />} />
            <Route path="/customer-portal/account" element={<CustomerAccount />} />
            <Route path="/customer-portal/notifications" element={<CustomerNotifications />} />
            <Route path="/customer-portal/pay/:orderId" element={<PayNow />} />
          </Route>

          {/* Seller Portal — its own portal & shell (not part of the SETU admin
              layout). Sellers land here after login and never see SETU products. */}
          <Route
            path={ROUTES.SELLER_PORTAL}
            element={
              <ProtectedRoute>
                <SellerShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<ShippingPortal />} />
          </Route>

          {/* Legacy tab URL from earlier builds */}
          <Route
            path={ROUTES.SHIPPING_PORTAL}
            element={<Navigate to={ROUTES.SELLER_PORTAL} replace />}
          />

          {/* Catch all - redirect to dashboard in dev mode */}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
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


