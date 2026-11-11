import express from 'express';
import { body } from 'express-validator';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Shipment from '../models/Shipment.js';
import User from '../models/User.js';
import InventoryLog from '../models/InventoryLog.js';
import RestockRequest from '../models/RestockRequest.js';
import { protect } from '../middleware/auth.js';
import { isAdminOrManager, isCustomer, isShopFloor } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { HTTP_STATUS, ORDER_STATUS, INVENTORY_CHANGE_TYPE, RESTOCK_STATUS, USER_ROLES } from '../config/constants.js';
import emailService from '../services/emailService.js';
import { publishOrderConfirmed } from '../services/arthaEventPublisher.js';
import Notification from '../models/Notification.js';

const router = express.Router();

const DISPATCH_COURIERS = ['BlueDart Express', 'Delhivery', 'FedEx India', 'DTDC Logistics'];

/**
 * Create the logistics shipment for a dispatched order (idempotent — one
 * shipment per order number). Ships against the Order's orderNumber so the
 * existing /delivery routes can look it up by order.
 */
const ensureShipmentForOrder = async (order) => {
  try {
    const existing = await Shipment.findOne({ order_id: order.orderNumber });
    if (existing) return existing;

    const [created] = await Shipment.create([{
      shipment_id: `SHP-${Date.now().toString().slice(-6)}`,
      tracking_number: `TRK-${Math.floor(100000 + Math.random() * 900000)}`,
      order_id: order.orderNumber,
      courier_name: DISPATCH_COURIERS[Math.floor(Math.random() * DISPATCH_COURIERS.length)],
      status: 'PENDING_PICKUP',
      origin: 'Mumbai Distribution Hub',
      destination: order.shippingAddress?.address
        || order.shippingAddress?.shopName
        || 'Customer Warehouse',
      estimated_delivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    }]);
    return created;
  } catch (e) {
    console.warn('Failed to create shipment for order:', e.message);
    return null;
  }
};

// All routes require authentication
router.use(protect);

/**
 * A seller may only touch an order that the admin assigned to them. Admins,
 * managers and customers use their own rules elsewhere. Returns true when the
 * caller is not a seller, so callers can simply do `if (!canSellerAccess(...))`.
 */
const canSellerAccess = (user, order) => {
  if (user?.role !== USER_ROLES.SELLER) return true;
  // `assignedSeller` may be a raw ObjectId (unpopulated fetch) or a populated
  // document ({ _id, name, email }) — normalize to the id either way.
  const assigned = order?.assignedSeller?._id || order?.assignedSeller;
  return !!assigned && assigned.toString() === user._id.toString();
};

/**
 * Admin (or manager) assigns a parcel to a seller. Both directions of the
 * isolation contract live here: the target must be a `seller`, and only staff
 * can assign.
 */
router.put('/:id/assign', isAdminOrManager, async (req, res) => {
  try {
    const { sellerId } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Order not found'
      });
    }

    // sellerId === null / '' unassigns the parcel
    if (!sellerId) {
      order.assignedSeller = null;
      await order.save();
      const populated = await Order.findById(order._id)
        .populate('customerId', 'name email shopDetails')
        .populate('assignedSeller', 'name email');
      return res.json({
        success: true,
        message: 'Parcel unassigned',
        data: { order: populated }
      });
    }

    const seller = await User.findById(sellerId);
    if (!seller) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Seller not found'
      });
    }
    if (seller.role !== USER_ROLES.SELLER) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `User '${seller.email}' is a ${seller.role}, not a seller`
      });
    }

    order.assignedSeller = seller._id;
    await order.save();

    // Tell the seller they have new work.
    setImmediate(async () => {
      try {
        await Notification.notifyUsers([seller._id], {
          type: 'shipment',
          level: 'info',
          title: `Parcel ${order.orderNumber} assigned to you`,
          body: 'Open your Seller Portal to dispatch it.',
          data: {
            orderId: String(order._id),
            orderNumber: order.orderNumber,
            status: order.status,
          },
        });
      } catch (e) {
        console.warn('Assignment notification failed:', e.message);
      }
    });

    const populated = await Order.findById(order._id)
      .populate('customerId', 'name email shopDetails')
      .populate('assignedSeller', 'name email');

    res.json({
      success: true,
      message: `Parcel assigned to ${seller.name || seller.email}`,
      data: { order: populated }
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/orders
// @desc    Get all orders
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { status, customerId, page = 1, limit = 50 } = req.query;
    
    const query = {};
    
    // Customers can only see their own orders.
    // Sellers can only see parcels the admin assigned to them.
    if (req.user.role === USER_ROLES.CUSTOMER) {
      query.customerId = req.user._id;
    } else if (req.user.role === USER_ROLES.SELLER) {
      query.assignedSeller = req.user._id;
    } else if (customerId) {
      query.customerId = customerId;
    }
    
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('customerId', 'name email shopDetails')
      .populate('assignedSeller', 'name email')
      .populate('items.productId', 'name sku')
      .populate('tracking.dispatchedBy', 'name email');

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/orders
// @desc    Create new order (customer or staff portal order)
// @access  Private
router.post('/', [
  body('items').isArray({ min: 1 }).withMessage('Order must have at least one item'),
  body('items.*.productId').notEmpty().withMessage('Product ID is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1')
], validate, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, notes } = req.body;
    
    // Validate and prepare order items
    const orderItems = [];
    let totalAmount = 0;

    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);
      
      if (!product) {
        await session.abortTransaction();
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: `Product not found: ${item.productId}`
        });
      }

      if (!product.isActive) {
        await session.abortTransaction();
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: `Product ${product.name} is not available`
        });
      }

      if (product.stockQuantity < item.quantity) {
        await session.abortTransaction();
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Available: ${product.stockQuantity}`
        });
      }

      const itemTotal = product.sellingPrice * item.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        productId: product._id,
        productName: product.name,
        sku: product.sku,
        quantity: item.quantity,
        price: product.sellingPrice,
        total: itemTotal
      });

      // Reduce inventory
      const previousStock = product.stockQuantity;
      product.stockQuantity -= item.quantity;
      await product.save({ session });

      // Log inventory change
      await InventoryLog.create([{
        productId: product._id,
        changeType: INVENTORY_CHANGE_TYPE.ORDER,
        quantityChanged: -item.quantity,
        previousStock,
        newStock: product.stockQuantity,
        performedBy: req.user._id
      }], { session });

      // Check if restock is needed
      if (product.stockQuantity < product.minThreshold) {
        const existingRequest = await RestockRequest.findOne({
          productId: product._id,
          status: { $in: [RESTOCK_STATUS.PENDING, RESTOCK_STATUS.EMAIL_SENT] }
        }).session(session);

        if (!existingRequest && product.supplier && product.supplier.email) {
          const requestedQuantity = Math.max(
            product.minThreshold * 2 - product.stockQuantity,
            product.minThreshold
          );

          const restockRequest = await RestockRequest.create([{
            productId: product._id,
            productName: product.name,
            sku: product.sku,
            currentStock: product.stockQuantity,
            threshold: product.minThreshold,
            requestedQuantity,
            supplierEmail: product.supplier.email,
            supplierName: product.supplier.name,
            status: RESTOCK_STATUS.PENDING
          }], { session });

          // Send email after transaction commits
          setImmediate(async () => {
            const emailResult = await emailService.sendRestockEmail(product, restockRequest[0]);
            if (emailResult.success) {
              restockRequest[0].status = RESTOCK_STATUS.EMAIL_SENT;
              restockRequest[0].emailSentAt = new Date();
              await restockRequest[0].save();
            }
          });
        }
      }
    }

    // Create order
    const order = await Order.create([{
      customerId: req.user._id,
      items: orderItems,
      totalAmount,
      notes,
      shippingAddress: req.user.shopDetails
    }], { session });

    await session.commitTransaction();

    // Send order confirmation email
    setImmediate(() => {
      emailService.sendOrderConfirmation(order[0], req.user);
    });

    // ARTHA: raise the invoice the moment the order is placed, so the customer
    // can see and pay it before shipping starts. Idempotent per order number —
    // the delivery-time re-emit below is a no-op once this one syncs.
    setImmediate(() => {
      publishOrderConfirmed({ order: order[0], actorUser: req.user }).catch((e) =>
        console.warn('Failed to publish order.confirmed to ARTHA:', e.message)
      );
    });

    // In-app notification: the owner/manager sees the new order immediately.
    setImmediate(async () => {
      try {
        const staff = await User.find({
          role: { $in: [USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.SELLER] },
        }).select('_id');
        await Notification.notifyUsers(
          staff.map((s) => s._id),
          {
            type: 'order',
            level: 'info',
            title: `New order ${order[0].orderNumber}`,
            body: `${req.user?.name || 'A customer'} ordered ${order[0].items.length} item(s) worth ₹${order[0].totalAmount}`,
            data: {
              orderId: String(order[0]._id),
              orderNumber: order[0].orderNumber,
              status: order[0].status,
            },
          }
        );
      } catch (e) {
        console.warn('Order notification failed:', e.message);
      }
    });

    // Populate order details
    const populatedOrder = await Order.findById(order[0]._id)
      .populate('customerId', 'name email shopDetails')
      .populate('items.productId', 'name sku');

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Order placed successfully',
      data: { order: populatedOrder }
    });

  } catch (error) {
    await session.abortTransaction();
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  } finally {
    session.endSession();
  }
});

// @route   GET /api/orders/:id
// @desc    Get order by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customerId', 'name email shopDetails')
      .populate('assignedSeller', 'name email')
      .populate('items.productId', 'name sku')
      .populate('tracking.dispatchedBy', 'name email');

    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Customers can only view their own orders
    if (req.user.role === USER_ROLES.CUSTOMER && order.customerId._id.toString() !== req.user._id.toString()) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Not authorized to view this order'
      });
    }

    // Sellers can only view parcels the admin assigned to them
    if (!canSellerAccess(req.user, order)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Not authorized to view this parcel'
      });
    }

    res.json({
      success: true,
      data: { order }
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/orders/:id/tracking
// @desc    Order tracking timeline + linked shipment (customer portal)
// @access  Private (owner or staff)
router.get('/:id/tracking', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customerId', 'name email shopDetails')
      .populate('items.productId', 'name sku')
      .populate('tracking.dispatchedBy', 'name email');

    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Customers can only track their own orders
    if (req.user.role === USER_ROLES.CUSTOMER && order.customerId._id.toString() !== req.user._id.toString()) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Not authorized to view this order'
      });
    }

    // Sellers can only track parcels the admin assigned to them
    if (!canSellerAccess(req.user, order)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Not authorized to view this parcel'
      });
    }

    const shipment = await Shipment.findOne({ order_id: order.orderNumber }).lean();

    const placedAt = order.tracking?.placedAt || order.createdAt;
    const dispatchedAt = order.tracking?.dispatchedAt || null;
    const deliveredAt = order.tracking?.deliveredAt || null;

    // ETA: prefer the real shipment estimate, otherwise derive one
    let eta = shipment?.estimated_delivery || null;
    if (!eta) {
      if (order.status === ORDER_STATUS.DELIVERED) {
        eta = deliveredAt ? new Date(deliveredAt).toISOString() : null;
      } else if (order.status === ORDER_STATUS.DISPATCHED && dispatchedAt) {
        eta = new Date(new Date(dispatchedAt).getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
      } else if (placedAt) {
        eta = new Date(new Date(placedAt).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
      }
    }

    const courier = shipment?.courier_name || null;
    const dealer = shipment?.dealer_name || shipment?.worker?.name || null;

    /** Timestamp of a shipment timeline event (fall back to its stamp fields). */
    const eventAt = (key) => {
      const ev = (shipment?.events || []).find((e) => e.key === key);
      return ev?.at || null;
    };

    const placedStep = {
      key: 'placed',
      label: 'Order Placed',
      state: 'done',
      at: placedAt ? new Date(placedAt).toISOString() : null,
      description: 'We received your order'
    };
    const dispatchedStep = {
      key: 'dispatched',
      label: 'Handed to delivery partner',
      state: dispatchedAt ? 'done' : 'pending',
      at: dispatchedAt ? new Date(dispatchedAt).toISOString() : null,
      description: dispatchedAt
        ? `Handed to ${courier || 'our courier partner'}`
        : 'Being packed and handed to the courier'
    };

    // Dealer legs — only shown once a shipment exists for this order.
    const dealerSteps = shipment
      ? [
          {
            key: 'picked_up',
            label: 'Picked up by dealer',
            at: shipment.pickup_at || eventAt('picked_up'),
            description: dealer
              ? `${dealer} collected the parcel`
              : 'The delivery worker collected the parcel'
          },
          {
            key: 'out_for_delivery',
            label: 'Out for delivery',
            at: shipment.out_for_delivery_at || eventAt('out_for_delivery'),
            description: dealer
              ? `${dealer} is on the final leg`
              : 'The delivery worker is on the final leg'
          },
        ]
      : [];

    const deliveredAt2 = shipment?.delivered_at || eventAt('delivered') || deliveredAt;
    const deliveredStep = {
      key: 'delivered',
      label: 'Delivered',
      state: deliveredAt2 ? 'done' : 'pending',
      at: deliveredAt2 ? new Date(deliveredAt2).toISOString() : null,
      description: deliveredAt2
        ? (order.tracking?.confirmedByCustomer
            ? 'Delivered and confirmed by you'
            : 'Handed over — confirm receipt to close the order')
        : (eta ? `Expected by ${new Date(eta).toLocaleDateString()}` : 'Awaiting dispatch')
    };

    const withState = (step) => ({
      ...step,
      state: step.state || (step.at ? 'done' : 'pending'),
      at: step.at ? new Date(step.at).toISOString() : null,
    });

    const timeline = [
      placedStep,
      dispatchedStep,
      ...dealerSteps.map(withState),
      deliveredStep,
    ];

    // Worker start/end times for the seller-agent handover legs.
    const worker = shipment?.worker
      ? {
          name: shipment.worker.name || dealer || null,
          startedAt: shipment.worker.startedAt
            ? new Date(shipment.worker.startedAt).toISOString()
            : null,
          endedAt: shipment.worker.endedAt
            ? new Date(shipment.worker.endedAt).toISOString()
            : null,
        }
      : null;

    res.json({
      success: true,
      data: { order, shipment, eta, timeline, worker }
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PUT /api/orders/:id/dispatch
// @desc    Mark order as dispatched
// @access  Private/Admin/Manager
router.put('/:id/dispatch', isShopFloor, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Order not found'
      });
    }

    // A seller may only dispatch parcels the admin assigned to them.
    if (!canSellerAccess(req.user, order)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Not authorized to dispatch this parcel'
      });
    }

    if (order.status !== ORDER_STATUS.PLACED) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `Order cannot be dispatched. Current status: ${order.status}`
      });
    }

    order.status = ORDER_STATUS.DISPATCHED;
    order.tracking.dispatchedAt = new Date();
    order.tracking.dispatchedBy = req.user._id;

    await order.save();

    // Logistics: register the shipment for this order (customer tracking)
    const shipment = await ensureShipmentForOrder(order);

    // Notify customer (email) after dispatch
    setImmediate(async () => {
      try {
        const customer = await User.findById(order.customerId).select('name email');
        if (customer?.email) {
          await emailService.sendOrderDispatched(order, customer);
        }
      } catch (e) {
        console.warn('Failed to send dispatched email:', e.message);
      }
    });

    // In-app notification: the customer can now track the shipment.
    setImmediate(async () => {
      try {
        await Notification.notifyUsers([order.customerId], {
          type: 'shipment',
          level: 'info',
          title: `Order ${order.orderNumber} dispatched`,
          body: 'Your parcel has been handed to the delivery partner. Track it live in your portal.',
          data: {
            orderId: String(order._id),
            orderNumber: order.orderNumber,
            shipmentId: shipment?.shipment_id || null,
            trackingNumber: shipment?.tracking_number || null,
            status: 'DISPATCHED',
          },
        });
      } catch (e) {
        console.warn('Dispatch notification failed:', e.message);
      }
    });

    const populatedOrder = await Order.findById(order._id)
      .populate('customerId', 'name email shopDetails')
      .populate('items.productId', 'name sku')
      .populate('tracking.dispatchedBy', 'name email');

    res.json({
      success: true,
      message: 'Order marked as dispatched',
      data: { order: populatedOrder, shipment }
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PUT /api/orders/:id/deliver
// @desc    Confirm delivery (by customer)
// @access  Private/Customer
router.put('/:id/deliver', isCustomer, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Verify order belongs to customer
    if (order.customerId.toString() !== req.user._id.toString()) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Not authorized to update this order'
      });
    }

    if (order.status !== ORDER_STATUS.DISPATCHED) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `Order cannot be delivered. Current status: ${order.status}`
      });
    }

    order.status = ORDER_STATUS.DELIVERED;
    order.tracking.deliveredAt = new Date();
    order.tracking.confirmedByCustomer = true;

    await order.save();

    // Logistics: reflect delivery on the shipment record (if one exists)
    try {
      await Shipment.updateOne(
        { order_id: order.orderNumber },
        { $set: { status: 'DELIVERED' } }
      );
    } catch (e) {
      console.warn('Failed to update shipment on delivery:', e.message);
    }

    // Notify customer (email) after delivery confirmation
    setImmediate(async () => {
      try {
        const customer = await User.findById(order.customerId).select('name email');
        if (customer?.email) {
          await emailService.sendOrderDelivered(order, customer);
        }
      } catch (e) {
        console.warn('Failed to send delivered email:', e.message);
      }
    });

    // Recognise revenue in ARTHA (fire-and-forget, idempotent by order number)
    setImmediate(() => {
      publishOrderConfirmed({ order, actorUser: req.user }).catch((e) =>
        console.warn('Failed to publish order.confirmed to ARTHA:', e.message)
      );
    });

    // In-app notification: delivery confirmed, invoice is ready to pay.
    setImmediate(async () => {
      try {
        await Notification.notifyUsers([order.customerId], {
          type: 'invoice',
          level: 'success',
          title: `Order ${order.orderNumber} delivered`,
          body: 'Delivery confirmed. Your invoice has been generated in ARTHA — view it or pay now.',
          data: {
            orderId: String(order._id),
            orderNumber: order.orderNumber,
            status: 'DELIVERED',
          },
        });
      } catch (e) {
        console.warn('Delivery notification failed:', e.message);
      }
    });

    const populatedOrder = await Order.findById(order._id)
      .populate('customerId', 'name email shopDetails')
      .populate('items.productId', 'name sku')
      .populate('tracking.dispatchedBy', 'name email');

    res.json({
      success: true,
      message: 'Order marked as delivered',
      data: { order: populatedOrder }
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/orders/stats/summary
// @desc    Get order statistics
// @access  Private/Admin/Manager
router.get('/stats/summary', isAdminOrManager, async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const placedOrders = await Order.countDocuments({ status: ORDER_STATUS.PLACED });
    const dispatchedOrders = await Order.countDocuments({ status: ORDER_STATUS.DISPATCHED });
    const deliveredOrders = await Order.countDocuments({ status: ORDER_STATUS.DELIVERED });

    // Get revenue statistics
    const orders = await Order.find({ status: ORDER_STATUS.DELIVERED });
    const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);

    res.json({
      success: true,
      data: {
        totalOrders,
        placedOrders,
        dispatchedOrders,
        deliveredOrders,
        totalRevenue: totalRevenue.toFixed(2)
      }
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
});

export default router;
