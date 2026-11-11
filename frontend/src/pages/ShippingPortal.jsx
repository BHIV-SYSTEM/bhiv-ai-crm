import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  BadgeCheck, Bell, CheckCircle2, Clock, FileText, Loader2, Package,
  RefreshCw, Store, Truck, UserCog, UserPlus,
} from 'lucide-react';
import orderAPI from '@/services/api/orderAPI';
import logisticsAPI from '@/services/api/logisticsAPI';
import notificationAPI from '@/services/api/notificationAPI';
import userAPI from '@/services/api/userAPI';
import { useAuth } from '@/context/MongoAuthContext';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/common/ui/Card';
import Badge from '@/components/common/ui/Badge';
import Button from '@/components/common/ui/Button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/common/ui/Table';
import { money, fmtDate } from '@/utils/formatters';
import { formatRelativeTime } from '@/utils/dateUtils';

const SHIPMENT_STATUS = {
  PENDING_PICKUP: { variant: 'warning', label: 'Awaiting pickup' },
  DISPATCHED: { variant: 'info', label: 'Dispatched' },
  PICKED_UP: { variant: 'info', label: 'Picked up' },
  IN_TRANSIT: { variant: 'info', label: 'In transit' },
  OUT_FOR_DELIVERY: { variant: 'accent', label: 'Out for delivery' },
  DELIVERED: { variant: 'success', label: 'Delivered' },
};

const ORDER_STATUS = {
  PLACED: 'warning',
  DISPATCHED: 'info',
  DELIVERED: 'success',
};

/** Forward-only dealer progression: label for the next action, if any. */
const NEXT_STEP = {
  PENDING_PICKUP: { status: 'PICKED_UP', label: 'Start pickup', icon: Package },
  DISPATCHED: { status: 'PICKED_UP', label: 'Start pickup', icon: Package },
  PICKED_UP: { status: 'IN_TRANSIT', label: 'Mark in transit', icon: Truck },
  IN_TRANSIT: { status: 'OUT_FOR_DELIVERY', label: 'Out for delivery', icon: Truck },
  OUT_FOR_DELIVERY: { status: 'DELIVERED', label: 'Mark delivered', icon: BadgeCheck },
  DELIVERED: null,
};

const relTime = (value) => {
  if (!value) return '—';
  try {
    return formatRelativeTime(value);
  } catch {
    return new Date(value).toLocaleString();
  }
};

/**
 * Seller / agent portal — one screen for the owner side of the flow:
 *   1. Orders & invoices (what the customer bought + the ARTHA invoice state)
 *   2. Dealer shipping (pickup -> transit -> out for delivery -> delivered,
 *      with worker start/end times)
 *   3. Notifications (live feed of everything that happened)
 */
export const ShippingPortal = () => {
  const { user } = useAuth();
  // Staff (admin/manager) oversee ALL parcels and assign them to sellers.
  // Sellers only ever receive their own assigned parcels — the backend scopes
  // every query by `assignedSeller`, this UI just renders what comes back.
  const isStaff = user?.role === 'admin' || user?.role === 'manager';
  const isSeller = user?.role === 'seller';
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [finance, setFinance] = useState({});
  const [shipments, setShipments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(null);
  const [dealerDraft, setDealerDraft] = useState({});

  const loadOrders = useCallback(async () => {
    try {
      const res = await orderAPI.getOrders({ page: 1, limit: 100 });
      const rows = res.data?.data?.orders || [];
      setOrders(rows);

      const results = await Promise.allSettled(
        rows.map(async (o) => {
          const r = await orderAPI.getOrderFinance(o._id);
          return [o._id, r.data?.data?.finance || null];
        })
      );
      const next = {};
      results.forEach((r) => {
        if (r.status === 'fulfilled') next[r.value[0]] = r.value[1];
      });
      setFinance(next);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not load orders');
    }
  }, []);

  const loadShipments = useCallback(async () => {
    try {
      const res = await logisticsAPI.getDealerPortal();
      setShipments(res.data?.shipments || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not load shipments');
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await notificationAPI.list({ limit: 25 });
      setNotifications(res.data?.data || []);
    } catch {
      setNotifications([]);
    }
  }, []);

  // The assignment dropdown needs the list of seller accounts (staff only).
  const loadSellers = useCallback(async () => {
    if (!isStaff) return;
    try {
      const res = await userAPI.getUsers({ role: 'seller', limit: 100 });
      setSellers(res.data?.data?.users || []);
    } catch {
      setSellers([]);
    }
  }, [isStaff]);

  const reload = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadOrders(), loadShipments(), loadNotifications(), loadSellers()]);
    setLoading(false);
  }, [loadOrders, loadShipments, loadNotifications, loadSellers]);

  useEffect(() => {
    reload();
  }, [reload]);

  const dispatch = async (orderId) => {
    setWorking(orderId);
    try {
      const res = await orderAPI.dispatchOrder(orderId);
      const shipment = res.data?.data?.shipment;
      toast.success(
        shipment?.shipment_id
          ? `Dispatched — shipment ${shipment.shipment_id} created`
          : 'Order dispatched'
      );
      await Promise.all([loadOrders(), loadShipments(), loadNotifications()]);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not dispatch this order');
    } finally {
      setWorking(null);
    }
  };

  // Admin/manager: assign a parcel to a seller (or unassign with '').
  const assign = async (orderId, sellerId) => {
    setWorking(orderId);
    try {
      const res = await orderAPI.assignOrder(orderId, sellerId || null);
      toast.success(res.data?.message || 'Assignment updated');
      await Promise.all([loadOrders(), loadShipments()]);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not assign this parcel');
    } finally {
      setWorking(null);
    }
  };

  const advance = async (shipment) => {
    const step = NEXT_STEP[String(shipment.status || '').toUpperCase()];
    if (!step) return;
    const id = shipment._id || shipment.shipment_id;
    setWorking(id);
    try {
      const workerName = String(dealerDraft[id] || shipment.dealer_name || '').trim();
      const res = await logisticsAPI.updateShipmentStatus(id, {
        status: step.status,
        ...(workerName ? { workerName } : {}),
      });
      toast.success(res.data?.message || 'Shipment updated');
      await Promise.all([loadShipments(), loadNotifications()]);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not update the shipment');
    } finally {
      setWorking(null);
    }
  };

  const kpis = useMemo(() => {
    const count = (s) => shipments.filter((x) => String(x.status || '').toUpperCase() === s).length;
    const invoiceCount = Object.values(finance).filter((f) => f?.invoiceNumber).length;
    const base = [
      { label: 'Orders', value: orders.length, icon: FileText },
      { label: 'Invoices (ARTHA)', value: invoiceCount, icon: FileText },
      { label: 'Awaiting pickup', value: count('PENDING_PICKUP') + count('DISPATCHED'), icon: Package },
      { label: 'On the road', value: count('PICKED_UP') + count('IN_TRANSIT') + count('OUT_FOR_DELIVERY'), icon: Truck },
      { label: 'Delivered', value: count('DELIVERED'), icon: CheckCircle2 },
    ];
    return isStaff
      ? [
          {
            label: 'Unassigned',
            value: orders.filter((o) => !o.assignedSeller).length,
            icon: UserPlus,
          },
          ...base,
        ]
      : base;
  }, [orders, shipments, finance, isStaff]);

  const tabs = [
    { key: 'orders', label: 'Orders & Invoices', icon: Store },
    { key: 'shipping', label: 'Dealer / Shipping', icon: Truck },
    { key: 'notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">
            {isSeller ? 'My Parcel Workspace' : 'Sellers & Dispatch'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSeller
              ? 'Parcels the admin assigned to you — dispatch, pickup and delivery in one place.'
              : 'Assign parcels to sellers, then track ARTHA invoices and parcel movement.'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* KPI strip */}
      <div className={`grid grid-cols-2 gap-3 ${isStaff ? 'md:grid-cols-6' : 'md:grid-cols-5'}`}>
        {kpis.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{label}</span>
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ' +
              (tab === key
                ? 'gradient-primary text-primary-foreground shadow-glow-primary'
                : 'bg-muted text-muted-foreground hover:text-foreground')
            }
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading workspace…
        </div>
      ) : tab === 'orders' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Customer orders & their ARTHA invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {isSeller
                  ? 'No parcels assigned to you yet — the admin assigns parcels to your seller ID and they appear here instantly.'
                  : 'No orders yet. They appear the moment a customer checks out.'}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Invoice (ARTHA)</TableHead>
                    {isStaff && <TableHead>Assigned seller</TableHead>}
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => {
                    const f = finance[o._id];
                    return (
                      <TableRow key={o._id}>
                        <TableCell>
                          <span className="font-mono text-xs">{o.orderNumber}</span>
                          <span className="block text-xs text-muted-foreground">
                            {fmtDate(o.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {o.customerId?.name || 'Customer'}
                          <span className="block text-xs text-muted-foreground">
                            {o.customerId?.email}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {money(o.totalAmount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={ORDER_STATUS[o.status] || 'muted'}>{o.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {f === undefined ? (
                            <span className="text-xs text-muted-foreground">checking…</span>
                          ) : f === null ? (
                            <span className="text-xs text-muted-foreground">not raised yet</span>
                          ) : f.invoiceNumber ? (
                            <span className="text-xs">
                              <span className="font-mono">{f.invoiceNumber}</span>
                              <Badge
                                variant={f.invoiceStatus === 'paid' ? 'success' : 'warning'}
                                className="ml-2"
                              >
                                {f.invoiceStatus || 'draft'}
                              </Badge>
                              {f.totalAmount != null && (
                                <span className="block text-muted-foreground">
                                  {money(f.totalAmount)}
                                  {f.amountPaid > 0 ? ` · paid ${money(f.amountPaid)}` : ''}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              sync {f.eventStatus || 'pending'}
                            </span>
                          )}
                        </TableCell>
                        {isStaff && (
                          <TableCell>
                            <select
                              value={o.assignedSeller?._id || ''}
                              disabled={working === o._id}
                              onChange={(e) => assign(o._id, e.target.value)}
                              aria-label={`Assign parcel ${o.orderNumber} to a seller`}
                              className="px-2 py-1.5 rounded-lg border border-border bg-background text-xs"
                            >
                              <option value="">— Unassigned —</option>
                              {sellers.map((s) => (
                                <option key={s._id} value={s._id}>
                                  {s.name || s.email}
                                </option>
                              ))}
                            </select>
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          {o.status === 'PLACED' ? (
                            <Button
                              size="sm"
                              onClick={() => dispatch(o._id)}
                              disabled={working === o._id}
                            >
                              {working === o._id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Dispatch'
                              )}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : tab === 'shipping' ? (
        <div className="space-y-4">
          {shipments.length === 0 ? (
            <Card className="py-12 text-center text-muted-foreground">
              <Truck className="h-12 w-12 mx-auto mb-3 opacity-40" />
              No shipments yet — dispatch an order to create one.
            </Card>
          ) : (
            shipments.map((s) => {
              const statusKey = String(s.status || '').toUpperCase();
              const meta = SHIPMENT_STATUS[statusKey] || { variant: 'muted', label: s.status };
              const next = NEXT_STEP[statusKey];
              const id = s._id || s.shipment_id;
              const order = s.order;
              return (
                <Card key={id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        {s.shipment_id}
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {s.order_id} · {s.courier_name} · tracking{' '}
                        <span className="font-mono">{s.tracking_number}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {order?.customerId?.name || 'Customer'} → {s.destination}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
                        <UserCog className="h-4 w-4 text-primary" />
                        <input
                          value={dealerDraft[id] ?? s.dealer_name ?? ''}
                          onChange={(e) =>
                            setDealerDraft((prev) => ({ ...prev, [id]: e.target.value }))
                          }
                          placeholder="Dealer / worker name"
                          className="w-40 bg-transparent text-sm outline-none"
                        />
                      </div>
                      {next && (
                        <Button
                          size="sm"
                          onClick={() => advance(s)}
                          disabled={working === id}
                        >
                          {working === id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            next.label
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* worker start / end times */}
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Worker start
                      </p>
                      <p className="font-semibold mt-1">
                        {s.worker?.startedAt
                          ? new Date(s.worker.startedAt).toLocaleString()
                          : s.pickup_at
                            ? new Date(s.pickup_at).toLocaleString()
                            : 'Not started'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Worker end
                      </p>
                      <p className="font-semibold mt-1">
                        {s.worker?.endedAt
                          ? new Date(s.worker.endedAt).toLocaleString()
                          : s.delivered_at
                            ? new Date(s.delivered_at).toLocaleString()
                            : 'In progress'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-muted-foreground">Pickup</p>
                      <p className="font-semibold mt-1">{relTime(s.pickup_at)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-muted-foreground">ETA</p>
                      <p className="font-semibold mt-1">{relTime(s.estimated_delivery)}</p>
                    </div>
                  </div>

                  {Array.isArray(s.events) && s.events.length > 0 && (
                    <ol className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                      {s.events.map((ev, idx) => (
                        <li key={`${ev.key}-${idx}`} className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3 w-3 text-success" />
                          <span className="font-medium text-foreground">{ev.label}</span>
                          <span>{new Date(ev.at).toLocaleString()}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </Card>
              );
            })
          )}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Activity notifications</CardTitle>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nothing yet — order, dispatch and delivery events land here.
              </p>
            ) : (
              <ul className="divide-y">
                {notifications.map((n) => (
                  <li key={n._id} className="py-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium flex items-center gap-2">
                        {n.title}
                        {!n.read && <span className="w-2 h-2 rounded-full bg-primary inline-block" />}
                      </p>
                      <p className="text-xs text-muted-foreground">{n.body}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {relTime(n.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ShippingPortal;
