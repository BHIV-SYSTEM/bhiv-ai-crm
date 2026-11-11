import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Package, Truck, Check, Clock, Receipt, ChevronRight, RefreshCw,
  Loader2, ShoppingCart, Search, RotateCcw,
} from 'lucide-react';
import Button from '@/components/common/ui/Button';
import Card from '@/components/common/ui/Card';
import Badge from '@/components/common/ui/Badge';
import { orderAPI } from '@/services/api/orderAPI';

const CART_STORAGE_KEY = 'setu.customer.cart.v1';

const DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&auto=format&fit=crop&q=80';

const normalizeOrder = (o) => ({
  id: o._id || o.id,
  orderNumber: o.orderNumber || (o._id || o.id),
  created_at: o.createdAt || o.created_at,
  total_amount: Number(o.totalAmount || o.total_amount || 0),
  status: String(o.status || 'PLACED').toUpperCase(),
  items: Array.isArray(o.items) ? o.items : [],
});

const statusVariant = (status) => {
  if (status === 'DELIVERED') return 'success';
  if (status === 'DISPATCHED') return 'info';
  if (status === 'PLACED') return 'warning';
  return 'muted';
};

const statusLabel = (status) => {
  if (status === 'PLACED') return 'Order placed';
  if (status === 'DISPATCHED') return 'On the way';
  if (status === 'DELIVERED') return 'Delivered';
  return status;
};

/** Vertical tracking timeline with dealer legs + worker start/end times. */
const OrderTimeline = ({ tracking, refreshing, onRefresh }) => {
  const timeline = tracking?.timeline || [];
  const worker = tracking?.worker;
  const eta = tracking?.eta;

  return (
    <div className="mt-4 rounded-xl border bg-muted/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold flex items-center gap-2">
          <Truck className="w-4 h-4 text-primary" />
          Shipment tracking
        </h4>
        <div className="flex items-center gap-3">
          {eta && (
            <span className="text-xs text-muted-foreground">
              ETA {new Date(eta).toLocaleDateString()}
            </span>
          )}
          <button
            onClick={onRefresh}
            className="text-xs text-primary flex items-center gap-1 hover:underline"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <ol className="relative space-y-4 pl-6">
        <span className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
        {timeline.map((step, idx) => {
          const done = step.state === 'done';
          const isLast = idx === timeline.length - 1;
          const nextPending = !done && timeline.slice(0, idx).every((s) => s.state === 'done');
          const active = !done && nextPending && !isLast;
          return (
            <li key={step.key} className="relative">
              <span
                className={
                  `absolute -left-6 top-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ` +
                  (done
                    ? 'bg-success border-success'
                    : active
                      ? 'bg-warning border-warning animate-pulse'
                      : 'bg-background border-border')
                }
              >
                {done && <Check className="w-2.5 h-2.5 text-white" />}
              </span>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className={`text-sm font-medium ${done ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {step.at ? new Date(step.at).toLocaleString() : '—'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{step.description}</p>
            </li>
          );
        })}
      </ol>

      {(worker?.startedAt || worker?.endedAt) && (
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg bg-background border p-3">
            <p className="text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> Worker start time
            </p>
            <p className="font-semibold mt-1">
              {worker.startedAt ? new Date(worker.startedAt).toLocaleString() : 'Not started'}
            </p>
          </div>
          <div className="rounded-lg bg-background border p-3">
            <p className="text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> Worker end time
            </p>
            <p className="font-semibold mt-1">
              {worker.endedAt ? new Date(worker.endedAt).toLocaleString() : 'In progress'}
            </p>
          </div>
        </div>
      )}

      {tracking?.shipment?.dealer_name && (
        <p className="mt-3 text-xs text-muted-foreground">
          Dealer: <span className="font-medium text-foreground">{tracking.shipment.dealer_name}</span>
          {' · '}Tracking no.{' '}
          <span className="font-mono">{tracking.shipment.tracking_number}</span>
        </p>
      )}
    </div>
  );
};

/**
 * My Orders — the history screen every ecommerce customer expects
 * (Flipkart/Amazon style): filter by status, track each shipment live,
 * invoice with Pay Now, mark received, and buy the same items again.
 */
const CustomerOrders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [finance, setFinance] = useState({});
  const [tracking, setTracking] = useState({});
  const [openTracking, setOpenTracking] = useState(null);
  const [refreshingTracking, setRefreshingTracking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await orderAPI.getOrders({ page: 1, limit: 50 });
      const rows = res.data?.data?.orders || [];
      setOrders(rows.map(normalizeOrder));
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Could not load your orders');
    } finally {
      setLoading(false);
    }
  }, []);

  // Invoice (ARTHA) status per order — raised at placement, polled briefly.
  useEffect(() => {
    if (orders.length === 0) return undefined;
    let cancelled = false;
    let attempts = 0;

    const load = async () => {
      attempts += 1;
      const results = await Promise.allSettled(
        orders.map(async (o) => {
          const res = await orderAPI.getOrderFinance(o.id);
          return [o.id, res.data?.data?.finance || null];
        })
      );
      if (cancelled) return;

      const next = {};
      results.forEach((r) => {
        if (r.status === 'fulfilled') next[r.value[0]] = r.value[1];
      });
      setFinance((prev) => ({ ...prev, ...next }));

      const stillPending = orders.some((o) => next[o.id] === null);
      if (stillPending && attempts < 6) {
        setTimeout(load, 3000);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [orders]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const loadTracking = useCallback(async (orderId) => {
    try {
      setRefreshingTracking(true);
      const res = await orderAPI.getOrderTracking(orderId);
      if (res.data?.success) {
        setTracking((prev) => ({ ...prev, [orderId]: res.data.data }));
      }
    } catch (error) {
      console.error('Error loading tracking:', error);
    } finally {
      setRefreshingTracking(false);
    }
  }, []);

  const toggleTracking = (orderId) => {
    if (openTracking === orderId) {
      setOpenTracking(null);
      return;
    }
    setOpenTracking(orderId);
    loadTracking(orderId);
  };

  // Live tracking: poll the open timeline so movement shows up in real time.
  useEffect(() => {
    if (!openTracking) return undefined;
    const timer = setInterval(() => loadTracking(openTracking), 6000);
    return () => clearInterval(timer);
  }, [openTracking, loadTracking]);

  const confirmReceived = async (orderId) => {
    try {
      const response = await orderAPI.confirmDelivery(orderId);
      if (response.data?.success) {
        toast.success('Thank you! Order marked as delivered.');
        fetchOrders();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to confirm delivery.');
    }
  };

  /** Buy Again — drops the same items back into the persistent cart. */
  const buyAgain = (order) => {
    try {
      const stored = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
      const cart = Array.isArray(stored) ? [...stored] : [];
      let added = 0;

      order.items.forEach((item) => {
        const id = item.productId?._id || item.productId;
        if (!id) return;
        const existing = cart.find((c) => c.id === id);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          cart.push({
            id,
            name: item.productName || 'Product',
            description: '',
            category: '',
            price: Number(item.price || 0),
            stock: 99,
            image_url: DEFAULT_IMAGE,
            quantity: item.quantity,
          });
        }
        added += 1;
      });

      if (added === 0) {
        toast.error('These items are no longer available');
        return;
      }
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      toast.success(`${added} item(s) added back to your cart`);
      navigate('/customer-portal');
    } catch {
      toast.error('Could not rebuild the cart');
    }
  };

  const visibleOrders = orders.filter((order) => {
    const matchesFilter = filter === 'all' || order.status === filter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      order.orderNumber.toLowerCase().includes(q) ||
      order.items.some((i) => String(i.productName || '').toLowerCase().includes(q));
    return matchesFilter && matchesSearch;
  });

  const FILTERS = [
    { key: 'all', label: 'All orders' },
    { key: 'PLACED', label: 'Placed' },
    { key: 'DISPATCHED', label: 'On the way' },
    { key: 'DELIVERED', label: 'Delivered' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">My Orders</h1>
          <p className="text-sm text-muted-foreground">
            Track deliveries, view invoices and buy again — everything you&apos;ve ordered.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Search + status filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Search by order number or item…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-all ' +
                  (filter === f.key
                    ? 'gradient-primary text-primary-foreground shadow-glow-primary'
                    : 'bg-muted text-muted-foreground hover:text-foreground')
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading your orders…
        </div>
      ) : visibleOrders.length === 0 ? (
        <Card className="py-16 text-center">
          <Package className="w-14 h-14 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-semibold">
            {orders.length === 0 ? 'No orders yet' : 'No orders match your filters'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {orders.length === 0
              ? 'Anything you order will show up here with live tracking.'
              : 'Try a different status or clear the search.'}
          </p>
          {orders.length === 0 && (
            <Button className="mt-4" onClick={() => navigate('/customer-portal')}>
              <ShoppingCart className="w-4 h-4 mr-2" /> Start shopping
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {visibleOrders.map((order) => {
            const f = finance[order.id];
            const track = tracking[order.id];
            const isOpen = openTracking === order.id;
            return (
              <Card key={order.id} className="p-5">
                <div className="flex justify-between items-start mb-3 gap-3 flex-wrap">
                  <div>
                    <h4 className="font-semibold flex items-center gap-2">
                      {order.orderNumber}
                      <Badge variant={statusVariant(order.status)}>
                        {statusLabel(order.status)}
                      </Badge>
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Placed on {new Date(order.created_at).toLocaleString()}
                      {order.items?.length ? ` · ${order.items.length} item(s)` : ''}
                    </p>
                  </div>
                  <span className="font-bold text-lg">{`₹${order.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}</span>
                </div>

                {/* Item thumbnails row */}
                {order.items.length > 0 && (
                  <div className="flex flex-wrap gap-3 mb-3">
                    {order.items.map((item, idx) => (
                      <div
                        key={`${order.id}-${idx}`}
                        className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-1.5 text-sm"
                      >
                        <ShoppingCart className="w-3.5 h-3.5 text-primary" />
                        <span className="font-medium">{item.productName}</span>
                        <span className="text-muted-foreground">× {item.quantity}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Invoice / billing line */}
                <div className="flex flex-wrap items-center gap-2 text-sm border-t pt-3">
                  <Receipt className="w-4 h-4 text-primary" />
                  {f === undefined ? (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Checking invoice…
                    </span>
                  ) : f === null ? (
                    <span className="text-muted-foreground">Invoice not generated yet</span>
                  ) : f.cancelled ? (
                    <span className="text-destructive">Invoice cancelled</span>
                  ) : f.invoiceNumber ? (
                    <>
                      <span className="font-mono">{f.invoiceNumber}</span>
                      <Badge variant={f.invoiceStatus === 'paid' ? 'success' : 'warning'}>
                        {f.invoiceStatus || 'draft'}
                      </Badge>
                      <button
                        onClick={() => navigate(`/customer-portal/pay/${order.id}`)}
                        className="ml-auto inline-flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold hover:scale-105 transition-transform"
                      >
                        Pay Now <ChevronRight className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      Invoice sync {f.eventStatus || 'pending'}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => buyAgain(order)}>
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Buy again
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toggleTracking(order.id)}>
                    <Truck className="w-4 h-4 mr-1" />
                    {isOpen ? 'Hide tracking' : 'Track order'}
                  </Button>
                  {order.status === 'DISPATCHED' && (
                    <Button size="sm" onClick={() => confirmReceived(order.id)}>
                      <Check className="w-4 h-4 mr-1" />
                      Mark Received
                    </Button>
                  )}
                </div>

                {isOpen && (
                  <OrderTimeline
                    tracking={track}
                    refreshing={refreshingTracking}
                    onRefresh={() => loadTracking(order.id)}
                  />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CustomerOrders;
