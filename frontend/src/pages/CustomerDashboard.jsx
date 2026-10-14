import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ShoppingCart, Package, Search, Grid, List, Plus, Minus, Check,
  Loader2,
} from 'lucide-react';
import Button from '../components/common/ui/Button';
import Card from '../components/common/ui/Card';
import Badge from '../components/common/ui/Badge';
import { productAPI } from '../services/api/productAPI';
import { orderAPI } from '../services/api/orderAPI';

const DEFAULT_PRODUCT_IMAGES = {
  coffee: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&auto=format&fit=crop&q=80',
  tea: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&auto=format&fit=crop&q=80',
  sugar: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?w=400&auto=format&fit=crop&q=80',
  groceries: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&auto=format&fit=crop&q=80',
  tools: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=400&auto=format&fit=crop&q=80',
  electrical: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=400&auto=format&fit=crop&q=80',
  default: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&auto=format&fit=crop&q=80'
};

const getProductImage = (p) => {
  const img = p?.image || p?.image_url || p?.imageUrl || p?.primary_image_url;
  if (img && !img.includes('placeholder') && !img.includes('via.')) {
    return img;
  }
  const name = String(p?.name || '').toLowerCase();
  const category = String(p?.category || '').toLowerCase();

  if (name.includes('coffee') || category.includes('coffee')) return DEFAULT_PRODUCT_IMAGES.coffee;
  if (name.includes('tea') || category.includes('tea')) return DEFAULT_PRODUCT_IMAGES.tea;
  if (name.includes('sugar') || category.includes('sugar')) return DEFAULT_PRODUCT_IMAGES.sugar;
  if (name.includes('tool') || category.includes('tool') || category.includes('hardware')) return DEFAULT_PRODUCT_IMAGES.tools;
  if (name.includes('electr') || category.includes('electr')) return DEFAULT_PRODUCT_IMAGES.electrical;
  if (name.includes('groc') || category.includes('groc')) return DEFAULT_PRODUCT_IMAGES.groceries;

  return DEFAULT_PRODUCT_IMAGES.default;
};

const inr = (value) =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const CART_STORAGE_KEY = 'setu.customer.cart.v1';

/**
 * Fly-to-cart: clones the product image and glides it into the cart button
 * with the Web Animations API (no CSS/DOM churn, cleanup guaranteed).
 */
const flyToCart = (sourceEl, targetEl) => {
  if (!sourceEl || !targetEl || typeof sourceEl.animate !== 'function') return;
  try {
    const s = sourceEl.getBoundingClientRect();
    const t = targetEl.getBoundingClientRect();
    if (!s.width || !s.height) return;

    const clone = sourceEl.cloneNode(true);
    clone.removeAttribute('id');
    Object.assign(clone.style, {
      position: 'fixed',
      left: `${s.left}px`,
      top: `${s.top}px`,
      width: `${s.width}px`,
      height: `${s.height}px`,
      objectFit: 'cover',
      borderRadius: '14px',
      zIndex: '9999',
      pointerEvents: 'none',
      boxShadow: '0 16px 34px rgba(0,0,0,.35)',
      border: '2px solid rgba(255,255,255,.6)',
    });
    document.body.appendChild(clone);

    const dx = t.left + t.width / 2 - (s.left + s.width / 2);
    const dy = t.top + t.height / 2 - (s.top + s.height / 2);

    const anim = clone.animate(
      [
        { transform: 'translate3d(0,0,0) scale(1) rotate(0deg)', opacity: 1 },
        {
          transform: `translate3d(${dx * 0.55}px, ${dy * 0.45 - 90}px, 0) scale(0.55) rotate(-10deg)`,
          opacity: 0.98,
          offset: 0.55,
        },
        {
          transform: `translate3d(${dx}px, ${dy}px, 0) scale(0.06) rotate(8deg)`,
          opacity: 0.15,
        },
      ],
      { duration: 760, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)', fill: 'forwards' }
    );
    anim.onfinish = () => clone.remove();
    setTimeout(() => clone.remove(), 1400); // safety net
  } catch {
    /* animation is best-effort — the cart still updates */
  }
};

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('all');
  const [categories, setCategories] = useState([]);
  const [viewMode, setViewMode] = useState('grid');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [cartBump, setCartBump] = useState(false);

  const cartButtonRef = useRef(null);

  /* -------------------------------------------------- data fetching */

  const normalizeProduct = (p) => ({
    id: p._id || p.id,
    name: p.name || 'Unnamed Product',
    description: p.description || '',
    category: p.category || '',
    price: Number(p.sellingPrice || p.price || 0),
    stock: Number(p.stockQuantity || p.stock || 0),
    image_url: getProductImage(p),
  });

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await productAPI.getProducts({
        limit: 1000,
        isActive: 'true',
        bustCache: true,
      });
      const rawProducts = response.data?.data?.products || [];
      setProducts(Array.isArray(rawProducts) ? rawProducts.map(normalizeProduct) : []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Could not load the product catalogue');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await productAPI.getCategories();
      setCategories(res.data?.categories || []);
    } catch {
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    try {
      const stored = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
      if (Array.isArray(stored)) setCart(stored);
    } catch {
      /* ignore corrupt cart state */
    }
  }, [fetchProducts, fetchCategories]);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      /* storage may be unavailable — cart stays in memory */
    }
  }, [cart]);

  /* -------------------------------------------------- cart actions */

  const bumpCart = () => {
    setCartBump(true);
    setTimeout(() => setCartBump(false), 320);
  };

  const addToCart = (product, event) => {
    if (product.stock === 0) return;

    const card = event?.currentTarget?.closest('[data-product-card]');
    const image = card?.querySelector('img');
    if (image) flyToCart(image, cartButtonRef.current);

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + 1, product.stock || 99) }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    bumpCart();
    toast.success(`${product.name} added to cart`);
  };

  const removeFromCart = (productId) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === productId);
      if (!existing) return prev;
      if (existing.quantity > 1) {
        return prev.map((item) =>
          item.id === productId ? { ...item, quantity: item.quantity - 1 } : item
        );
      }
      return prev.filter((item) => item.id !== productId);
    });
  };

  const placeOrder = async () => {
    if (cart.length === 0 || placingOrder) return;
    setPlacingOrder(true);
    try {
      const response = await orderAPI.createOrder({
        items: cart.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
        })),
      });

      if (response.data?.success) {
        const orderNumber = response.data?.data?.order?.orderNumber;
        toast.success(
          orderNumber ? `Order ${orderNumber} placed — invoice on its way!` : 'Order placed successfully!'
        );
        setCart([]);
        fetchProducts(); // refresh stock after order
        navigate('/customer-portal/orders'); // see it in Orders, with invoice
      }
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error(error.response?.data?.message || 'Failed to place order. Please try again.');
    } finally {
      setPlacingOrder(false);
    }
  };

  /* -------------------------------------------------- derived */

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = category === 'all' || product.category === category;
    return matchesSearch && matchesCategory;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary via-secondary to-accent p-6 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Customer Portal</h1>
              <p className="text-white/80">Browse the catalogue, order, track and pay — all in one place</p>
            </div>
            <button
              ref={cartButtonRef}
              onClick={() =>
                document.getElementById('cart-section')?.scrollIntoView({ behavior: 'smooth' })
              }
              className={
                'relative flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-5 py-2.5 rounded-xl border border-white/30 transition-all duration-300 hover:scale-105 ' +
                (cartBump ? 'scale-110 shadow-[0_0_0_6px_rgba(255,255,255,0.18)]' : '')
              }
              style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="font-semibold">Cart</span>
              <span
                className={
                  'bg-destructive text-white rounded-full min-w-[1.5rem] h-6 px-1.5 flex items-center justify-center text-xs font-bold transition-transform duration-300 ' +
                  (cartBump ? 'scale-125' : '')
                }
              >
                {cartItemCount}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Search and Filters */}
        <Card className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary bg-white text-gray-900"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary bg-white text-gray-900"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <div className="flex border rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-primary text-white' : 'bg-white text-gray-900'}`}
                  aria-label="Grid view"
                >
                  <Grid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-primary text-white' : 'bg-white text-gray-900'}`}
                  aria-label="List view"
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Products Grid/List */}
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
          {loading ? (
            <div className="col-span-full text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading products...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No products found</p>
            </div>
          ) : (
            filteredProducts.map((product) => (
              <Card
                key={product.id}
                data-product-card
                className="overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div className={viewMode === 'grid' ? '' : 'flex'}>
                  <div className={viewMode === 'grid' ? 'h-48' : 'w-48 h-48'}>
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = DEFAULT_PRODUCT_IMAGES.default;
                      }}
                    />
                  </div>
                  <div className="p-6 flex-1">
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <h3 className="font-semibold text-lg">{product.name}</h3>
                      <span className="text-primary font-bold text-xl whitespace-nowrap">
                        {inr(product.price)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{product.description}</p>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                          product.stock > 50 ? 'bg-success/10 text-success' :
                          product.stock > 0 ? 'bg-warning/10 text-warning' :
                          'bg-destructive/10 text-destructive'
                        }`}
                      >
                        {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                      </span>
                      <Button
                        onClick={(e) => addToCart(product, e)}
                        disabled={product.stock === 0}
                        size="sm"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add to Cart
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Shopping Cart */}
        <div id="cart-section">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center">
              <ShoppingCart className="w-6 h-6 mr-2 text-primary" />
              Shopping Cart
              {cartItemCount > 0 && (
                <Badge variant="secondary" className="ml-3">{cartItemCount} item{cartItemCount > 1 ? 's' : ''}</Badge>
              )}
            </h2>
            {cart.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Your cart is empty</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add a product and it will fly right in here.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4 mb-6">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 border rounded-lg gap-3 flex-wrap"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-[220px]">
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                        <div>
                          <h4 className="font-semibold">{item.name}</h4>
                          <p className="text-sm text-muted-foreground">{inr(item.price)} each</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => removeFromCart(item.id)}
                            variant="outline"
                            size="sm"
                            aria-label={`Remove one ${item.name}`}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="w-10 text-center font-semibold">{item.quantity}</span>
                          <Button
                            onClick={() => addToCart(item)}
                            variant="outline"
                            size="sm"
                            aria-label={`Add one ${item.name}`}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="w-32 text-right font-bold">
                          {inr(item.price * item.quantity)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-6">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-xl font-semibold">Total:</span>
                    <span className="text-3xl font-bold text-primary">{inr(cartTotal)}</span>
                  </div>
                  <Button
                    onClick={placeOrder}
                    disabled={placingOrder}
                    className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
                    size="lg"
                  >
                    {placingOrder ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                      <Check className="w-5 h-5 mr-2" />
                    )}
                    {placingOrder ? 'Placing order...' : 'Place Order'}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-3">
                    An ARTHA invoice is generated the moment your order is placed.
                  </p>
                </div>
              </>
            )}
          </Card>
        </div>

      </div>
    </div>
  );
};

export default CustomerDashboard;
