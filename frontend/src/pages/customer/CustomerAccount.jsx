import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Mail, Shield, ShoppingBag, MapPin, Phone, Building2,
  Package, Bell, LogOut, Loader2, Truck,
} from 'lucide-react';
import { useAuth } from '@/context/MongoAuthContext';
import { orderAPI } from '@/services/api/orderAPI';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/common/ui/Card';
import Badge from '@/components/common/ui/Badge';
import Button from '@/components/common/ui/Button';

/**
 * Account — profile + order stats for the customer.
 * (Finance/GST/TDS lives in ARTHA for staff only; customers get this instead.)
 */
const CustomerAccount = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, placed: 0, onWay: 0, delivered: 0, spend: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await orderAPI.getOrders({ page: 1, limit: 100 });
        if (cancelled) return;
        const orders = res.data?.data?.orders || [];
        const byStatus = (s) => orders.filter((o) => String(o.status) === s).length;
        setStats({
          total: orders.length,
          placed: byStatus('PLACED'),
          onWay: byStatus('DISPATCHED'),
          delivered: byStatus('DELIVERED'),
          spend: orders
            .filter((o) => String(o.status) !== 'CANCELLED')
            .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0),
        });
      } catch {
        /* stats are best-effort */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const shop = user?.shopDetails || {};
  const hasShop = Boolean(shop.shopName || shop.address || shop.phone);

  const CARDS = [
    { label: 'Total orders', value: stats.total, icon: ShoppingBag },
    { label: 'Placed', value: stats.placed, icon: Package },
    { label: 'On the way', value: stats.onWay, icon: Truck },
    { label: 'Delivered', value: stats.delivered, icon: Package },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-heading font-bold">My Account</h1>
        <p className="text-sm text-muted-foreground">
          Your profile, order activity and preferences.
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" /> Profile
          </CardTitle>
          <Badge variant="success">Active</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full gradient-primary shadow-glow-primary flex items-center justify-center">
              <span className="text-2xl font-bold text-primary-foreground">
                {(user?.name || user?.email || '?').slice(0, 1).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-lg font-semibold">{user?.name || '—'}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> {user?.email}
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 rounded-lg border p-3">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Role:</span>
              <span className="font-medium capitalize">Customer</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border p-3">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Account ID:</span>
              <span className="font-mono text-xs">{String(user?._id || '—').slice(-10)}</span>
            </div>
          </div>

          {hasShop && (
            <div className="rounded-lg border p-4 space-y-2 text-sm">
              <p className="font-semibold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                {shop.shopName}
              </p>
              {shop.address && (
                <p className="text-muted-foreground flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" /> {shop.address}
                </p>
              )}
              {shop.phone && (
                <p className="text-muted-foreground flex items-center gap-2">
                  <Phone className="w-4 h-4" /> {shop.phone}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" /> Order activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {CARDS.map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-2xl font-bold mt-1">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/40 p-4">
                <span className="text-sm text-muted-foreground">Total spent</span>
                <span className="text-xl font-bold text-primary">
                  ₹{stats.spend.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </>
          )}
          <Button className="mt-4 w-full" variant="outline" onClick={() => navigate('/customer-portal/orders')}>
            <Package className="w-4 h-4 mr-2" /> View all orders
          </Button>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Button variant="outline" onClick={() => navigate('/customer-portal')}>
            <ShoppingBag className="w-4 h-4 mr-2" /> Continue shopping
          </Button>
          <Button variant="outline" onClick={() => navigate('/customer-portal/notifications')}>
            <Bell className="w-4 h-4 mr-2" /> Notifications
          </Button>
          <Button
            variant="outline"
            className="text-destructive border-destructive/40 hover:bg-destructive hover:text-destructive-foreground"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" /> Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerAccount;
