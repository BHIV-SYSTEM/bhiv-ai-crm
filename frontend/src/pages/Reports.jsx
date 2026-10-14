import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart3, Download, Filter, Calendar, TrendingUp,
  FileText, PieChart, LineChart as LineChartIcon, RefreshCw, AlertCircle
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardContent } from '../components/common/ui/Card';
import Button from '../components/common/ui/Button';
import Input from '../components/common/forms/Input';
import Badge from '../components/common/ui/Badge';
import Alert from '../components/common/ui/Alert';
import { LoadingSpinner } from '../components/common/ui/Spinner';
import { LineChart, Line, BarChart, Bar, PieChart as RechartsPie, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { dashboardAPI } from '../services/api/dashboardAPI';
import { logisticsAPI } from '../services/api/logisticsAPI';
import { productAPI } from '../services/api/productAPI';

export const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReport, setSelectedReport] = useState('sales');
  const [salesData, setSalesData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [inventoryData, setInventoryData] = useState([]);
  const [logisticsData, setLogisticsData] = useState([]);

  // Fetch reports data
  const fetchReportsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch charts data for sales report
      if (selectedReport === 'sales') {
        // Real sales/orders trend from actual orders (last 6 days).
        // The old code filled this chart with Math.random() numbers.
        try {
          const activityResponse = await dashboardAPI.getRecentActivity({ limit: 500 });
          const recentOrders = activityResponse.data?.data?.recentOrders || [];
          const buckets = [];
          for (let i = 5; i >= 0; i--) {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            start.setDate(start.getDate() - i);
            const end = new Date(start);
            end.setDate(end.getDate() + 1);
            const dayOrders = recentOrders.filter((o) => {
              const t = new Date(o.createdAt || o.created_at || 0).getTime();
              return t >= start.getTime() && t < end.getTime();
            });
            buckets.push({
              name: `${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
              sales: dayOrders.reduce((sum, o) => sum + Number(o.totalAmount ?? o.total_amount ?? 0), 0),
              orders: dayOrders.length,
            });
          }
          setSalesData(buckets);
        } catch (err) {
          console.warn('Failed to fetch orders for sales trend:', err);
          setSalesData([]);
        }

        // Real stock-by-category data (no fabricated fallback categories)
        try {
          const chartsResponse = await dashboardAPI.getCharts();
          const charts = chartsResponse.data?.data || chartsResponse.data || {};
          const inventory = charts.inventory || {};
          const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
          if (inventory.labels && Array.isArray(inventory.labels) && inventory.labels.length > 0) {
            const processedCategoryData = inventory.labels.map((label, index) => ({
              name: label,
              value: inventory.currentStock?.[index] ?? 0,
              color: colors[index % colors.length]
            }));
            setCategoryData(processedCategoryData);
          } else {
            setCategoryData([]);
          }
        } catch (err) {
          console.warn('Failed to fetch charts data:', err);
          setCategoryData([]);
        }
      }

      // Fetch inventory data for inventory report
      if (selectedReport === 'inventory') {
        try {
          const inventoryResponse = await productAPI.getProducts();
          const rawInventory = inventoryResponse.data?.data?.products || inventoryResponse.data?.products || (Array.isArray(inventoryResponse.data) ? inventoryResponse.data : []);
          const inventory = Array.isArray(rawInventory) ? rawInventory : [];
          setInventoryData(inventory.slice(0, 10));
        } catch (err) {
          console.warn('Failed to fetch inventory data:', err);
        }
      }

      // Fetch logistics data for logistics report
      if (selectedReport === 'logistics') {
        try {
          const shipmentsResponse = await logisticsAPI.getShipments();
          const rawShipments = shipmentsResponse.data?.data?.shipments || shipmentsResponse.data?.shipments || (Array.isArray(shipmentsResponse.data) ? shipmentsResponse.data : []);
          const shipments = Array.isArray(rawShipments) ? rawShipments : [];
          setLogisticsData(shipments.slice(0, 10));
        } catch (err) {
          console.warn('Failed to fetch logistics data:', err);
        }
      }

    } catch (err) {
      console.error('Error fetching reports data:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [selectedReport]);

  useEffect(() => {
    fetchReportsData();
  }, [fetchReportsData]);

  if (loading) {
    return <LoadingSpinner text="Loading reports..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Generate and view comprehensive business reports
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchReportsData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline">
            <Calendar className="h-4 w-4 mr-2" />
            Date Range
          </Button>
          <Button>
            <Download className="h-4 w-4 mr-2" />
            Export
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

      {/* Report Type Selection */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card 
          hover 
          className={`cursor-pointer transition-all duration-200 ${
            selectedReport === 'sales' 
              ? 'border-2 border-primary bg-primary/10 shadow-lg shadow-primary/20 scale-[1.02]' 
              : 'border border-border opacity-80 hover:opacity-100'
          }`}
          onClick={() => setSelectedReport('sales')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-primary" />
                <div>
                  <h3 className="font-semibold text-foreground">Sales Report</h3>
                  <p className="text-sm text-muted-foreground">Revenue & orders</p>
                </div>
              </div>
              {selectedReport === 'sales' && (
                <Badge variant="success" className="text-xs">Selected</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card 
          hover 
          className={`cursor-pointer transition-all duration-200 ${
            selectedReport === 'inventory' 
              ? 'border-2 border-accent bg-accent/10 shadow-lg shadow-accent/20 scale-[1.02]' 
              : 'border border-border opacity-80 hover:opacity-100'
          }`}
          onClick={() => setSelectedReport('inventory')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-accent" />
                <div>
                  <h3 className="font-semibold text-foreground">Inventory Report</h3>
                  <p className="text-sm text-muted-foreground">Stock levels</p>
                </div>
              </div>
              {selectedReport === 'inventory' && (
                <Badge variant="success" className="text-xs">Selected</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card 
          hover 
          className={`cursor-pointer transition-all duration-200 ${
            selectedReport === 'crm' 
              ? 'border-2 border-secondary bg-secondary/10 shadow-lg shadow-secondary/20 scale-[1.02]' 
              : 'border border-border opacity-80 hover:opacity-100'
          }`}
          onClick={() => setSelectedReport('crm')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-secondary" />
                <div>
                  <h3 className="font-semibold text-foreground">CRM Report</h3>
                  <p className="text-sm text-muted-foreground">Leads & opportunities</p>
                </div>
              </div>
              {selectedReport === 'crm' && (
                <Badge variant="success" className="text-xs">Selected</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card 
          hover 
          className={`cursor-pointer transition-all duration-200 ${
            selectedReport === 'logistics' 
              ? 'border-2 border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/20 scale-[1.02]' 
              : 'border border-border opacity-80 hover:opacity-100'
          }`}
          onClick={() => setSelectedReport('logistics')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <LineChartIcon className="h-8 w-8 text-emerald-400" />
                <div>
                  <h3 className="font-semibold text-foreground">Logistics Report</h3>
                  <p className="text-sm text-muted-foreground">Shipments & deliveries</p>
                </div>
              </div>
              {selectedReport === 'logistics' && (
                <Badge variant="success" className="text-xs">Selected</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Report */}
      {selectedReport === 'sales' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Sales & Orders Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {salesData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
                  No order data yet
                </div>
              ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="sales" stroke="#8884d8" strokeWidth={2} />
                  <Line type="monotone" dataKey="orders" stroke="#82ca9d" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sales by Category</CardTitle>
            </CardHeader>
            <CardContent>
              {categoryData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
                  No data yet
                </div>
              ) : (
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPie>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Inventory Report */}
      {selectedReport === 'inventory' && (
        <Card>
          <CardHeader>
            <CardTitle>Inventory Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            {inventoryData.length > 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Top {inventoryData.length} inventory items</p>
                <div className="space-y-2">
                  {inventoryData.map((item, index) => {
                    const stock = item.stockQuantity ?? item.CurrentStock ?? item.current_stock ?? 0;
                    const name = item.name || item.ProductID || item.product_id || 'N/A';
                    return (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{name}</p>
                          <p className="text-sm text-muted-foreground">Category: {item.category || 'General'} | Stock: {stock}</p>
                        </div>
                        <Badge variant={stock < 20 ? 'destructive' : 'success'}>
                          {stock < 20 ? 'Low Stock' : 'In Stock'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No inventory data available</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* CRM Report */}
      {selectedReport === 'crm' && (
        <Card>
          <CardHeader>
            <CardTitle>CRM Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">CRM analytics report - data from CRM dashboard</p>
            <p className="text-sm text-muted-foreground mt-2">
              View detailed CRM metrics in the CRM Dashboard section
            </p>
          </CardContent>
        </Card>
      )}

      {/* Logistics Report */}
      {selectedReport === 'logistics' && (
        <Card>
          <CardHeader>
            <CardTitle>Logistics Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {logisticsData.length > 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Recent shipments ({logisticsData.length})</p>
                <div className="space-y-2">
                  {logisticsData.map((shipment, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{shipment.shipment_id || shipment.id || 'N/A'}</p>
                        <p className="text-sm text-muted-foreground">Status: {shipment.status || 'unknown'}</p>
                      </div>
                      <Badge variant={shipment.status === 'delivered' ? 'success' : 'info'}>
                        {shipment.status || 'Unknown'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No logistics data available</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Reports;
