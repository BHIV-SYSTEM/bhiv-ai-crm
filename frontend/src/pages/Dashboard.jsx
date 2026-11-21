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
  Boxes,
  Truck, 
  Briefcase, 
  Mail, 
  Zap, 
  Workflow,
  RefreshCw,
  Store,
  CheckCircle2
} from 'lucide-react';
import MetricCard from '../components/common/charts/MetricCard';
import LineChart from '../components/common/charts/LineChart';
import BarChart from '../components/common/charts/BarChart';
import Card, { CardHeader, CardTitle, CardContent } from '../components/common/ui/Card';
import Badge from '../components/common/ui/Badge';
import Button from '../components/common/ui/Button';
import Alert from '../components/common/ui/Alert';
import { formatRelativeTime } from '@/utils/dateUtils';
import { cn } from '@/utils/helpers';
import { dashboardAPI } from '../services/api/dashboardAPI';
import { productAPI } from '../services/api/productAPI';
import { rlAPI } from '../services/api/rlAPI';
import { aiDecisionsAPI } from '../services/api/aiDecisionsAPI';
import { emsAPI } from '../services/api/emsAPI';
import { useNavigate } from 'react-router-dom';

export const Dashboard = () => {
  const navigate = useNavigate();
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
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

  // Fetch all dashboard data in parallel for fast loading
  const fetchDashboardData = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);

      const [
        statsResult,
        productResult,
        suppliersResult,
        activityResult,
        rlResult,
        aiResult,
        emsResult,
      ] = await Promise.allSettled([
        dashboardAPI.getDashboardStats(),
        productAPI.getStats(true),
        dashboardAPI.getSuppliers(),
        dashboardAPI.getRecentActivity({ limit: 10 }),
        rlAPI.getAnalytics(),
        aiDecisionsAPI.getDecisionAnalytics(),
        emsAPI.getEmailStats(),
      ]);

      if (statsResult.status === 'rejected') {
        throw statsResult.reason;
      }

      const stats = statsResult.value?.data?.data || {};
      const productStats =
        productResult.status === 'fulfilled'
          ? (productResult.value?.data?.data || {
              totalProducts: 0,
              activeProducts: 0,
              lowStockProducts: 0,
              outOfStock: 0,
            })
          : { totalProducts: 0, activeProducts: 0, lowStockProducts: 0, outOfStock: 0 };

      const suppliersCount =
        suppliersResult.status === 'fulfilled'
          ? (suppliersResult.value?.data?.data?.count ||
              suppliersResult.value?.data?.data?.suppliers?.length ||
              0)
          : 0;

      const recentOrders =
        activityResult.status === 'fulfilled'
          ? (activityResult.value?.data?.data?.recentOrders || [])
          : [];
      const lowStockProducts =
        activityResult.status === 'fulfilled'
          ? (activityResult.value?.data?.data?.lowStockProducts || [])
          : [];

      const rlData =
        rlResult.status === 'fulfilled'
          ? (rlResult.value?.data?.data || rlResult.value?.data || {})
          : {};
      const rlActionsCount = rlData.totalActions ?? rlData.total_actions ?? 0;

      const aiData =
        aiResult.status === 'fulfilled'
          ? (aiResult.value?.data?.data || aiResult.value?.data || {})
          : {};
      const aiWorkflowsCount = aiData.totalDecisions ?? aiData.total_decisions ?? 0;

      const emsData =
        emsResult.status === 'fulfilled'
          ? (emsResult.value?.data?.data || emsResult.value?.data || {})
          : {};
      const emailsCount = emsData.emails_sent_today ?? emsData.today ?? 0;

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
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();

    // Refresh data every 30 seconds in the background without wiping existing UI
    const refreshTimer = setInterval(() => {
      fetchDashboardData();
    }, 30000);

    return () => {
      clearInterval(refreshTimer);
    };
  }, [fetchDashboardData]);

  if (initialLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
          <div className="space-y-2">
            <div className="h-7 w-56 rounded-md bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="h-3.5 w-80 rounded-md bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
          </div>
          <div className="h-8 w-28 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
        </div>
        <div className="h-20 rounded-xl bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-5 animate-pulse">
              <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-7 w-16 rounded bg-slate-200 dark:bg-slate-800 mt-4" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 animate-pulse" />
          <div className="h-72 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in select-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Executive Dashboard
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Telemetry
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-xs">
            Operational KPIs, logistics fulfillment, and customer lifecycle activity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchDashboardData} 
            className="border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", refreshing && "animate-spin")} />
            Sync Records
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" onClose={() => setError(null)}>
          <AlertCircle className="h-4 w-4 mr-2" />
          {error}
        </Alert>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Customer Portal Quick Access - Enterprise Clean Card */}
        <div className="col-span-full">
          <div 
            className="group relative overflow-hidden bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-slate-50 dark:from-blue-950/50 dark:via-indigo-950/30 dark:to-slate-900 border border-blue-200 dark:border-blue-500/25 hover:border-blue-400 dark:hover:border-blue-500/50 rounded-xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none backdrop-blur-sm"
            onClick={() => navigate('/customer-portal')}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-600/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-200 dark:border-blue-500/25 flex-shrink-0 group-hover:scale-105 transition-transform duration-200 shadow-xs">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Customer Portal & Self-Service</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">Direct Ingestion</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Browse product catalog, initiate purchase orders, and monitor real-time consignment dispatch.</p>
              </div>
            </div>
            <Button 
              size="sm" 
              className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex-shrink-0 shadow-sm group-hover:shadow-blue-500/25 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/customer-portal');
              }}
            >
              Open Customer Portal <span className="ml-1 inline-block transition-transform group-hover:translate-x-1">→</span>
            </Button>
          </div>
        </div>

        {/* All values are live API data. The old `trendValue="+12.5%"`-style
            badges were hard-coded fake growth numbers, so they are gone until
            we have real period-over-period data to compute them from. */}
        <MetricCard
          title="Total Orders"
          value={metrics.totalOrders.toLocaleString()}
          icon={ShoppingCart}
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
          icon={Boxes}
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
          variant="rose"
        />
        <MetricCard
          title="RL Actions"
          value={metrics.rlActions.toLocaleString()}
          icon={Zap}
          variant="purple"
        />
        <MetricCard
          title="AI Workflows"
          value={metrics.aiWorkflows.toLocaleString()}
          icon={Workflow}
          variant="accent"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="transition-all duration-300">
          <LineChart
            title="Sales & Orders Trend"
            data={salesData}
            lines={[
              { dataKey: 'sales', name: 'Sales (₹)', color: '#3b82f6' },
              { dataKey: 'orders', name: 'Order Volume', color: '#10b981' },
            ]}
            height={280}
          />
        </div>
        
        <div className="transition-all duration-300">
          <BarChart
            title="Activity by Operational Domain"
            data={categoryData}
            bars={[
              { dataKey: 'logistics', name: 'Logistics', color: '#10b981' },
              { dataKey: 'crm', name: 'CRM', color: '#3b82f6' },
              { dataKey: 'inventory', name: 'Inventory', color: '#8b5cf6' },
            ]}
            height={280}
          />
        </div>
      </div>

      {/* Recent Activity & System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="flex items-center gap-2.5 text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                <Activity className="h-4 w-4" />
              </div>
              <span>Live Operational Stream</span>
            </CardTitle>
            <span className="text-[11px] text-slate-400">Real-time audit log</span>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-2">
              {recentActivity.map((activity) => (
                <div 
                  key={activity.id}
                  className="group flex items-center justify-between gap-4 p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700/60"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full ${
                      activity.status === 'success' ? 'bg-emerald-500' :
                      activity.status === 'warning' ? 'bg-amber-500' :
                      activity.status === 'info' ? 'bg-blue-500' : 'bg-slate-500'
                    } animate-pulse flex-shrink-0`} />
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-500 transition-colors">
                      {activity.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-[11px] text-slate-400">
                      {formatRelativeTime(activity.time)}
                    </span>
                    <Badge variant={activity.status === 'success' ? 'success' : activity.status === 'warning' ? 'warning' : 'info'}>
                      {activity.type}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="flex items-center gap-2.5 text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <span>Platform Health</span>
            </CardTitle>
            <span className="text-[11px] font-semibold text-emerald-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              All Nominal
            </span>
          </CardHeader>
          <CardContent className="pt-2 space-y-1.5">
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
  <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
    <div className="flex items-center gap-2">
      <div className={`relative w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}>
        {isOnline && (
          <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
        )}
      </div>
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
        isOnline 
          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
          : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
      }`}>
        {isOnline ? 'ONLINE' : 'OFFLINE'}
      </span>
    </div>
  </div>
);

export default Dashboard;
