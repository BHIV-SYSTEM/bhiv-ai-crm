import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Package, Plus, Search, Edit2, Upload, 
  Image as ImageIcon, Grid, List, ClipboardList, 
  RefreshCw, AlertCircle, CheckCircle2, X, Wifi, WifiOff
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardContent } from '../components/common/ui/Card';
import MetricCard from '../components/common/charts/MetricCard';
import Button from '../components/common/ui/Button';
import Input from '../components/common/forms/Input';
import Badge from '../components/common/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/common/ui/Table';
import { LoadingSpinner } from '../components/common/ui/Spinner';
import { Modal, ModalFooter } from '../components/common/ui/Modal';
import Alert from '../components/common/ui/Alert';
import { productAPI } from '../services/api/productAPI';
import { formatDate } from '@/utils/dateUtils';

// Real-time update interval (5 seconds)
const POLL_INTERVAL = 5000;
const RETRY_DELAY = 3000;
const MAX_RETRIES = 3;

const DEFAULT_PRODUCT_IMAGES = {
  coffee: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&auto=format&fit=crop&q=80',
  tea: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&auto=format&fit=crop&q=80',
  sugar: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?w=400&auto=format&fit=crop&q=80',
  groceries: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&auto=format&fit=crop&q=80',
  tools: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=400&auto=format&fit=crop&q=80',
  electrical: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=400&auto=format&fit=crop&q=80',
  default: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&auto=format&fit=crop&q=80'
};

const getProductImage = (product) => {
  if (product?.image && !product.image.includes('placeholder') && !product.image.includes('via.')) {
    return product.image;
  }
  if (product?.primary_image_url && !product.primary_image_url.includes('placeholder') && !product.primary_image_url.includes('via.')) {
    return product.primary_image_url;
  }

  const name = String(product?.name || '').toLowerCase();
  const category = String(product?.category || '').toLowerCase();

  if (name.includes('coffee') || category.includes('coffee')) return DEFAULT_PRODUCT_IMAGES.coffee;
  if (name.includes('tea') || category.includes('tea')) return DEFAULT_PRODUCT_IMAGES.tea;
  if (name.includes('sugar') || category.includes('sugar')) return DEFAULT_PRODUCT_IMAGES.sugar;
  if (name.includes('tool') || category.includes('tool') || category.includes('hardware')) return DEFAULT_PRODUCT_IMAGES.tools;
  if (name.includes('electr') || category.includes('electr')) return DEFAULT_PRODUCT_IMAGES.electrical;
  if (name.includes('groc') || category.includes('groc')) return DEFAULT_PRODUCT_IMAGES.groceries;

  return DEFAULT_PRODUCT_IMAGES.default;
};

const getProductStatus = (product) => {
  if (product?.status && product.status !== 'Unknown') return product.status.replace(/_/g, ' ');
  if (product?.isActive === false) return 'Inactive';
  const qty = product?.stockQuantity ?? product?.CurrentStock ?? 0;
  const threshold = product?.minThreshold ?? 10;
  if (qty === 0) return 'Out of Stock';
  if (qty < threshold) return 'Low Stock';
  return 'In Stock';
};

const getStatusVariant = (statusStr) => {
  const s = String(statusStr || '').toLowerCase();
  if (s.includes('out') || s.includes('inactive')) return 'destructive';
  if (s.includes('low')) return 'warning';
  return 'success';
};

export const Products = () => {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [metrics, setMetrics] = useState({
    totalProducts: 0,
    inStock: 0,
    lowStock: 0,
    outOfStock: 0,
  });
  const [categories, setCategories] = useState([]);
  const [activeTab, setActiveTab] = useState('catalog');
  const [viewMode, setViewMode] = useState('grid');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    product_id: '',
    name: '',
    category: '',
    description: '',
    unit_price: '',
    supplier_id: '',
    reorder_point: 10,
    max_stock: 100,
    weight_kg: 0,
    dimensions: '',
  });
  
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  
  const pollIntervalRef = useRef(null);
  const retryCountRef = useRef(0);
  const isMountedRef = useRef(true);

  // Fetch products from API
  const fetchProducts = useCallback(async (showLoading = true, bustCache = false) => {
    if (showLoading) setLoading(true);
    setError(null);
    
    try {
      const params = {
        limit: 1000,
        ...(categoryFilter !== 'all' && { category: categoryFilter }),
        ...(searchQuery && { search: searchQuery }),
        // Only filter by isActive in catalog view, show all products in manage view
        ...(activeTab === 'catalog' && { isActive: 'true' }),
        bustCache, // Force fresh data when needed
      };
      
      const response = await productAPI.getProducts(params);
      const data = response.data;
      
      if (isMountedRef.current) {
        setProducts(data?.data?.products || []);
        setLastUpdate(new Date());
        setIsConnected(true);
        retryCountRef.current = 0;
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      if (isMountedRef.current) {
        // Handle 401 errors gracefully - don't logout, just show error
        if (err.response?.status === 401) {
          setError('Authentication required. Please ensure you are logged in.');
          // Don't set isConnected to false for auth errors - might be temporary
        } else {
          setError(err.response?.data?.detail || err.message || 'Failed to load products');
          setIsConnected(false);
          retryCountRef.current += 1;
          
          // Retry logic (only for non-auth errors)
          if (retryCountRef.current < MAX_RETRIES) {
            setTimeout(() => {
              if (isMountedRef.current) {
                fetchProducts(false);
              }
            }, RETRY_DELAY);
          }
        }
      }
    } finally {
      if (isMountedRef.current && showLoading) {
        setLoading(false);
      }
    }
  }, [categoryFilter, searchQuery, activeTab]); // Add activeTab to refetch when switching tabs

  // Fetch metrics
  const fetchMetrics = useCallback(async (bustCache = false) => {
    try {
      const response = await productAPI.getStats(bustCache);
      const data = response.data;
      if (isMountedRef.current) {
        setMetrics({
          totalProducts: data?.data?.totalProducts || 0,
          inStock: Math.max(
            0,
            (data?.data?.totalProducts || 0) - (data?.data?.outOfStock || 0)
          ),
          lowStock: data?.data?.lowStockProducts || 0,
          outOfStock: data?.data?.outOfStock || 0,
        });
      }
    } catch (err) {
      console.error('Error fetching metrics:', err);
    }
  }, []);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const response = await productAPI.getCategories();
      const data = response.data;
      if (isMountedRef.current) {
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  }, []);

  // Real-time polling
  useEffect(() => {
    isMountedRef.current = true;
    
    // Initial fetch
    fetchProducts();
    fetchMetrics();
    fetchCategories();
    
    // Set up polling
    setIsPolling(true);
    pollIntervalRef.current = setInterval(() => {
      if (isMountedRef.current) {
        fetchProducts(false);
        fetchMetrics();
      }
    }, POLL_INTERVAL);
    
    return () => {
      isMountedRef.current = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchProducts, fetchMetrics, fetchCategories]);

  // Refetch products when switching between tabs (catalog shows active only, manage shows all)
  useEffect(() => {
    fetchProducts(true, true); // Bust cache when switching tabs
  }, [activeTab]);

  // Manual refresh
  const handleRefresh = () => {
    fetchProducts();
    fetchMetrics();
    fetchCategories();
  };

  // Create product
  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    try {
      // Map frontend fields to MongoDB backend schema
      const productData = {
        sku: formData.product_id.toUpperCase().trim(),
        name: formData.name.trim(),
        category: formData.category,
        description: formData.description.trim() || '',
        costPrice: parseFloat(formData.unit_price) || 0,
        sellingPrice: parseFloat(formData.unit_price) || 0,
        stockQuantity: parseInt(formData.max_stock) || 0,
        minThreshold: parseInt(formData.reorder_point) || 10,
        unit: 'pieces',
        isActive: true,
      };
      
      await productAPI.createProduct(productData);
      
      // Upload image if provided
      if (imageFile && formData.product_id) {
        try {
          await productAPI.uploadPrimaryImage(formData.product_id.toUpperCase().trim(), imageFile);
        } catch (imgErr) {
          console.warn('Image upload failed:', imgErr);
        }
      }
      
      setSuccess('Product created successfully!');
      resetForm();
      setShowAddModal(false);
      fetchProducts(true, true); // Bust cache to show new product
      fetchMetrics(true); // Bust cache for updated stats
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Product creation error:', err);
      if (err.response?.status === 409) {
        setError(`Product with SKU "${formData.product_id.toUpperCase()}" already exists. Please use a different SKU.`);
      } else if (err.response?.status === 401) {
        setError('Your session has expired. Please login again.');
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to create product');
      }
    }
  };

  // Update product
  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    try {
      // Map frontend fields to MongoDB backend schema
      const updateData = {};
      if (formData.name) updateData.name = formData.name.trim();
      if (formData.category) updateData.category = formData.category;
      if (formData.description !== undefined) updateData.description = formData.description.trim() || '';
      if (formData.unit_price) {
        updateData.costPrice = parseFloat(formData.unit_price);
        updateData.sellingPrice = parseFloat(formData.unit_price);
      }
      if (formData.reorder_point) updateData.minThreshold = parseInt(formData.reorder_point);
      if (formData.max_stock) updateData.stockQuantity = parseInt(formData.max_stock);
      
      await productAPI.updateProduct(selectedProduct._id || selectedProduct.id, updateData);
      
      // Upload image if provided
      if (imageFile && selectedProduct.id) {
        try {
          await productAPI.uploadPrimaryImage(selectedProduct.id, imageFile);
        } catch (imgErr) {
          console.warn('Image upload failed:', imgErr);
        }
      }
      
      setSuccess('Product updated successfully!');
      resetForm();
      setShowEditModal(false);
      setSelectedProduct(null);
      fetchProducts(true, true); // Bust cache to show updated product
      fetchMetrics(true); // Bust cache for updated stats
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to update product');
    }
  };

  // Delete product
  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return;
    }
    
    setError(null);
    setSuccess(null);
    
    try {
      await productAPI.deleteProduct(productId);
      setSuccess('Product deleted successfully!');
      fetchProducts(true, true); // Bust cache after deletion
      fetchMetrics(true); // Bust cache for updated stats
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to delete product');
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      product_id: '',
      name: '',
      category: '',
      description: '',
      unit_price: '',
      supplier_id: '',
      reorder_point: 10,
      max_stock: 100,
      weight_kg: 0,
      dimensions: '',
    });
    setImageFile(null);
    setImagePreview(null);
  };

  // Open edit modal
  const openEditModal = (product) => {
    setSelectedProduct(product);
    setFormData({
      product_id: product.sku,
      name: product.name,
      category: product.category,
      description: product.description || '',
      unit_price: product.sellingPrice || product.costPrice || 0,
      supplier_id: product.supplier?.name || '',
      reorder_point: product.minThreshold || 10,
      max_stock: product.stockQuantity || 0,
      weight_kg: 0,
      dimensions: '',
    });
    setImagePreview(product.image);
    setShowEditModal(true);
  };

  // Handle image selection
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const getStatusVariant = (status) => {
    const variants = {
      in_stock: 'success',
      low_stock: 'warning',
      out_of_stock: 'destructive',
    };
    return variants[status] || 'default';
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (loading && products.length === 0) {
    return <LoadingSpinner text="Loading products..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Connection Status & Alerts */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {isConnected ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wifi className="h-4 w-4 text-success" />
              <span>Connected</span>
              {lastUpdate && (
                <span className="text-xs">
                  Last updated: {lastUpdate.toLocaleTimeString()}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <WifiOff className="h-4 w-4" />
              <span>Connection lost. Retrying...</span>
            </div>
          )}
          {isPolling && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-3 w-3 animate-spin" />
              <span>Auto-refresh enabled</span>
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Success/Error Alerts */}
      {success && (
        <Alert variant="success" onClose={() => setSuccess(null)}>
          <CheckCircle2 className="h-4 w-4 mr-2" />
          {success}
        </Alert>
      )}
      {error && (
        <Alert variant="destructive" onClose={() => setError(null)}>
          <AlertCircle className="h-4 w-4 mr-2" />
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
            activeTab === 'catalog'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Grid className="h-4 w-4" />
          Product Catalog
        </button>
        <button
          onClick={() => setActiveTab('manage')}
          className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
            activeTab === 'manage'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          Manage Products
        </button>
      </div>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">
            {activeTab === 'catalog' ? 'Product Catalog' : 'Manage Products'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {activeTab === 'catalog'
              ? 'Browse your product catalog'
              : 'Add, edit, and manage product inventory'}
          </p>
        </div>
        {activeTab === 'manage' && (
          <Button onClick={() => {
            resetForm();
            setShowAddModal(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Products"
          value={metrics.totalProducts.toLocaleString()}
          icon={Package}
          variant="primary"
        />
        <MetricCard
          title="In Stock"
          value={metrics.inStock.toLocaleString()}
          icon={Package}
          variant="success"
        />
        <MetricCard
          title="Low Stock"
          value={metrics.lowStock.toLocaleString()}
          icon={Package}
          variant="warning"
        />
        <MetricCard
          title="Out of Stock"
          value={metrics.outOfStock.toLocaleString()}
          icon={Package}
          variant="destructive"
        />
      </div>

      {/* Filters and View Toggle (Catalog) */}
      {activeTab === 'catalog' && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <Input
                  placeholder="Search products..."
                  icon={Search}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64"
                />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-4 py-2 rounded-lg border border-border bg-background"
                >
                  <option value="all">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'grid' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product Catalog */}
      {activeTab === 'catalog' && (
        <>
          {loading && products.length > 0 && (
            <div className="text-center text-muted-foreground py-4">
              <RefreshCw className="h-4 w-4 animate-spin inline mr-2" />
              Updating products...
            </div>
          )}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((product) => (
                <Card key={product._id || product.id} hover className="overflow-hidden">
                  <div className="relative h-48 bg-muted flex items-center justify-center">
                    <img 
                      src={getProductImage(product)} 
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = DEFAULT_PRODUCT_IMAGES.default;
                      }}
                    />
                    <Badge 
                      variant={getStatusVariant(product.status)}
                      className="absolute top-2 right-2"
                    >
                      {product.status?.replace('_', ' ') || 'Unknown'}
                    </Badge>
                  </div>
                  <CardContent className="pt-4">
                    <h3 className="font-semibold text-lg mb-1">{product.name}</h3>
                    <p className="text-sm text-muted-foreground mb-2">{product.sku}</p>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl font-bold">₹{product.sellingPrice || 0}</span>
                      <span className="text-sm text-muted-foreground">Stock: {product.stockQuantity || 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => {
                          setActiveTab('manage');
                          openEditModal(product);
                        }}
                      >
                        <ClipboardList className="h-4 w-4 mr-1" />
                        Manage
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedProduct(product);
                          setShowImageModal(true);
                        }}
                      >
                        <ImageIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Products List</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Image</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow key={product._id || product.id}>
                        <TableCell>
                          <img 
                            src={getProductImage(product)} 
                            alt={product.name} 
                            className="w-12 h-12 rounded object-cover"
                            onError={(e) => {
                              e.target.src = DEFAULT_PRODUCT_IMAGES.default;
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{product.name}</div>
                            <div className="text-sm text-muted-foreground">{product.sku}</div>
                          </div>
                        </TableCell>
                        <TableCell>{product.category}</TableCell>
                        <TableCell className="font-semibold">₹{product.sellingPrice || 0}</TableCell>
                        <TableCell>{product.stockQuantity || 0}</TableCell>
                        <TableCell>{product.supplier?.name || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(product.status)}>
                            {product.status?.replace('_', ' ') || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              openEditModal(product);
                            }}
                          >
                            Manage
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
          {filteredProducts.length === 0 && !loading && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No products found. {searchQuery || categoryFilter !== 'all' ? 'Try adjusting your filters.' : 'Add your first product.'}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Manage Products */}
      {activeTab === 'manage' && (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <Input
                    placeholder="Search products..."
                    icon={Search}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-64"
                  />
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-4 py-2 rounded-lg border border-border bg-background"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <Button onClick={() => {
                  resetForm();
                  setShowAddModal(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Manage Products</CardTitle>
            </CardHeader>
            <CardContent>
              {loading && products.length > 0 && (
                <div className="text-center text-muted-foreground py-4">
                  <RefreshCw className="h-4 w-4 animate-spin inline mr-2" />
                  Updating products...
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product._id || product.id}>
                      <TableCell>
                        <img 
                          src={getProductImage(product)} 
                          alt={product.name} 
                          className="w-12 h-12 rounded object-cover"
                          onError={(e) => {
                            e.target.src = DEFAULT_PRODUCT_IMAGES.default;
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-muted-foreground">{product.sku}</div>
                        </div>
                      </TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell className="font-semibold">₹{product.sellingPrice || 0}</TableCell>
                      <TableCell>{product.stockQuantity || 0}</TableCell>
                      <TableCell>{product.supplier?.name || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(getProductStatus(product))}>
                          {getProductStatus(product)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => openEditModal(product)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setSelectedProduct(product);
                              setShowImageModal(true);
                            }}
                          >
                            <ImageIcon className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteProduct(product._id || product.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredProducts.length === 0 && !loading && (
                <div className="p-8 text-center text-muted-foreground">
                  No products found. {searchQuery || categoryFilter !== 'all' ? 'Try adjusting your filters.' : 'Add your first product.'}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Add Product Modal */}
      <Modal
        isOpen={showAddModal}
        title="Add New Product"
        onClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
      >
        <form onSubmit={handleCreateProduct}>
          <div className="space-y-4">
            <Input 
              label="Product ID*" 
              placeholder="PROD-001" 
              value={formData.product_id}
              onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
              required
            />
            <Input 
              label="Product Name*" 
              placeholder="Enter product name" 
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="Category*"
              placeholder="Type category (e.g., Electronics)"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              required
            />
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                placeholder="Product description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="Price*" 
                type="number" 
                step="0.01"
                placeholder="0.00" 
                value={formData.unit_price}
                onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                required
              />
              <Input 
                label="Supplier ID*" 
                placeholder="SUPPLIER_001" 
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="Reorder Point" 
                type="number" 
                placeholder="10" 
                value={formData.reorder_point}
                onChange={(e) => setFormData({ ...formData, reorder_point: e.target.value })}
              />
              <Input 
                label="Max Stock" 
                type="number" 
                placeholder="100" 
                value={formData.max_stock}
                onChange={(e) => setFormData({ ...formData, max_stock: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Product Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="w-full px-4 py-2 rounded-lg border border-border bg-background"
              />
              {imagePreview && (
                <img src={imagePreview} alt="Preview" className="mt-2 w-32 h-32 object-cover rounded" />
              )}
            </div>
          </div>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => {
              setShowAddModal(false);
              resetForm();
            }}>Cancel</Button>
            <Button type="submit">Add Product</Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Edit Product Modal */}
      {selectedProduct && (
        <Modal
          isOpen={showEditModal}
          title="Edit Product"
          onClose={() => {
            setShowEditModal(false);
            setSelectedProduct(null);
            resetForm();
          }}
        >
          <form onSubmit={handleUpdateProduct}>
            <div className="space-y-4">
              <Input 
                label="Product ID" 
                value={formData.product_id} 
                disabled
              />
              <Input 
                label="Product Name*" 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <Input
                label="Category*"
                placeholder="Type category (e.g., Electronics)"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
              />
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Price*" 
                  type="number" 
                  step="0.01"
                  value={formData.unit_price}
                  onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                  required
                />
                <Input 
                  label="Supplier ID*" 
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Reorder Point" 
                  type="number" 
                  value={formData.reorder_point}
                  onChange={(e) => setFormData({ ...formData, reorder_point: e.target.value })}
                />
                <Input 
                  label="Max Stock" 
                  type="number" 
                  value={formData.max_stock}
                  onChange={(e) => setFormData({ ...formData, max_stock: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Product Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background"
                />
                {imagePreview && (
                  <img src={imagePreview} alt="Preview" className="mt-2 w-32 h-32 object-cover rounded" />
                )}
              </div>
            </div>
            <ModalFooter>
              <Button type="button" variant="outline" onClick={() => {
                setShowEditModal(false);
                setSelectedProduct(null);
                resetForm();
              }}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* Image Upload Modal */}
      {selectedProduct && (
        <Modal
          isOpen={showImageModal}
          title="Upload Product Image"
          onClose={() => {
            setShowImageModal(false);
            setSelectedProduct(null);
            setImageFile(null);
            setImagePreview(null);
          }}
        >
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                Drag and drop an image here, or click to select
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
                id="image-upload"
              />
              <label htmlFor="image-upload">
                <Button variant="outline" size="sm" as="span">
                  Select Image
                </Button>
              </label>
            </div>
            {imagePreview && (
              <div className="mt-4">
                <img src={imagePreview} alt="Preview" className="w-full rounded-lg" />
              </div>
            )}
            {selectedProduct.image && !imagePreview && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-2">Current Image:</p>
                <img 
                  src={selectedProduct.image || selectedProduct.primary_image_url || 'https://via.placeholder.com/200'} 
                  alt="Current" 
                  className="w-full rounded-lg"
                  onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/200';
                  }}
                />
              </div>
            )}
          </div>
          <ModalFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowImageModal(false);
                setSelectedProduct(null);
                setImageFile(null);
                setImagePreview(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                if (imageFile && selectedProduct.id) {
                  try {
                    await productAPI.uploadPrimaryImage(selectedProduct.id, imageFile);
                    setSuccess('Image uploaded successfully!');
                    setShowImageModal(false);
                    setSelectedProduct(null);
                    setImageFile(null);
                    setImagePreview(null);
                    fetchProducts();
                    setTimeout(() => setSuccess(null), 3000);
                  } catch (err) {
                    setError(err.response?.data?.detail || err.message || 'Failed to upload image');
                  }
                }
              }}
              disabled={!imageFile}
            >
              Upload Image
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
};

export default Products;