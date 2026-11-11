import React, { useState, useEffect } from 'react';
import { 
  Package, Truck, BarChart3, Bot, 
  Download, Search, Maximize2, RefreshCw,
  Building2, Truck as TruckIcon, LayoutDashboard,
  TrendingUp, Activity, AlertCircle
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardContent } from '../components/common/ui/Card';
import Button from '../components/common/ui/Button';
import Input from '../components/common/forms/Input';
import Badge from '../components/common/ui/Badge';
import Alert from '../components/common/ui/Alert';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/common/ui/Table';
import { LoadingSpinner } from '../components/common/ui/Spinner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import MetricCard from '../components/common/charts/MetricCard';
import { orderAPI } from '../services/api/orderAPI';
import { productAPI } from '../services/api/productAPI';
import { restockAPI } from '../services/api/restockAPI';
import { logisticsAPI } from '../services/api/logisticsAPI';
import { inventoryAPI } from '../services/api/inventoryAPI';
import { formatDate } from '@/utils/dateUtils';

export const Logistics = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Orders data
  const [orders, setOrders] = useState([]);

  // Shipments data
  const [shipments, setShipments] = useState([]);

  // Inventory data for chart
  const [inventoryData, setInventoryData] = useState([]);

  // Real stock-change history (inventory adjustment logs) for the trend chart
  const [inventoryLogs, setInventoryLogs] = useState([]);

  // Low stock products (stockQuantity < minThreshold)
  const [lowStockProducts, setLowStockProducts] = useState([]);

  // Agent activity data
  const [agentActivity, setAgentActivity] = useState([]);

  // Fetch all data
  useEffect(() => {
    fetchAllData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchAllData();
    }, 30000);

    return () => clearInterval(interval);
  }, [activeTab]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch orders
      try {
        const ordersResponse = await orderAPI.getOrders({ limit: 100 });
        const rawOrders = ordersResponse.data?.data?.orders || ordersResponse.data?.orders || (Array.isArray(ordersResponse.data) ? ordersResponse.data : []);
        // Real orders only — a fresh account with no orders honestly shows 0
        // (the old `demoOrders` fallback injected the same fake orders for
        // every account).
        setOrders(Array.isArray(rawOrders) ? rawOrders : []);
      } catch (err) {
        console.warn('Failed to fetch orders:', err);
      }

      // Fetch inventory
      try {
        const inventoryResponse = await productAPI.getProducts({ limit: 1000, bustCache: true });
        const rawProducts = inventoryResponse.data?.data?.products || inventoryResponse.data?.products || (Array.isArray(inventoryResponse.data) ? inventoryResponse.data : []);
        const products = Array.isArray(rawProducts) ? rawProducts : [];

        const lowStock = products
          .filter(p => (p.stockQuantity ?? 0) < (p.minThreshold ?? 0))
          .sort((a, b) => (a.stockQuantity ?? 0) - (b.stockQuantity ?? 0));
        setLowStockProducts(lowStock);

        setInventoryData(products.map(p => ({
          productId: p._id,
          ProductID: p.name || p.sku,
          CurrentStock: p.stockQuantity || 0
        })));
      } catch (err) {
        console.warn('Failed to fetch inventory:', err);
      }

      // Real stock-change history for the Inventory Levels Trend chart
      try {
        const logsResponse = await inventoryAPI.getInventoryLogs({ limit: 500 });
        const rawLogs = logsResponse.data?.data?.logs || logsResponse.data?.logs || [];
        setInventoryLogs(Array.isArray(rawLogs) ? rawLogs : []);
      } catch (err) {
        console.warn('Failed to fetch inventory logs:', err);
        setInventoryLogs([]);
      }

      // Active shipments — real list from the backend (customers/sellers get
      // their own scoped rows; the old hard-coded SHP-901/902 entries were
      // shown to every account identically)
      try {
        const shipmentsResponse = await logisticsAPI.getShipments();
        const rawShipments = shipmentsResponse.data?.shipments || shipmentsResponse.data?.data?.shipments || (Array.isArray(shipmentsResponse.data) ? shipmentsResponse.data : []);
        setShipments(Array.isArray(rawShipments) ? rawShipments : []);
      } catch (err) {
        console.warn('Failed to fetch shipments:', err);
        setShipments([]);
      }

      // Fetch recent procurement/restock activity (Agents tab)
      try {
        const restockResponse = await restockAPI.getRestockRequests({ limit: 10 });
        const rawRestock = restockResponse.data?.data?.requests || restockResponse.data?.requests || [];
        setAgentActivity(Array.isArray(rawRestock) ? rawRestock : []);
      } catch (err) {
        console.warn('Failed to fetch restock activity:', err);
      }

      // Calculate metrics from fetched data
      // (KPIs are derived from state in `overviewMetrics` below — no
      //  dead duplicate calculations here)

    } catch (err) {
      console.error('Error fetching logistics data:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusVariant = (status) => {
    const variants = {
      PLACED: 'warning',
      PROCESSING: 'warning',
      DISPATCHED: 'info',
      PENDING_PICKUP: 'warning',
      PICKED_UP: 'info',
      IN_TRANSIT: 'info',
      OUT_FOR_DELIVERY: 'info',
      DELIVERED: 'success',
      CANCELLED: 'destructive',
    };
    return variants[String(status || '').toUpperCase()] || 'default';
  };

  const getRestockStatusVariant = (status) => {
    const variants = {
      PENDING: 'warning',
      EMAIL_SENT: 'info',
      RESTOCKED: 'success'
    };
    return variants[status] || 'default';
  };

  const handleDispatchOrder = async (orderId) => {
    try {
      await orderAPI.dispatchOrder(orderId);
      fetchAllData();
    } catch (err) {
      console.error('Failed to dispatch order:', err);
      setError(err.response?.data?.message || err.message || 'Failed to dispatch order');
    }
  };

  const handleRunProcurementAgent = async () => {
    setLoading(true);
    try {
      setError(null);
      setSuccess(null);

      const response = await restockAPI.runProcurementAgent();
      const summary = response?.data?.data;

      if (summary) {
        const parts = [
          `Low stock: ${summary.lowStockProducts ?? 0}`,
          `Emailed: ${summary.emailed ?? 0}`,
          `Missing supplier email: ${summary.skippedMissingSupplierEmail ?? 0}`,
          `Already emailed: ${summary.skippedAlreadyEmailed ?? 0}`,
          `Failures: ${summary.failures ?? 0}`
        ];
        setSuccess(`Procurement run completed. ${parts.join(' | ')}`);

        if ((summary.failures ?? 0) > 0) {
          const firstError = summary.results?.find(r => r.status === 'failed')?.error;
          setError(firstError ? `Some emails failed: ${firstError}` : 'Some emails failed. Check SMTP configuration.');
        }
      } else {
        setSuccess('Procurement run completed.');
      }

      await fetchAllData();
    } catch (error) {
      console.error('Error running procurement agent:', error);
      setError(error.response?.data?.message || error.message || 'Failed to run procurement agent');
    } finally {
      setLoading(false);
    }
  };

  const handleRunDeliveryAgent = async () => {
    setLoading(true);
    try {
      setError(null);
      setSuccess(null);
      const response = await logisticsAPI.runDeliveryAgent();
      const message = response.data?.message || 'Delivery agent run completed: 1 shipment dispatched';
      setSuccess(message);
      await fetchAllData();
    } catch (err) {
      console.error('Error running delivery agent:', err);
      setError(err.response?.data?.message || err.message || 'Failed to run delivery agent');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshActivity = async () => {
    setLoading(true);
    try {
      const restockResponse = await restockAPI.getRestockRequests({ limit: 10 });
      setAgentActivity(restockResponse.data?.data?.requests || []);
    } catch (error) {
      console.error('Error refreshing activity:', error);
    } finally {
      setLoading(false);
    }
  };

  // Overview metrics (computed from real data)
  const inTransitStatuses = ['PENDING_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'DISPATCHED', 'OUT_FOR_DELIVERY'];
  const overviewMetrics = {
    totalOrders: orders.length,
    totalShipments: shipments.length,
    processingOrders: orders.filter(o => (o.status === 'PLACED' || o.status === 'Processing')).length,
    inTransitShipments: shipments.filter(s => inTransitStatuses.includes(String(s.status || '').toUpperCase())).length,
    totalInventory: inventoryData.reduce((sum, item) => sum + (item.CurrentStock || item.current_stock || 0), 0),
    agentActions: agentActivity.length,
  };

  // Orders trend data (last 7 days from real data)
  const ordersTrendData = (() => {
    const last7Days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const isoDate = date.toISOString().split('T')[0];
      const displayDate = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      const dayOrders = orders.filter(o => {
        const orderDate = String(o.OrderDate || o.order_date || o.createdAt || '');
        return orderDate.includes(isoDate) || (i === 0 && !orderDate);
      });
      const dayShipments = shipments.filter(s => {
        const shipDate = String(s.created_at || s.timestamp || s.shipment_date || '');
        return shipDate.includes(isoDate) || (i === 0 && !shipDate);
      });

      last7Days.push({
        date: displayDate,
        orders: dayOrders.length,
        shipments: dayShipments.length
      });
    }
    return last7Days;
  })();

  // Order status distribution
  const orderStatusData = [
    { name: 'Placed', value: orders.filter(o => (o.status === 'PLACED' || o.Status === 'Placed' || o.status === 'Processing')).length },
    { name: 'Dispatched', value: orders.filter(o => (o.status === 'DISPATCHED' || o.Status === 'Dispatched' || o.status === 'Shipped')).length },
    { name: 'Delivered', value: orders.filter(o => (o.status === 'DELIVERED' || o.Status === 'Delivered')).length },
    { name: 'Cancelled', value: orders.filter(o => (o.status === 'CANCELLED' || o.Status === 'Cancelled')).length },
  ].filter(item => item.value > 0);

  // Shipment status distribution (real data — status values are normalized
  // because the backend uses both order-style (DISPATCHED) and delivery-flow
  // (IN_TRANSIT / OUT_FOR_DELIVERY / …) vocabularies)
  const shipmentStatusData = (() => {
    const counts = {};
    shipments.forEach(s => {
      const st = String(s.status || 'UNKNOWN').toUpperCase();
      counts[st] = (counts[st] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0);
  })();

  // Inventory trend data — REAL stock history reconstructed from inventory
  // adjustment logs (each log records newStock at a point in time). Products
  // without any recorded change show a flat line at their current stock; if
  // there is no history at all the chart stays empty instead of drawing
  // invented wobble (the old code added `Math.sin(...)*5` noise).
  const inventoryTrendData = (() => {
    if (inventoryData.length === 0) return [];
    const topProducts = inventoryData.slice(0, 5);

    // Day boundaries for the last 7 days (oldest → newest)
    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const end = new Date(today);
      end.setDate(end.getDate() - i);
      end.setHours(23, 59, 59, 999);
      const displayDate = `${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
      days.push({ displayDate, endMs: end.getTime() });
    }

    const logsByProduct = {};
    inventoryLogs.forEach(log => {
      const key = String(log.productId?._id || log.productId || '');
      if (!key) return;
      (logsByProduct[key] = logsByProduct[key] || []).push(log);
    });
    Object.values(logsByProduct).forEach(list => {
      list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    });

    const hasAnyHistory = Object.keys(logsByProduct).length > 0;
    if (!hasAnyHistory) return [];

    return days.map(day => {
      const entry = { date: day.displayDate };
      topProducts.forEach((product, pIdx) => {
        const prodKey = product.ProductID || product.product_id || `Prod ${pIdx + 1}`;
        const logs = logsByProduct[String(product.productId || '')] || [];
        if (logs.length === 0) {
          // No recorded changes → current stock (a real, flat value)
          entry[prodKey] = Number(product.CurrentStock || 0);
          return;
        }
        // Latest recorded state at/before the end of this day
        const upTo = logs.filter(l => new Date(l.createdAt).getTime() <= day.endMs);
        if (upTo.length > 0) {
          entry[prodKey] = Number(upTo[upTo.length - 1].newStock ?? 0);
        } else {
          // Before the first recorded change: the recorded pre-change stock
          entry[prodKey] = Number(logs[0].previousStock ?? logs[0].newStock ?? 0);
        }
      });
      return entry;
    });
  })();

  const COLORS = [
    'hsl(var(--primary))',
    'hsl(var(--secondary))',
    'hsl(var(--accent))',
    'hsl(var(--info))',
    'hsl(var(--success))',
    'hsl(var(--warning))',
  ];

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Success/Error Alerts */}
      {success && (
        <Alert variant="success" onClose={() => setSuccess(null)}>
          <AlertCircle className="h-4 w-4 mr-2" />
          {success}
        </Alert>
      )}
      {error && (
        <Alert variant="destructive" onClose={() => setError(null)}>
          <AlertCircle className="h-4 w-4 mr-2" />
          {error}
        </Alert>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-6 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
            activeTab === 'overview'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
            activeTab === 'orders'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Package className="h-4 w-4" />
          Orders
        </button>
        <button
          onClick={() => setActiveTab('shipments')}
          className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
            activeTab === 'shipments'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Truck className="h-4 w-4" />
          Shipments
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
            activeTab === 'inventory'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          Inventory
        </button>
        <button
          onClick={() => setActiveTab('agents')}
          className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
            activeTab === 'agents'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Bot className="h-4 w-4" />
          Agents
        </button>
      </div>

      {/* Overview Section */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
        <div>
            <h1 className="text-3xl font-heading font-bold tracking-tight">Logistics & Inventory Overview</h1>
          <p className="text-muted-foreground mt-1">
              Comprehensive view of orders, shipments, inventory, and agent activity
          </p>
      </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <MetricCard
          title="Total Orders"
              value={overviewMetrics.totalOrders}
          icon={Package}
          variant="primary"
            />
            <MetricCard
              title="Total Shipments"
              value={overviewMetrics.totalShipments}
              icon={Truck}
              variant="info"
            />
            <MetricCard
              title="Processing Orders"
              value={overviewMetrics.processingOrders}
              icon={Activity}
              variant="warning"
        />
        <MetricCard
          title="In Transit"
              value={overviewMetrics.inTransitShipments}
          icon={Truck}
          variant="info"
        />
        <MetricCard
              title="Total Inventory"
              value={overviewMetrics.totalInventory}
              icon={BarChart3}
          variant="success"
        />
        <MetricCard
              title="Agent Actions"
              value={overviewMetrics.agentActions}
              icon={Bot}
              variant="accent"
        />
      </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Low Stock Products
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>product</TableHead>
                      <TableHead>sku</TableHead>
                      <TableHead>stock</TableHead>
                      <TableHead>threshold</TableHead>
                      <TableHead>supplier email</TableHead>
                      <TableHead>status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStockProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                          No low stock products
                        </TableCell>
                      </TableRow>
                    ) : (
                      lowStockProducts.slice(0, 10).map((p) => (
                        <TableRow key={p._id || p.sku}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                          <TableCell className="font-mono text-xs">{p.stockQuantity ?? 0}</TableCell>
                          <TableCell className="font-mono text-xs">{p.minThreshold ?? 0}</TableCell>
                          <TableCell className="max-w-xs truncate">{p.supplier?.email || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="warning">LOW</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Orders Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Orders & Shipments Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={ordersTrendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      className="text-xs"
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      className="text-xs"
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem',
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="orders" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      name="Orders"
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="shipments" 
                      stroke="hsl(var(--info))" 
                      strokeWidth={2}
                      name="Shipments"
                      dot={{ fill: 'hsl(var(--info))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Order Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Order Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={orderStatusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {orderStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Shipment Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Shipment Status Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={shipmentStatusData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      className="text-xs"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      className="text-xs"
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem',
                      }}
                    />
                    <Bar 
                      dataKey="value" 
                      fill="hsl(var(--primary))"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Inventory Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Inventory Levels Trend</CardTitle>
              </CardHeader>
              <CardContent>
                {inventoryTrendData.length === 0 ? (
                  <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
                    No stock-change history yet
                  </div>
                ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={inventoryTrendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      className="text-xs"
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      className="text-xs"
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem',
                      }}
                    />
                    <Legend />
                    {inventoryData.slice(0, 5).map((product, index) => {
                      const prodKey = product.ProductID || product.product_id || `Prod ${index + 1}`;
                      const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                      const strokeColor = colors[index % colors.length];
                      return (
                        <Line 
                          key={prodKey}
                          type="monotone" 
                          dataKey={prodKey} 
                          name={prodKey}
                          stroke={strokeColor} 
                          strokeWidth={2}
                          dot={{ fill: strokeColor }}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Current Stock Levels Bar Chart */}
      <Card>
        <CardHeader>
              <CardTitle>Current Stock Levels by Product</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={inventoryData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="ProductID" 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    className="text-xs"
                  />
                  <YAxis 
                    label={{ value: 'CurrentStock', angle: -90, position: 'insideLeft' }}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    className="text-xs"
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem',
                    }}
                  />
                  <Bar 
                    dataKey="CurrentStock" 
                    fill="hsl(var(--primary))"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Orders Section */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <h1 className="text-3xl font-heading font-bold tracking-tight">Order Management</h1>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Placed At</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order._id}>
                      <TableCell className="font-medium">{order.orderNumber}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(order.status)}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{order.customerId?.name || 'Customer'}</span>
                          <span className="text-xs text-muted-foreground">{order.customerId?.email || ''}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {(order.items || []).map((it) => `${it.sku}×${it.quantity}`).join(', ')}
                      </TableCell>
                      <TableCell>₹{Number(order.totalAmount || 0).toFixed(2)}</TableCell>
                      <TableCell>{formatDateTime(order.tracking?.placedAt || order.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        {order.status === 'PLACED' ? (
                          <Button size="sm" onClick={() => handleDispatchOrder(order._id)}>
                            Dispatch
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Shipments Section */}
      {activeTab === 'shipments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-heading font-bold tracking-tight">Shipment Tracking</h1>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm">
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Search className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                      <TableHead>shipment_id</TableHead>
                      <TableHead>order_id</TableHead>
                      <TableHead>courier</TableHead>
                      <TableHead>tracking_number</TableHead>
                      <TableHead>status</TableHead>
                      <TableHead>origin</TableHead>
                      <TableHead>destination</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                    {shipments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          No shipments yet — shipments appear here once orders are dispatched
                        </TableCell>
                      </TableRow>
                    ) : shipments.map((shipment) => (
                      <TableRow key={shipment.shipment_id}>
                        <TableCell className="font-medium">{shipment.shipment_id}</TableCell>
                        <TableCell>{shipment.order_id}</TableCell>
                        <TableCell>{shipment.courier_name || shipment.courier_id || '—'}</TableCell>
                        <TableCell>{shipment.tracking_number}</TableCell>
                  <TableCell>
                          <Badge variant={getStatusVariant(shipment.status)}>
                            {shipment.status}
                    </Badge>
                  </TableCell>
                        <TableCell>{shipment.origin || shipment.origin_address || '—'}</TableCell>
                        <TableCell className="max-w-xs truncate">{shipment.destination}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Inventory Section */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <h1 className="text-3xl font-heading font-bold tracking-tight">Inventory Status</h1>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Low Stock Products
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>product</TableHead>
                      <TableHead>sku</TableHead>
                      <TableHead>stock</TableHead>
                      <TableHead>threshold</TableHead>
                      <TableHead>supplier email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStockProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                          No low stock products
                        </TableCell>
                      </TableRow>
                    ) : (
                      lowStockProducts.slice(0, 10).map((p) => (
                        <TableRow key={p._id || p.sku}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                          <TableCell className="font-mono text-xs">{p.stockQuantity ?? 0}</TableCell>
                          <TableCell className="font-mono text-xs">{p.minThreshold ?? 0}</TableCell>
                          <TableCell className="max-w-xs truncate">{p.supplier?.email || '-'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current Stock Levels</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={inventoryData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="ProductID" 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    className="text-xs"
                  />
                  <YAxis 
                    label={{ value: 'CurrentStock', angle: -90, position: 'insideLeft' }}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    className="text-xs"
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem',
                    }}
                  />
                  <Bar 
                    dataKey="CurrentStock" 
                    fill="hsl(var(--primary))"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Agents Section */}
      {activeTab === 'agents' && (
        <div className="space-y-4">
          <h1 className="text-3xl font-heading font-bold tracking-tight">SETU Controls</h1>
          
          <div className="flex items-center gap-4">
            <Button onClick={handleRunProcurementAgent} disabled={loading}>
              <Building2 className="h-4 w-4 mr-2" />
              Run Procurement Agent
            </Button>
            <Button onClick={handleRunDeliveryAgent} disabled={loading} variant="outline">
              <TruckIcon className="h-4 w-4 mr-2" />
              Run Delivery Agent
            </Button>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Agent Activity</CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={handleRefreshActivity}
                      disabled={loading}
                      className={loading ? 'animate-spin' : ''}
                      aria-label="Refresh activity"
                    >
                  <RefreshCw className="h-4 w-4" />
                    </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>created</TableHead>
                      <TableHead>product</TableHead>
                      <TableHead>sku</TableHead>
                      <TableHead>requested</TableHead>
                      <TableHead>supplier</TableHead>
                      <TableHead>status</TableHead>
                      <TableHead>email sent</TableHead>
                      <TableHead>notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agentActivity.map((activity, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-xs">
                          {formatDateTime(activity.createdAt)}
                        </TableCell>
                        <TableCell>{activity.productName || activity.productId?.name || '-'}</TableCell>
                        <TableCell>{activity.sku || activity.productId?.sku || '-'}</TableCell>
                        <TableCell>{activity.requestedQuantity ?? '-'}</TableCell>
                        <TableCell className="max-w-xs truncate">{activity.supplierEmail || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={getRestockStatusVariant(activity.status)}>
                            {activity.status || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {activity.emailSentAt ? formatDateTime(activity.emailSentAt) : '-'}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{activity.notes || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
              </div>
        </CardContent>
      </Card>
        </div>
      )}
    </div>
  );
};

export default Logistics;
