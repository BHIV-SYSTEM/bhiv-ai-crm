import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import Order from '../models/Order.js';
import ArthaEventLog from '../models/ArthaEventLog.js';
import { callArtha } from '../services/arthaBridge.service.js';

const router = Router();
router.use(protect);

router.get('/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const isCustomer = req.user?.role === 'customer';
    const isOwner = String(order.customerId) === String(req.user?._id);
    if (isCustomer && !isOwner) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    let confirmed = await ArthaEventLog.findOne({
      orderId: order._id,
      eventType: 'order.confirmed',
    }).sort({ createdAt: -1 });

    if (!confirmed && order.orderNumber) {
      confirmed = await ArthaEventLog.findOne({
        eventType: 'order.confirmed',
        idempotencyKey: order.orderNumber,
      }).sort({ createdAt: -1 });
    }

    const cancelled = await ArthaEventLog.findOne({
      orderId: order._id,
      eventType: 'order.cancelled',
    }).sort({ createdAt: -1 });

    let finance = null;
    if (confirmed) {
      finance = {
        eventStatus: confirmed.status,
        attempts: confirmed.attempts || 0,
        lastError: confirmed.lastError || null,
        invoiceId: confirmed.entity?.id || null,
        invoiceNumber: confirmed.entity?.number || null,
        invoiceStatus: confirmed.entity?.status || null,
        syncedAt: confirmed.status === 'SYNCED' ? confirmed.updatedAt : null,
        cancelled: Boolean(cancelled && cancelled.status === 'SYNCED'),
      };
    }

    if (finance?.invoiceId) {
      const live = await callArtha({
        path: `/invoices/${finance.invoiceId}`,
        tenantId: req.user?.tenant_id,
      });
      if (live.ok && live.body?.data) {
        const invoice = live.body.data;
        finance.invoiceStatus = invoice.status || finance.invoiceStatus;
        finance.amountPaid = invoice.amountPaid ?? null;
        finance.totalAmount = invoice.totalAmount ?? null;
        // Invoice detail for the customer/owner invoice views (shown exactly as
        // ARTHA reports them — no tax figure is ever invented here).
        finance.subtotal = invoice.subtotal ?? null;
        finance.taxAmount = invoice.taxAmount ?? null;
        finance.gstBreakdown = invoice.gstBreakdown ?? null;
        finance.invoiceDate = invoice.invoiceDate ?? null;
        finance.dueDate = invoice.dueDate ?? null;
        finance.customerName = invoice.customerName ?? null;
        finance.notes = invoice.notes ?? null;
        finance.live = true;
      }
    }

    res.json({
      success: true,
      data: {
        orderId: String(order._id),
        orderNumber: order.orderNumber,
        orderStatus: order.status,
        finance,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load order finance status' });
  }
});

export default router;
