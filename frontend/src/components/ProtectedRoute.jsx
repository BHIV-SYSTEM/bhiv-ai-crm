import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/MongoAuthContext';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  const role = user?.role;
  const path = location.pathname;
  const isCustomerPortal = path.startsWith('/customer-portal');
  const isSellerPortal = path.startsWith('/seller-portal');

  // Customers are RESTRICTED to the customer portal only
  if (role === 'customer' && !isCustomerPortal) {
    return <Navigate to="/customer-portal" replace />;
  }

  // Sellers are RESTRICTED to the seller portal only (no SETU products,
  // no customer portal — the seller portal is their whole workspace).
  if (role === 'seller' && !isSellerPortal) {
    return <Navigate to="/seller-portal" replace />;
  }

  return children;
};

export default ProtectedRoute;
