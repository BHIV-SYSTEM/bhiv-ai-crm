import React, { useEffect, useMemo, useState } from 'react';
import { 
  Building2,
  ChevronRight,
  ClipboardList,
  Clock,
  Edit,
  LayoutDashboard,
  Mail,
  Phone,
  Plus,
  Settings,
  Trash2,
} from 'lucide-react';
import Card, { CardContent } from '@/components/common/ui/Card';
import Button from '@/components/common/ui/Button';
import Input from '@/components/common/forms/Input';
import Alert from '@/components/common/ui/Alert';
import Badge from '@/components/common/ui/Badge';
import MetricCard from '@/components/common/charts/MetricCard';
import LineChart from '@/components/common/charts/LineChart';
import BarChart from '@/components/common/charts/BarChart';
import PieChart from '@/components/common/charts/PieChart';
import { API_BASE_URL } from '@/utils/constants';

export const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // UI state (matches screenshot tabs)
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'current' | 'add' | 'edit'
  const [expandedSupplierId, setExpandedSupplierId] = useState(null);
  const [editingSupplierId, setEditingSupplierId] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState(null);
  
  // Add supplier form state
  const [formData, setFormData] = useState({
    name: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    lead_time_days: 7,
    rating: 0,
    isActive: true
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/suppliers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to load suppliers');
      const data = await response.json();
      setSuppliers(data.data?.suppliers || []);
    } catch (err) {
      setError(err.message);
      console.error('Error loading suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/suppliers`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.contact_email,
          phone: formData.contact_phone,
          address: formData.address,
          leadTimeDays: formData.lead_time_days,
          rating: formData.rating
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create supplier');
      }
      
      setSuccess('Supplier created successfully!');
      resetForm();
      loadSuppliers();
      setActiveTab('current');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEditSupplier = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/suppliers/${editingSupplierId}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.contact_email,
          phone: formData.contact_phone,
          address: formData.address,
          leadTimeDays: formData.lead_time_days,
          rating: formData.rating,
          isActive: formData.isActive
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update supplier');
      }
      
      setSuccess('Supplier updated successfully!');
      resetForm();
      setEditingSupplierId(null);
      loadSuppliers();
      setActiveTab('current');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteSupplier = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/suppliers/${supplierToDelete.id}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}` 
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete supplier');
      }
      
      setSuccess('Supplier deleted successfully!');
      setShowDeleteDialog(false);
      setSupplierToDelete(null);
      loadSuppliers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
      setShowDeleteDialog(false);
      setSupplierToDelete(null);
    }
  };

  const startEdit = (supplier) => {
    // Check if this is a legacy supplier (from products)
    if (supplier.source === 'product') {
      setError('This supplier comes from product data and cannot be edited directly. Please create a new supplier with this information.');
      setTimeout(() => setError(null), 5000);
      return;
    }
    
    setFormData({
      name: supplier.name,
      contact_email: supplier.email || '',
      contact_phone: supplier.phone || '',
      address: supplier.address || '',
      lead_time_days: supplier.leadTimeDays || 7,
      rating: supplier.rating || 0,
      isActive: supplier.isActive
    });
    setEditingSupplierId(supplier.id);
    setActiveTab('edit');
  };

  const startDelete = (supplier) => {
    // Check if this is a legacy supplier (from products)
    if (supplier.source === 'product') {
      setError('This supplier comes from product data and cannot be deleted directly. To remove it, update the products that reference it.');
      setTimeout(() => setError(null), 5000);
      return;
    }
    
    setSupplierToDelete(supplier);
    setShowDeleteDialog(true);
  };

  const convertLegacySupplier = async (legacySupplier) => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/suppliers`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          name: legacySupplier.name,
          email: legacySupplier.email || '',
          phone: legacySupplier.phone || '',
          address: legacySupplier.address || '',
          leadTimeDays: 7,
          rating: 0
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to convert supplier');
      }
      
      setSuccess('Legacy supplier converted successfully! You can now manage it.');
      loadSuppliers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      contact_email: '',
      contact_phone: '',
      address: '',
      lead_time_days: 7,
      rating: 0,
      isActive: true
    });
    setEditingSupplierId(null);
  };

  const toggleExpanded = (supplierId) => {
    setExpandedSupplierId((prev) => (prev === supplierId ? null : supplierId));
  };

  const leadTimeControls = useMemo(() => {
    const dec = () => setFormData((p) => ({ ...p, lead_time_days: Math.max(1, (Number(p.lead_time_days) || 1) - 1) }));
    const inc = () => setFormData((p) => ({ ...p, lead_time_days: Math.min(365, (Number(p.lead_time_days) || 1) + 1) }));
    return { dec, inc };
  }, []);

  // Overview computed metrics + charts (based on loaded suppliers)
  const overview = useMemo(() => {
    const total = suppliers.length;
    const active = suppliers.filter((s) => s.isActive !== false).length;
    const inactive = total - active;
    const withEmail = suppliers.filter((s) => !!(s.email || s.contact_email)).length;
    const withPhone = suppliers.filter((s) => !!(s.phone || s.contact_phone)).length;
    const avgLeadTime =
      total > 0
        ? Number(
            (
              suppliers.reduce((sum, s) => sum + (Number(s.leadTimeDays || s.lead_time_days || s.lead_time) || 3), 0) /
              total
            ).toFixed(1)
          )
        : 3.5;

    const statusData = [
      { name: 'Active', value: active },
      { name: 'Inactive', value: inactive },
    ];

    const leadTimeData = suppliers
      .slice()
      .sort((a, b) => (Number(b.leadTimeDays || b.lead_time_days) || 3) - (Number(a.leadTimeDays || a.lead_time_days) || 3))
      .slice(0, 8)
      .map((s) => ({
        name: (s.name || s.id || 'Supplier').slice(0, 12),
        days: Number(s.leadTimeDays || s.lead_time_days) || 3,
      }));

    // Simple mock trend (until backend provides time-series). Scales with total suppliers.
    const base = Math.max(0, total - 6);
    const trendData = [
      { name: 'Aug', suppliers: base + 1 },
      { name: 'Sep', suppliers: base + 2 },
      { name: 'Oct', suppliers: base + 3 },
      { name: 'Nov', suppliers: base + 4 },
      { name: 'Dec', suppliers: base + 5 },
      { name: 'Jan', suppliers: total },
    ];

    return {
      total,
      active,
      inactive,
      withEmail,
      withPhone,
      avgLeadTime,
      statusData,
      leadTimeData,
      trendData,
    };
  }, [suppliers]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Tabs (matches screenshot) */}
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
          onClick={() => setActiveTab('current')}
          className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
            activeTab === 'current'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          Current Suppliers
        </button>
        <button
          onClick={() => setActiveTab('add')}
          className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
            activeTab === 'add'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
            <Plus className="h-4 w-4" />
            Add Supplier
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
              <div>
            <h1 className="text-3xl font-heading font-bold tracking-tight">Supplier Overview</h1>
            <p className="text-muted-foreground mt-1">
              Summary metrics and performance indicators for your supplier network
            </p>
            </div>

          {loading ? (
            <div className="text-muted-foreground">Loading suppliers...</div>
          ) : (
            <>
              {/* Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                  title="Total Suppliers"
                  value={overview.total}
                  icon={Building2}
                  variant="primary"
                />
                <MetricCard
                  title="Active Suppliers"
                  value={overview.active}
                  icon={ClipboardList}
                  variant="success"
                />
                <MetricCard
                  title="Avg Lead Time"
                  value={`${overview.avgLeadTime} days`}
                  icon={Clock}
                  variant="warning"
                />
                <MetricCard
                  title="Contacts Available"
                  value={`${overview.withEmail}/${overview.withPhone}`}
                  icon={Mail}
                  variant="info"
                />
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PieChart title="Active vs Inactive" data={overview.statusData} height={320} />
                <LineChart
                  title="Suppliers Growth (Trend)"
                  data={overview.trendData}
                  lines={[{ dataKey: 'suppliers', name: 'Suppliers' }]}
                  height={320}
                />
              </div>

              <div className="grid grid-cols-1 gap-6">
                <BarChart
                  title="Top Lead Times (days)"
                  data={overview.leadTimeData}
                  bars={[{ dataKey: 'days', name: 'Lead Time (days)' }]}
                  height={340}
                />
              </div>
            </>
          )}
            </div>
      )}

      {/* Current Suppliers */}
      {activeTab === 'current' && (
        <div className="space-y-4">
          <h1 className="text-3xl font-heading font-bold tracking-tight">Supplier Directory</h1>

          {loading ? (
            <div className="text-muted-foreground">Loading suppliers...</div>
          ) : suppliers.length === 0 ? (
            <Card className="border border-border">
              <CardContent className="p-6 text-muted-foreground">
                No suppliers found. Add your first supplier.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {suppliers.map((s) => {
                const isExpanded = expandedSupplierId === s.id;
                return (
                  <div key={s.id} className="border border-border rounded-lg bg-card shadow-xl">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(s.id)}
                      className="w-full flex items-center justify-between px-4 py-4"
                    >
                      <div className="flex items-center gap-3">
                        <ChevronRight className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        <span className="font-semibold">{s.name || s.id}</span>
                      </div>
                      <Badge variant={s.isActive ? 'success' : 'muted'}>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </button>

                    {isExpanded && (
                      <div className="px-6 pb-5 pt-0 border-t border-border">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 text-sm">
                          <div className="space-y-2">
                            <div className="text-muted-foreground">Supplier ID</div>
                            <div className="font-mono">{s.id}</div>
                          </div>
                          <div className="space-y-2">
                            <div className="text-muted-foreground">Lead Time</div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span>{s.lead_time_days ?? 7} days</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="text-muted-foreground">Contact Email</div>
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span className="truncate">{s.email || '—'}</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="text-muted-foreground">Contact Phone</div>
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span>{s.phone || '—'}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex justify-end gap-3 pt-4 border-t border-border mt-4">
                          {s.source === 'product' ? (
                            // Legacy supplier from products - show convert button
                            <>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mr-auto">
                                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
                                  Legacy
                                </span>
                                <span>From product data</span>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  convertLegacySupplier(s);
                                }}
                                className="flex items-center gap-2"
                              >
                                <Plus className="h-4 w-4" />
                                Convert
                              </Button>
                            </>
                          ) : (
                            // Real supplier from database - show manage/delete buttons
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEdit(s);
                                }}
                                className="flex items-center gap-2"
                              >
                                <Settings className="h-4 w-4" />
                                Manage
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startDelete(s);
                                }}
                                className="flex items-center gap-2"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                        )}
                        </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit Supplier */}
      {activeTab === 'edit' && editingSupplierId && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-heading font-bold tracking-tight">Edit Supplier</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetForm();
                setActiveTab('current');
              }}
            >
              Cancel
            </Button>
          </div>

          <Card className="border border-border">
            <CardContent className="p-6">
              <form onSubmit={handleEditSupplier} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Company Name*"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="TechParts Supply Co."
                    required
                  />
                  <Input
                    label="Contact Email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    placeholder="contact@supplier.com"
                    type="email"
                  />
                  <Input
                    label="Contact Phone"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    placeholder="+1-555-0123"
                  />
                  <Input
                    label="Address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="123 Business St, City, State"
                  />
                  <div className="w-full">
                    <label className="block text-sm font-medium mb-2">Lead Time (days)</label>
                    <input
                      type="number"
                      min="0"
                      max="365"
                      value={formData.lead_time_days}
                      onChange={(e) => setFormData({ ...formData, lead_time_days: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="w-full">
                    <label className="block text-sm font-medium mb-2">Rating (0-5)</label>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      step="0.1"
                      value={formData.rating}
                      onChange={(e) => setFormData({ ...formData, rating: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="w-full">
                    <label className="block text-sm font-medium mb-2">Rating (0-5)</label>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      step="0.1"
                      value={formData.rating}
                      onChange={(e) => setFormData({ ...formData, rating: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active_edit"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-border"
                  />
                  <label htmlFor="is_active_edit" className="text-sm font-medium">Active Supplier</label>
                </div>

                <div className="flex gap-3">
                  <Button type="submit" className="flex items-center gap-2">
                    <Edit className="h-4 w-4" />
                    Update Supplier
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetForm();
                      setActiveTab('current');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
      {activeTab === 'add' && (
          <div className="space-y-4">
          <h1 className="text-3xl font-heading font-bold tracking-tight">Add New Supplier</h1>

          <Card className="border border-border">
            <CardContent className="p-6">
              <form onSubmit={handleAddSupplier} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                    label="Company Name*"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="TechParts Supply Co."
                    required
            />
              <Input
                label="Contact Email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                placeholder="contact@supplier.com"
                type="email"
              />
              <Input
                label="Contact Phone"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                placeholder="+1-555-0123"
              />
              <Input
                label="Address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Business St, City, State"
              />

                  <div className="w-full">
                    <label className="block text-sm font-medium mb-2">Lead Time (days)</label>
            <div className="flex items-center gap-2">
              <input
                        type="number"
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={formData.lead_time_days}
                        min={1}
                        max={365}
                        onChange={(e) => setFormData({ ...formData, lead_time_days: Number(e.target.value) || 1 })}
                      />
                      <Button type="button" variant="outline" size="icon" onClick={leadTimeControls.dec} aria-label="Decrease lead time">
                        -
                      </Button>
                      <Button type="button" variant="outline" size="icon" onClick={leadTimeControls.inc} aria-label="Increase lead time">
                        +
                      </Button>
            </div>
          </div>

              <Input
                label="Contact Email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                placeholder="orders@company.com"
              />

                  <div className="flex items-center gap-3 pt-7">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 rounded border-input"
              />
                    <span className="text-sm font-medium">Active</span>
            </div>
          </div>

                <div>
            <Button type="submit" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Supplier
            </Button>
          </div>
        </form>
            </CardContent>
          </Card>
              </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && supplierToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Delete Supplier</h3>
                <p className="text-muted-foreground">This action cannot be undone.</p>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-sm">
                Are you sure you want to delete <strong>{supplierToDelete.name}</strong>?
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                This will permanently remove the supplier from your system.
              </p>
            </div>
            
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setSupplierToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteSupplier}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
