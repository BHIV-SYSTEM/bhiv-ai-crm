import express from 'express';
import mongoose from 'mongoose';
import Shipment from '../models/Shipment.js';
import Order from '../models/Order.js';
import Notification from '../models/Notification.js';
import { protect } from '../middleware/auth.js';
import { USER_ROLES, HTTP_STATUS } from '../config/constants.js';

const router = express.Router();

// All shipment/returns routes require an authenticated user (privacy: shipment
// data is never served anonymously).
router.use(protect);

const isCustomer = (user) => user?.role === USER_ROLES.CUSTOMER;
const isSeller = (user) => user?.role === USER_ROLES.SELLER;

/**
 * Order numbers assigned to this seller — their parcel worklist. Parcels are
 * assigned by an admin (PUT /api/orders/:id/assign); a seller only ever sees
 * and moves the ones assigned to them.
 */
const sellerOrderNumbers = (userId) =>
  Order.find({ assignedSeller: userId })
    .select('orderNumber')
    .lean()
    .then((rows) => rows.map((o) => o.orderNumber));

/**
 * Customer ownership check for a shipment's order.
 * Returns true when the caller is allowed to see it.
 * - staff: always allowed
 * - customers: allowed only when the linked order belongs to them
 */
const customerCanSeeShipment = async (shipment, user) => {
  if (!isCustomer(user)) return true;
  if (!shipment?.order_id) return false;
  const order = await Order.findOne({ orderNumber: shipment.order_id })
    .select('customerId orderNumber')
    .lean();
  if (!order) return false; // cannot verify ownership → hide from customers
  return String(order.customerId) === String(user._id);
};

// Sample initial couriers
const DEFAULT_COURIERS = [
  { id: 'c1', name: 'BlueDart Express', rating: 4.8, active: true },
  { id: 'c2', name: 'Delhivery', rating: 4.6, active: true },
  { id: 'c3', name: 'FedEx India', rating: 4.7, active: true },
  { id: 'c4', name: 'DTDC Logistics', rating: 4.4, active: true }
];

/**
 * GET /delivery/shipments
 * List shipments (customers only ever see their own)
 */
router.get('/shipments', async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    let shipments = [];

    if (mongoose.connection.readyState === 1) {
      if (isCustomer(req.user)) {
        const ownOrderNumbers = await Order.find({ customerId: req.user._id })
          .select('orderNumber')
          .lean()
          .then((rows) => rows.map((o) => o.orderNumber));
        shipments = await Shipment.find({ ...query, order_id: { $in: ownOrderNumbers } }).lean();
      } else if (isSeller(req.user)) {
        // Sellers only see parcels the admin assigned to them
        const assigned = await sellerOrderNumbers(req.user._id);
        shipments = await Shipment.find({ ...query, order_id: { $in: assigned } }).lean();
      } else {
        shipments = await Shipment.find(query).lean();
      }
    }

    // No demo/sample shipments: when the DB is empty every account honestly
    // sees an empty list (the old SHP-1001/1002 "demo" rows made all accounts
    // show identical fake data).

    return res.status(200).json({ shipments, count: shipments.length });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /delivery/track/:trackingNumber
 * Track shipment by tracking number
 */
router.get('/track/:trackingNumber', async (req, res) => {
  try {
    const { trackingNumber } = req.params;
    let shipment = null;

    if (mongoose.connection.readyState === 1) {
      shipment = await Shipment.findOne({ tracking_number: trackingNumber }).lean();
    }

    if (shipment) {
      const allowed = await customerCanSeeShipment(shipment, req.user);
      if (!allowed) {
        // Do not reveal that someone else's tracking number exists.
        return res.status(404).json({ success: false, message: 'Shipment not found' });
      }
      return res.status(200).json(shipment);
    }

    // No real shipment matched.
    if (isCustomer(req.user)) {
      // Customers get an honest 404 instead of fabricated demo data.
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }

    shipment = {
      shipment_id: 'SHP-TRACK-01',
      tracking_number: trackingNumber,
      order_id: 'ORD-9901',
      courier_name: 'BlueDart Express',
      status: 'IN_TRANSIT',
      location: 'In Transit to Recipient Address',
      estimated_delivery: new Date(Date.now() + 86400000).toISOString()
    };

    return res.status(200).json(shipment);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /delivery/order/:orderId
 * Get shipment by order ID (order number)
 */
router.get('/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    if (isCustomer(req.user)) {
      // Ownership: the order number must belong to the calling customer.
      const order = await Order.findOne({ orderNumber: orderId })
        .select('customerId orderNumber')
        .lean();
      if (!order || String(order.customerId) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Not authorized to view this shipment' });
      }
    } else if (isSeller(req.user)) {
      // Sellers only see parcels the admin assigned to them
      const order = await Order.findOne({ orderNumber: orderId })
        .select('assignedSeller orderNumber')
        .lean();
      if (!order || String(order.assignedSeller || '') !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Not authorized to view this shipment' });
      }
    }

    let shipment = null;
    if (mongoose.connection.readyState === 1) {
      shipment = await Shipment.findOne({ order_id: orderId }).lean();
    }

    if (!shipment) {
      return res.status(404).json({ success: false, message: 'No shipment found for this order' });
    }

    return res.status(200).json(shipment);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /delivery/couriers
 * List available couriers
 */
router.get('/couriers', (req, res) => {
  return res.status(200).json({ couriers: DEFAULT_COURIERS, count: DEFAULT_COURIERS.length });
});

/* ------------------------------------------------------------------
 * Dealer / delivery-worker flow (seller agent portal)
 * ------------------------------------------------------------------ */

/** Human-readable copy + timestamp side-effects for each dealer action. */
const SHIPMENT_STEPS = {
  PICKED_UP: {
    label: 'Picked up by dealer',
    description: 'The delivery worker collected the parcel',
    eventKey: 'picked_up',
  },
  IN_TRANSIT: {
    label: 'In transit',
    description: 'The parcel is on its way to you',
    eventKey: 'in_transit',
  },
  OUT_FOR_DELIVERY: {
    label: 'Out for delivery',
    description: 'The delivery worker is on the final leg',
    eventKey: 'out_for_delivery',
  },
  DELIVERED: {
    label: 'Delivered',
    description: 'Handed over to the customer',
    eventKey: 'delivered',
  },
};

/** Forward-only progression: a shipment can never move backwards. */
const VALID_PREDECESSORS = {
  PICKED_UP: ['PENDING_PICKUP', 'DISPATCHED'],
  IN_TRANSIT: ['PENDING_PICKUP', 'DISPATCHED', 'PICKED_UP'],
  OUT_FOR_DELIVERY: ['PENDING_PICKUP', 'DISPATCHED', 'PICKED_UP', 'IN_TRANSIT'],
  DELIVERED: ['PENDING_PICKUP', 'DISPATCHED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'],
};

const findShipment = async (id) => {
  if (!id) return null;
  const or = [{ shipment_id: id }, { tracking_number: id }];
  if (mongoose.isValidObjectId(id)) or.push({ _id: new mongoose.Types.ObjectId(id) });
  return Shipment.findOne({ $or: or });
};

/**
 * PUT /delivery/shipments/:id/status
 * Dealer advances the shipment (pickup -> transit -> out for delivery ->
 * delivered). Stamps worker start/end times, appends the timeline event and
 * notifies the customer who owns the linked order.
 * @access Private/Staff (customers cannot drive shipping state)
 */
router.put('/shipments/:id/status', async (req, res) => {
  try {
    if (isCustomer(req.user)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to update shipments`,
      });
    }

    const status = String(req.body?.status || '').toUpperCase();
    const step = SHIPMENT_STEPS[status];
    if (!step) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `Invalid status '${status}'`,
        allowed: Object.keys(SHIPMENT_STEPS),
      });
    }

    const shipment = await findShipment(req.params.id);
    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }

    // Sellers can only move parcels the admin assigned to them
    if (isSeller(req.user)) {
      const assigned = await sellerOrderNumbers(req.user._id);
      if (!assigned.includes(shipment.order_id)) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'Not authorized to update this shipment',
        });
      }
    }

    const current = String(shipment.status || '').toUpperCase();
    if (current === status) {
      // Idempotent: same state, no duplicate timeline event.
      return res.status(200).json({ success: true, data: { shipment, unchanged: true } });
    }
    if (!VALID_PREDECESSORS[status].includes(current)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `Shipment cannot move from '${current}' to '${status}'`,
      });
    }

    const now = new Date();
    const workerName =
      String(req.body?.workerName || req.body?.worker?.name || req.body?.dealerName || '').trim() ||
      shipment.worker?.name ||
      null;
    const actorName = req.user?.name || req.user?.email || 'SETU staff';

    shipment.status = status;
    shipment.worker = shipment.worker || {};
    if (workerName) {
      shipment.worker.name = workerName;
      shipment.dealer_name = workerName;
    }
    if (status === 'PICKED_UP') {
      shipment.pickup_at = now;
      if (!shipment.worker.startedAt) shipment.worker.startedAt = now; // worker start time
    }
    if (status === 'OUT_FOR_DELIVERY') shipment.out_for_delivery_at = now;
    if (status === 'DELIVERED') {
      shipment.delivered_at = now;
      shipment.worker.endedAt = now; // worker end time
    }

    shipment.events = shipment.events || [];
    shipment.events.push({
      key: step.eventKey,
      label: step.label,
      state: 'done',
      at: now,
      actor: actorName,
      note: String(req.body?.note || '').trim() || null,
    });

    await shipment.save();

    // Notify the customer who owns the linked order (best effort, non-blocking).
    setImmediate(async () => {
      try {
        const order = await Order.findOne({ orderNumber: shipment.order_id })
          .select('customerId orderNumber')
          .lean();
        if (!order?.customerId) return;
        await Notification.notifyUsers([order.customerId], {
          type: 'shipment',
          level: status === 'DELIVERED' ? 'success' : 'info',
          title: `${step.label} — order ${shipment.order_id}`,
          body: step.description,
          data: {
            orderId: String(order._id),
            orderNumber: shipment.order_id,
            shipmentId: shipment.shipment_id,
            trackingNumber: shipment.tracking_number,
            status,
          },
        });
      } catch (e) {
        console.warn('Shipment notification failed:', e.message);
      }
    });

    return res.status(200).json({
      success: true,
      message: step.label,
      data: { shipment, at: now, worker: shipment.worker },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /delivery/portal
 * Dealer / seller-agent worklist: every shipment joined with its order,
 * newest first. Staff-only (customers use /api/orders/:id/tracking).
 */
router.get('/portal', async (req, res) => {
  try {
    if (isCustomer(req.user)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access the dealer portal`,
      });
    }

    const shipments = mongoose.connection.readyState === 1
      ? await Shipment.find(
          isSeller(req.user)
            ? { order_id: { $in: await sellerOrderNumbers(req.user._id) } }
            : {}
        ).sort({ updatedAt: -1 }).limit(200).lean()
      : [];

    const orderNumbers = [...new Set(shipments.map((s) => s.order_id).filter(Boolean))];
    const orders = orderNumbers.length > 0
      ? await Order.find({ orderNumber: { $in: orderNumbers } })
        .select('orderNumber status totalAmount customerId items createdAt tracking shippingAddress')
        .populate('customerId', 'name email shopDetails')
        .lean()
      : [];
    const orderByNumber = new Map(orders.map((o) => [o.orderNumber, o]));

    const joined = shipments.map((shipment) => ({
      ...shipment,
      order: orderByNumber.get(shipment.order_id) || null,
    }));

    return res.status(200).json({ shipments: joined, count: joined.length });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /delivery/run
 * Trigger delivery agent run (staff only)
 */
router.post('/run', async (req, res) => {
  try {
    if (isCustomer(req.user)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access this route`,
      });
    }

    const newShipment = {
      shipment_id: `SHP-${Date.now().toString().slice(-4)}`,
      tracking_number: `TRK-${Math.floor(100000 + Math.random() * 900000)}`,
      order_id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      courier_name: 'BlueDart Express',
      status: 'DISPATCHED'
    };

    if (mongoose.connection.readyState === 1) {
      await Shipment.create(newShipment);
    }

    return res.status(200).json({
      success: true,
      results: { shipments_created: 1, shipments_updated: 0 },
      message: 'Delivery agent run completed: 1 shipment dispatched'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
