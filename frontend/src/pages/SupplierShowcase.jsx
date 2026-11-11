import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Store, Grid, List, Search, Filter, Download,
  Mail, Package, FileText, Eye, ShoppingCart, RefreshCw, AlertTriangle
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardContent } from '../components/common/ui/Card';
import Button from '../components/common/ui/Button';
import Input from '../components/common/forms/Input';
import Badge from '../components/common/ui/Badge';
import Alert from '../components/common/ui/Alert';
import { LoadingSpinner } from '../components/common/ui/Spinner';
import { Modal, ModalFooter } from '../components/common/ui/Modal';
import { productAPI } from '../services/api/productAPI';

export const SupplierShowcase = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [viewMode, setViewMode] = useState('grid');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  // Fetch products from API
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch products
      const productsResponse = await productAPI.getProducts({ limit: 1000, isActive: 'true' });
      
      // Extract products array safely
      const rawProducts = productsResponse.data?.data?.products || productsResponse.data?.products || (Array.isArray(productsResponse.data?.data) ? productsResponse.data.data : (Array.isArray(productsResponse.data) ? productsResponse.data : []));
      const productsData = Array.isArray(rawProducts) ? rawProducts : [];
      
      // Transform products to match frontend format
      const formattedProducts = productsData.map(product => ({
        id: product._id || product.ProductID || product.product_id || product.id,
        name: product.name || product.ProductName || product.product_name || 'Unknown Product',
        category: product.category || product.Category || 'Uncategorized',
        price: parseFloat(product.sellingPrice || product.UnitPrice || product.unit_price || product.price || 0),
        stock: product.stockQuantity || product.CurrentStock || product.current_stock || product.stock || 0,
        image: (product.primaryImageURL && !product.primaryImageURL.includes('placeholder') && !product.primaryImageURL.includes('via.'))
          ? product.primaryImageURL 
          : (product.image && !product.image.includes('placeholder') && !product.image.includes('via.'))
          ? product.image 
          : 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&auto=format&fit=crop&q=80',
        supplier: product.supplier?.name || product.SupplierName || product.supplier_name || product.supplier || 'Unknown Supplier',
        weight: parseFloat(product.weight || product.Weight || 0),
        dimensions: product.dimensions || product.Dimensions || 'N/A',
        description: product.description || product.Description || 'No description available',
      }));

      setProducts(formattedProducts);

      // Fetch categories
      try {
        const categoriesResponse = await productAPI.getCategories();
        const categoriesData = categoriesResponse.data?.categories || categoriesResponse.data || [];
        setCategories(categoriesData);
      } catch (err) {
        console.warn('Failed to fetch categories:', err);
        // Extract unique categories from products
        const uniqueCategories = [...new Set(formattedProducts.map(p => p.category))];
        setCategories(uniqueCategories);
      }

    } catch (err) {
      console.error('Error fetching products:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchProducts();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchProducts]);

  // Get unique suppliers from products
  const suppliers = useMemo(() => {
    const uniqueSuppliers = [...new Set(products.map(p => p.supplier))];
    return uniqueSuppliers.sort();
  }, [products]);

  // Filter products based on search, category, and supplier
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = !searchQuery || 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
      const matchesSupplier = supplierFilter === 'all' || product.supplier === supplierFilter;
      return matchesSearch && matchesCategory && matchesSupplier;
    });
  }, [products, searchQuery, categoryFilter, supplierFilter]);


  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Heading */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Supplier Showcase</h1>
          <p className="text-muted-foreground mt-1">
            Browse products from all suppliers
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchProducts}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" onClose={() => setError(null)}>
          <AlertTriangle className="h-4 w-4 mr-2" />
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <Input
                placeholder="Search products..."
                icon={Search}
                className="flex-1"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-4 py-2 rounded-lg border border-border bg-background"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="px-4 py-2 rounded-lg border border-border bg-background"
              >
                <option value="all">All Suppliers</option>
                {suppliers.map(supplier => (
                  <option key={supplier} value={supplier}>{supplier}</option>
                ))}
              </select>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                More Filters
              </Button>
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

      {/* Products Count */}
      {!loading && (
        <div className="text-sm text-muted-foreground">
          Showing {filteredProducts.length} of {products.length} products
        </div>
      )}

      {/* Products Grid */}
      {loading ? (
        <LoadingSpinner text="Loading product showcase..." />
      ) : filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No products found matching your filters.</p>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <Card key={product.id} hover className="overflow-hidden">
              <div className="relative h-64 bg-muted flex items-center justify-center">
                <img 
                  src={product.image} 
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                <Badge className="absolute top-4 right-4">
                  {product.category}
                </Badge>
              </div>
              <CardContent className="pt-4">
                <h3 className="font-semibold text-xl mb-2">{product.name}</h3>
                <p className="text-sm text-muted-foreground mb-3">{product.description}</p>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Supplier:</span>
                    <span className="font-medium">{product.supplier}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Price:</span>
                    <span className="text-2xl font-bold">{product.price.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Stock:</span>
                    <span className="font-medium">{product.stock} units</span>
                  </div>
                  {product.weight > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Weight:</span>
                      <span className="font-medium">{product.weight} kg</span>
                    </div>
                  )}
                  {product.dimensions && product.dimensions !== 'N/A' && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Dimensions:</span>
                      <span className="font-medium">{product.dimensions}</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setSelectedProduct(product);
                      setShowQuoteModal(true);
                    }}
                  >
                    <Mail className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setSelectedProduct(product);
                      setShowProductModal(true);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProducts.map((product) => (
            <Card key={product.id} hover>
              <CardContent className="pt-6">
                <div className="flex items-center gap-6">
                  <img 
                    src={product.image} 
                    alt={product.name}
                    className="w-32 h-32 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xl font-semibold">{product.name}</h3>
                      <span className="text-2xl font-bold">{product.price.toFixed(2)}</span>
                    </div>
                    <p className="text-muted-foreground mb-3">{product.description}</p>
                    <div className="flex items-center gap-4 text-sm mb-4 flex-wrap">
                      <span><strong>Supplier:</strong> {product.supplier}</span>
                      <span><strong>Stock:</strong> {product.stock} units</span>
                      {product.weight > 0 && <span><strong>Weight:</strong> {product.weight} kg</span>}
                      {product.dimensions && product.dimensions !== 'N/A' && (
                        <span><strong>Dimensions:</strong> {product.dimensions}</span>
                      )}
                      <Badge>{product.category}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedProduct(product);
                          setShowQuoteModal(true);
                        }}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Request Quote
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedProduct(product);
                          setShowProductModal(true);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                      <Button variant="outline" size="sm">
                        <FileText className="h-4 w-4 mr-2" />
                        Spec Sheet
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <Modal
          isOpen={showProductModal}
          title={selectedProduct.name}
          onClose={() => setShowProductModal(false)}
        >
          <div className="space-y-4">
            <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full rounded-lg" />
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground">{selectedProduct.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Supplier:</span>
                <p className="font-semibold">{selectedProduct.supplier}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Category:</span>
                <p className="font-semibold">{selectedProduct.category}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Price:</span>
                <p className="font-semibold text-xl">{selectedProduct.price.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Stock:</span>
                <p className="font-semibold">{selectedProduct.stock} units</p>
              </div>
              {selectedProduct.weight > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground">Weight:</span>
                  <p className="font-semibold">{selectedProduct.weight} kg</p>
                </div>
              )}
              {selectedProduct.dimensions && selectedProduct.dimensions !== 'N/A' && (
                <div>
                  <span className="text-sm text-muted-foreground">Dimensions:</span>
                  <p className="font-semibold">{selectedProduct.dimensions}</p>
                </div>
              )}
            </div>
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowProductModal(false)}>Close</Button>
            <Button onClick={() => {
              setShowProductModal(false);
              setShowQuoteModal(true);
            }}>
              <Mail className="h-4 w-4 mr-2" />
              Request Quote
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Quote Request Modal */}
      {selectedProduct && (
        <Modal
          isOpen={showQuoteModal}
          title="Request Quote"
          onClose={() => setShowQuoteModal(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Product</label>
              <p className="font-semibold">{selectedProduct.name}</p>
            </div>
            <Input label="Your Name" placeholder="John Doe" />
            <Input label="Company Name" placeholder="Company Inc" />
            <Input label="Email" type="email" placeholder="your@email.com" />
            <Input label="Phone" placeholder="+1-555-0100" />
            <Input label="Quantity" type="number" placeholder="100" />
            <div>
              <label className="text-sm font-medium mb-2 block">Additional Notes</label>
              <textarea 
                className="w-full px-4 py-2 rounded-lg border border-border bg-background"
                rows="3"
                placeholder="Any special requirements..."
              />
            </div>
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowQuoteModal(false)}>Cancel</Button>
            <Button onClick={() => setShowQuoteModal(false)}>
              <Mail className="h-4 w-4 mr-2" />
              Send Quote Request
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
};

export default SupplierShowcase;

