import express from 'express';
import mongoose from 'mongoose';
import { protect } from '../middleware/auth.js';
import { isAdminOrManager } from '../middleware/authorize.js';
import emailService from '../services/emailService.js';
import Product from '../models/Product.js';
import RestockRequest from '../models/RestockRequest.js';
import Order from '../models/Order.js';
import EmailLog from '../models/EmailLog.js';

const router = express.Router();

// All routes require authentication and admin/manager role
router.use(protect);
router.use(isAdminOrManager);

// @route   POST /api/ems/send-to-supplier
// @desc    Send email to a specific supplier
// @access  Admin/Manager
router.post('/send-to-supplier', async (req, res) => {
  try {
    const { supplierEmail, supplierName, subject, message, emailType } = req.body;

    if (!supplierEmail || !subject || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Supplier email, subject, and message are required' 
      });
    }

    const result = await emailService.sendSupplierEmail({
      to: supplierEmail,
      supplierName: supplierName || 'Valued Supplier',
      subject,
      message,
      emailType: emailType || 'general'
    });

    // Log email to DB for real-time tracking
    await EmailLog.create({
      recipient: supplierEmail,
      subject,
      emailType: emailType || 'supplier',
      status: result.success ? 'sent' : 'failed',
      messageId: result.messageId,
      error: result.message
    });

    res.json({
      success: result.success,
      message: result.success ? 'Email sent successfully' : 'Failed to send email',
      messageId: result.messageId
    });
  } catch (error) {
    console.error('Error sending supplier email:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to send email' 
    });
  }
});

// @route   POST /api/ems/restock-alert
// @desc    Send restock alert to supplier
// @access  Admin/Manager
router.post('/restock-alert', async (req, res) => {
  try {
    const { productId, productName, quantity, currentStock, supplierEmail, message } = req.body;

    let product = null;
    if (productId && mongoose.Types.ObjectId.isValid(productId)) {
      product = await Product.findById(productId).populate('supplier');
    }

    const recipientEmail = supplierEmail || product?.supplier?.email;
    if (!recipientEmail) {
      return res.status(400).json({ 
        success: false, 
        message: 'Supplier email is required' 
      });
    }

    const restockRequest = {
      currentStock: currentStock || product?.stock || 0,
      threshold: product?.minStock || 10,
      requestedQuantity: quantity || 20,
      supplierEmail: recipientEmail,
      message: message || 'Urgent restock request'
    };

    const targetProduct = product || {
      name: productName || 'Requested Product',
      sku: productId || 'PROD-ALERT',
      unit: 'units'
    };

    const result = await emailService.sendRestockEmail(targetProduct, restockRequest);

    // Log email to DB for real-time tracking
    await EmailLog.create({
      recipient: recipientEmail,
      subject: `🔔 Urgent: Restock Request for ${targetProduct.name}`,
      emailType: 'restock',
      status: result.success ? 'sent' : 'failed',
      messageId: result.messageId,
      error: result.message
    });

    res.json({
      success: result.success,
      message: result.success ? 'Restock alert sent successfully' : 'Failed to send restock alert',
      messageId: result.messageId
    });
  } catch (error) {
    console.error('Error sending restock alert:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to send restock alert' 
    });
  }
});

// @route   POST /api/ems/purchase-order
// @desc    Send purchase order to supplier
// @access  Admin/Manager
router.post('/purchase-order', async (req, res) => {
  try {
    const { supplierEmail, supplierName, items, orderNumber, deliveryDate } = req.body;

    if (!supplierEmail || !items || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Supplier email and items are required' 
      });
    }

    const poNum = orderNumber || `PO-${Date.now()}`;
    const result = await emailService.sendPurchaseOrderEmail({
      supplierEmail,
      supplierName: supplierName || 'Valued Supplier',
      items,
      orderNumber: poNum,
      deliveryDate: deliveryDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    await EmailLog.create({
      recipient: supplierEmail,
      subject: `Purchase Order #${poNum}`,
      emailType: 'purchase',
      status: result.success ? 'sent' : 'failed',
      messageId: result.messageId,
      error: result.message
    });

    res.json({
      success: result.success,
      message: result.success ? 'Purchase order sent successfully' : 'Failed to send purchase order',
      messageId: result.messageId
    });
  } catch (error) {
    console.error('Error sending purchase order:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to send purchase order' 
    });
  }
});

// @route   POST /api/ems/shipment-notification
// @desc    Send shipment notification
// @access  Admin/Manager
router.post('/shipment-notification', async (req, res) => {
  try {
    const { recipientEmail, trackingNumber, estimatedDelivery } = req.body;

    const result = await emailService.sendShipmentNotification({
      to: recipientEmail,
      trackingNumber,
      estimatedDelivery
    });

    await EmailLog.create({
      recipient: recipientEmail,
      subject: '📦 Your Order Has Been Shipped',
      emailType: 'shipment',
      status: result.success ? 'sent' : 'failed',
      messageId: result.messageId,
      error: result.message
    });

    res.json({
      success: result.success,
      message: result.success ? 'Shipment notification sent' : 'Failed to send notification',
      messageId: result.messageId
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// @route   GET /api/ems/stats
// @desc    Get email statistics
// @access  Admin/Manager
router.get('/stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sentTodayCount = await EmailLog.countDocuments({
      createdAt: { $gte: today },
      status: 'sent'
    });

    const totalLogs = await EmailLog.countDocuments();
    const successfulLogs = await EmailLog.countDocuments({ status: 'sent' });
    const successRate = totalLogs > 0 ? Math.round((successfulLogs / totalLogs) * 100 * 10) / 10 : 100;

    const stats = {
      emails_sent_today: sentTodayCount,
      success_rate: successRate,
      scheduled: 0,
      templates: 5
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching email stats:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// @route   GET /api/ems/activity
// @desc    Get recent email activity
// @access  Admin/Manager
router.get('/activity', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;

    const logs = await EmailLog.find()
      .sort({ createdAt: -1 })
      .limit(limit);

    const activity = logs.map(log => ({
      id: log._id,
      type: log.subject || 'Email',
      email_type: log.emailType,
      recipient: log.recipient,
      to: log.recipient,
      status: log.status,
      timestamp: log.createdAt
    }));

    res.json({ activity });
  } catch (error) {
    console.error('Error fetching email activity:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// @route   GET /api/ems/scheduled
// @desc    Get scheduled emails
// @access  Admin/Manager
router.get('/scheduled', async (req, res) => {
  try {
    // Return empty array for now - implement scheduling logic later
    res.json({ scheduled: [] });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// @route   POST /api/ems/schedule
// @desc    Schedule an email
// @access  Admin/Manager
router.post('/schedule', async (req, res) => {
  try {
    const { subject, recipients, scheduledTime, message } = req.body;

    // Implement email scheduling logic here
    res.json({ 
      success: true,
      message: 'Email scheduling not yet implemented',
      id: Date.now()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// @route   GET /api/ems/templates
// @desc    Get email templates
// @access  Admin/Manager
router.get('/templates', async (req, res) => {
  try {
    const templates = [
      {
        id: 'restock',
        name: 'Restock Request',
        subject: 'Urgent: Restock Request for {{productName}}',
        description: 'Used for requesting product restock from suppliers'
      },
      {
        id: 'purchase-order',
        name: 'Purchase Order',
        subject: 'Purchase Order #{{orderNumber}}',
        description: 'Formal purchase order sent to suppliers'
      },
      {
        id: 'shipment',
        name: 'Shipment Notification',
        subject: 'Your Order Has Been Shipped',
        description: 'Notify customers about shipment'
      },
      {
        id: 'delivery-delay',
        name: 'Delivery Delay Notice',
        subject: 'Update: Delivery Delay for Order #{{orderNumber}}',
        description: 'Inform customers about delivery delays'
      },
      {
        id: 'custom',
        name: 'Custom Email',
        subject: 'Message from {{companyName}}',
        description: 'General purpose email template'
      }
    ];

    res.json(templates);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// @route   GET /api/ems/settings
// @desc    Get email settings
// @access  Admin/Manager
router.get('/settings', async (req, res) => {
  try {
    const settings = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      user: process.env.SMTP_USER || '',
      port: parseInt(process.env.SMTP_PORT) || 587,
      sslTls: process.env.SMTP_SECURE !== 'false',
      configured: !!(process.env.SMTP_USER && process.env.SMTP_PASSWORD)
    };

    res.json(settings);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// @route   PUT /api/ems/settings
// @desc    Update email settings
// @access  Admin only
router.put('/settings', protect, async (req, res) => {
  try {
    // This would typically update .env file or database settings
    // For now, just return success
    res.json({ 
      success: true,
      message: 'Settings update requires server restart' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

export default router;
