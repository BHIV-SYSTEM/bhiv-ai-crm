import React, { useEffect, useState, useCallback } from 'react';
import { 
  Package, 
  Users, 
  ShoppingCart, 
  TrendingUp, 
  Activity, 
  AlertCircle, 
  UserCheck, 
  Box, 
  Truck, 
  Briefcase, 
  Mail, 
  Zap, 
  Workflow,
  RefreshCw,
  Store
} from 'lucide-react';
import MetricCard from '../components/common/charts/MetricCard';
import LineChart from '../components/common/charts/LineChart';
import BarChart from '../components/common/charts/BarChart';
import Card, { CardHeader, CardTitle, CardContent } from '../components/common/ui/Card';
import Badge from '../components/common/ui/Badge';
import { LoadingSpinner } from '../components/common/ui/Spinner';
import Button from '../components/common/ui/Button';
import Alert from '../components/common/ui/Alert';
import { formatRelativeTime } from '@/utils/dateUtils';
import { dashboardAPI } from '../services/api/dashboardAPI';
import { productAPI } from '../services/api/productAPI';
import { rlAPI } from '../services/api/rlAPI';
import { aiDecisionsAPI } from '../services/api/aiDecisionsAPI';
import { emsAPI } from '../services/api/emsAPI';
import { useNavigate } from 'react-router-dom';

export const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [metrics, setMetrics] = useState({
    totalOrders: 0,
    activeAccounts: 0,
    products: 0,
    suppliers: 0,
    employees: 0,
    emailsSent: 0,
    rlActions: 0,
    aiWorkflows: 0,
    revenue: 0,
  });

  const [salesData, setSalesData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [systemStatus, setSystemStatus] = useState([]);

  // Fetch all dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Dashboard stats (MongoDB backend)
      const statsResponse = await dashboardAPI.getDashboardStats();
      const stats = statsResponse.data?.data || {};

      // Product summary stats
      let productStats = {
        totalProducts: 0,
        activeProducts: 0,
        lowStockProducts: 0,
        outOfStock: 0,
      };
      try {
        const productResponse = await productAPI.getStats(true);
        productStats = productResponse.data?.data || productStats;
      } catch (err) {
        console.warn('Failed to fetch product stats:', err);
      }

      // Suppliers count
      let suppliersCount = 0;
      try {
        const suppliersResponse = await dashboardAPI.getSuppliers();
        suppliersCount = suppliersResponse.data?.data?.count || suppliersResponse.data?.data?.suppliers?.length || 0;
      } catch (err) {
        console.warn('Failed to fetch suppliers:', err);
      }

      // Recent activity (orders + low stock)
      let recentOrders = [];
      let lowStockProducts = [];
      try {
        const activityResponse = await dashboardAPI.getRecentActivity({ limit: 10 });
        recentOrders = activityResponse.data?.data?.recentOrders || [];
        lowStockProducts = activityResponse.data?.data?.lowStockProducts || [];
      } catch (err) {
        console.warn('Failed to fetch recent activity:', err);
      }

      // AI & Automation stats — real API values only. If an endpoint is
      // unreachable the card honestly shows 0 instead of a fabricated number
      // (the old code seeded 526/148/48/12 as "fallbacks").
      let rlActionsCount = 0;
      let aiWorkflowsCount = 0;
      let emailsCount = 0;

      try {
        const rlRes = await rlAPI.getAnalytics();
        const rlData = rlRes.data?.data || rlRes.data || {};
        rlActionsCount = rlData.totalActions ?? rlData.total_actions ?? 0;
      } catch (e) {}

      try {
        const aiRes = await aiDecisionsAPI.getDecisionAnalytics();
        const aiData = aiRes.data?.data || aiRes.data || {};
        aiWorkflowsCount = aiData.totalDecisions ?? aiData.total_decisions ?? 0;
      } catch (e) {}

      try {
        const emsRes = await emsAPI.getEmailStats();
        const emsData = emsRes.data?.data || emsRes.data || {};
        // `??` not `||`: a real value of 0 emails today must show 0, not the
        // old hard-coded 48.
        emailsCount = emsData.emails_sent_today ?? emsData.today ?? 0;
      } catch (e) {}

      const totalOrders = stats.orders?.total ?? 0;
      const activeAccounts = stats.users?.activeCustomers ?? 0;
      const productsCount = productStats.totalProducts ?? stats.products?.total ?? 0;
      const revenueTotal = Number(stats.revenue?.total ?? 0);

      // Employees = staff accounts (total users minus customers), derived
      // from real counts — never a hard-coded 12.
      const employeesCount = stats.users
        ? Math.max((stats.users.total ?? 0) - (stats.users.customerCount ?? 0), 0)
        : 0;

      // Update metrics (only values we can back with real APIs)
      setMetrics({
        totalOrders,
        activeAccounts,
        products: productsCount,
        suppliers: suppliersCount,
        employees: employeesCount,
        emailsSent: emailsCount,
        rlActions: rlActionsCount,
        aiWorkflows: aiWorkflowsCount,
        revenue: Number.isFinite(revenueTotal) ? revenueTotal : 0,
      });

      // Sales & Orders Trend (last 5 days from recent orders)
      const dayLabels = ['4d', '3d', '2d', '1d', 'Today'];
      const buckets = dayLabels.map((label, idx) => ({
        name: label,
        sales: 0,
        orders: 0,
        _minTime: Date.now() - (4 - idx) * 24 * 60 * 60 * 1000,
        _maxTime: Date.now() - (3 - idx) * 24 * 60 * 60 * 1000,
      }));

      recentOrders.forEach((order) => {
        const createdAt = new Date(order.createdAt || order.created_at || Date.now()).getTime();
        const amount = Number(order.totalAmount ?? order.total_amount ?? 0);
        const bucket = buckets.find(b => createdAt >= b._minTime && createdAt < b._maxTime);
        if (bucket) {
          bucket.orders += 1;
          bucket.sales += Number.isFinite(amount) ? amount : 0;
        }
      });

      setSalesData(buckets.map(({ _minTime, _maxTime, ...rest }) => rest));

      // Activity by Category (real counts snapshot)
      setCategoryData([
        {
          name: 'Now',
          logistics: stats.orders?.dispatched ?? 0,
          crm: activeAccounts,
          inventory: stats.products?.lowStock ?? productStats.lowStockProducts ?? 0,
        }
      ]);

      // Recent Activity UI list
      const activityItems = [];

      recentOrders.forEach((order) => {
        const status = String(order.status || '').toUpperCase();
        const time = new Date(order.createdAt || order.created_at || Date.now());
        const number = order.orderNumber || `#${String(order._id || '').slice(-8)}`;
        activityItems.push({
          type: 'order',
          message: `Order ${number} - ${status || 'PLACED'}`,
          time,
          status: status === 'DELIVERED' ? 'success' : status === 'DISPATCHED' ? 'info' : 'warning'
        });
      });

      lowStockProducts.forEach((product) => {
        const qty = product.stockQuantity ?? 0;
        const threshold = product.minThreshold ?? 0;
        const severity = qty === 0 ? 'warning' : qty < threshold ? 'warning' : 'info';
        const time = new Date(product.updatedAt || product.createdAt || Date.now());
        activityItems.push({
          type: 'inventory',
          message: `Low stock: ${product.name} (${qty})`,
          time,
          status: severity
        });
      });

      const formattedActivity = activityItems
        .sort((a, b) => b.time.getTime() - a.time.getTime())
        .slice(0, 5)
        .map((item, index) => ({
          id: index + 1,
          ...item
        }));

      setRecentActivity(formattedActivity.length > 0 ? formattedActivity : [
        { id: 1, type: 'order', message: 'No recent activity', time: new Date(), status: 'info' }
      ]);

      // System status (backed by stats)
      setSystemStatus([
        { label: 'CRM System', isOnline: activeAccounts > 0 },
        { label: 'Inventory', isOnline: productsCount > 0 },
        { label: 'Logistics', isOnline: totalOrders > 0 },
        { label: 'Suppliers', isOnline: suppliersCount > 0 },
        { label: 'Restock', isOnline: (stats.restock?.pending ?? 0) >= 0 },
      ]);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();

    // Update time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Refresh data every 30 seconds
    const refreshTimer = setInterval(() => {
      fetchDashboardData();
    }, 30000);

    return () => {
      clearInterval(timer);
      clearInterval(refreshTimer);
    };
  }, [fetchDashboardData]);

  if (loading) {
    return <LoadingSpinner text="Loading dashboard..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
      <div>
        <h1 className="text-4xl font-heading font-bold tracking-tight bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
          Dashboard Overview
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Welcome back! Here's what's happening with your business today.
        </p>
      </div>
        <Button variant="outline" size="sm" onClick={fetchDashboardData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" onClose={() => setError(null)}>
          <AlertCircle className="h-4 w-4 mr-2" />
          {error}
        </Alert>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Customer Portal Quick Access - Full Width */}
        <div className="col-span-full">
          <Card 
            className="bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 border-2 border-primary/20 hover:border-primary/40 transition-all cursor-pointer" 
            onClick={() => navigate('/customer-portal')}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-primary/20 rounded-xl">
                    <Store className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Customer Portal</h3>
                    <p className="text-muted-foreground">Browse products, place orders, and track deliveries</p>
                  </div>
                </div>
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/customer-portal');
                  }}
                >
                  Open Portal →
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* All values are live API data. The old `trendValue="+12.5%"`-style
            badges were hard-coded fake growth numbers, so they are gone until
            we have real period-over-period data to compute them from. */}
        <MetricCard
          title="Total Orders"
          value={metrics.totalOrders.toLocaleString()}
          icon={Package}
          variant="primary"
        />
        <MetricCard
          title="Active Accounts"
          value={metrics.activeAccounts.toLocaleString()}
          icon={UserCheck}
          variant="secondary"
        />
        <MetricCard
          title="Products"
          value={metrics.products.toLocaleString()}
          icon={Box}
          variant="accent"
        />
        <MetricCard
          title="Suppliers"
          value={metrics.suppliers.toLocaleString()}
          icon={Truck}
          variant="success"
        />
        <MetricCard
          title="Employees"
          value={metrics.employees.toLocaleString()}
          icon={Briefcase}
          variant="primary"
        />
        <MetricCard
          title="Emails Sent"
          value={metrics.emailsSent.toLocaleString()}
          icon={Mail}
          variant="secondary"
        />
        <MetricCard
          title="RL Actions"
          value={metrics.rlActions.toLocaleString()}
          icon={Zap}
          variant="accent"
        />
        <MetricCard
          title="AI Workflows"
          value={metrics.aiWorkflows.toLocaleString()}
          icon={Workflow}
          variant="success"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="transform transition-all duration-300 hover:scale-[1.02]">
          <LineChart
            title="Sales & Orders Trend"
            data={salesData}
            lines={[
              { dataKey: 'sales', name: 'Sales', color: 'hsl(var(--primary))' },
              { dataKey: 'orders', name: 'Orders', color: 'hsl(var(--secondary))' },
            ]}
            height={300}
          />
        </div>
        
        <div className="transform transition-all duration-300 hover:scale-[1.02]">
          <BarChart
            title="Activity by Category"
            data={categoryData}
            bars={[
              { dataKey: 'logistics', name: 'Logistics', color: 'hsl(var(--primary))' },
              { dataKey: 'crm', name: 'CRM', color: 'hsl(var(--secondary))' },
              { dataKey: 'inventory', name: 'Inventory', color: 'hsl(var(--accent))' },
            ]}
            height={300}
          />
        </div>
      </div>

      {/* Recent Activity & System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2 border-l-4 border-primary/50 shadow-lg shadow-primary/10 hover:shadow-xl hover:shadow-primary/20 transition-all duration-300">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Activity className="h-4 w-4 text-white" />
              </div>
              <span>Recent Activity</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.map((activity, index) => (
                <div 
                  key={activity.id}
                  className="group flex items-start gap-4 p-3 rounded-lg hover:bg-gradient-to-r hover:from-muted/50 hover:to-transparent transition-all duration-300 border border-transparent hover:border-primary/20"
                >
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    activity.status === 'success' ? 'bg-green-500' :
                    activity.status === 'warning' ? 'bg-yellow-500' :
                    activity.status === 'info' ? 'bg-blue-500' : 'bg-gray-500'
                  } animate-pulse`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium group-hover:text-primary transition-colors">{activity.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatRelativeTime(activity.time)}
                    </p>
                  </div>
                  <Badge variant={activity.status} className="transition-transform group-hover:scale-110">
                    {activity.type}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card className="border-l-4 border-secondary/50 shadow-lg shadow-secondary/10 hover:shadow-xl hover:shadow-secondary/20 transition-all duration-300">
          <CardHeader className="bg-gradient-to-r from-secondary/5 to-transparent">
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-secondary to-accent flex items-center justify-center">
                <Activity className="h-4 w-4 text-white" />
              </div>
              <span>System Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {systemStatus.map((status, index) => (
              <SystemStatusItem key={index} label={status.label} isOnline={status.isOnline} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const SystemStatusItem = ({ label, isOnline }) => (
  <div className="group flex items-center justify-between p-3 rounded-lg hover:bg-gradient-to-r hover:from-muted/30 hover:to-transparent transition-all duration-300 border border-transparent hover:border-secondary/20">
    <span className="text-sm font-medium group-hover:text-secondary transition-colors">{label}</span>
    <div className="flex items-center gap-2">
      <div className={`relative w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}>
        {isOnline && (
          <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75" />
        )}
      </div>
      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
        isOnline 
          ? 'bg-green-500/10 text-green-600 border border-green-500/20' 
          : 'bg-red-500/10 text-red-600 border border-red-500/20'
      }`}>
        {isOnline ? 'ONLINE' : 'OFFLINE'}
      </span>
    </div>
  </div>
);

export default Dashboard;
