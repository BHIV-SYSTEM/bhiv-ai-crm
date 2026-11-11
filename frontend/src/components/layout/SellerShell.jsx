import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Package, Truck } from 'lucide-react';
import { useAuth } from '@/context/MongoAuthContext';
import Button from '@/components/common/ui/Button';

/**
 * Seller Portal shell — a self-contained portal for sellers.
 *
 * Deliberately NOT the SETU admin layout: no product sidebar (CRM, Logistics,
 * ARTHA, suppliers…) and no customer portal. One header, one workspace:
 * orders → dispatch → pickup → delivery.
 */
const SellerShell = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <header className="sticky top-0 z-30 h-16 bg-card border-b border-border shadow-sm backdrop-blur-sm">
        <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="gradient-primary rounded-lg px-3 py-2 shadow-glow-primary flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary-foreground" />
              <span className="text-sm font-heading font-bold text-primary-foreground whitespace-nowrap">
                Seller Portal
              </span>
            </div>
            <span className="hidden sm:inline text-xs text-muted-foreground truncate">
              Orders, dispatch & delivery — your workspace on SETU
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center shadow-glow-primary">
                <Package className="h-4 w-4 text-primary-foreground" />
              </span>
              <span className="font-medium truncate max-w-[10rem]">{user?.name || user?.email}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="text-destructive border-destructive/40 hover:bg-destructive hover:text-destructive-foreground"
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-6 max-w-7xl mx-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default SellerShell;
